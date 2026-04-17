import { world } from '@minecraft/server';
import { EntityManager } from './entityManager';
import * as Constants from './constants';

const { CONTROLLER_FAMILY, MAX_STRUCTURE_RADIUS } = Constants;

export const VANILLA_CONTAINERS = [
  'minecraft:chest',
  'minecraft:trapped_chest',
  'minecraft:barrel',
  'minecraft:furnace',
  'minecraft:blast_furnace',
  'minecraft:hopper',
  'minecraft:smoker',
  'minecraft:shulker',
  'minecraft:dropper',
];

const DIRECTIONS = [
  (block) => block.north(),
  (block) => block.east(),
  (block) => block.south(),
  (block) => block.west(),
  (block) => block.above(),
  (block) => block.below(),
];

function hasInventory(block) {
  if (!block) return false;

  try {
    return !!block.getComponent('inventory');
  } catch {
    return false;
  }
}

function getBlockContainer(block) {
  if (!block) return;

  try {
    return block.getComponent('inventory')?.container;
  } catch {
    return;
  }
}

function isActiveItemPort(block) {
  if (!block) return false;

  return (
    block.permutation.getState('modular_energistics:activated') === true &&
    (block.hasTag(Constants.INPUT_PORT_TAG) || block.hasTag(Constants.OUTPUT_PORT_TAG))
  );
}

function normalizeLocation(location) {
  return {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z),
  };
}

function getContainerAtLocation(dimension, location) {
  const block = dimension.getBlock(normalizeLocation(location));
  return getBlockContainer(block);
}

function locationEquals(a, b) {
  return (
    Math.floor(a.x) === Math.floor(b.x) &&
    Math.floor(a.y) === Math.floor(b.y) &&
    Math.floor(a.z) === Math.floor(b.z)
  );
}

function getControllerForPort(portBlock, group) {
  const controllers = portBlock.dimension.getEntities({
    location: portBlock.location,
    maxDistance: MAX_STRUCTURE_RADIUS,
    families: [CONTROLLER_FAMILY],
  });

  for (const controller of controllers) {
    const structure = EntityManager.getStructureData(controller);
    const ports = structure?.ports?.[group] ?? [];

    if (ports.some((port) => locationEquals(port, portBlock.location))) {
      return controller;
    }
  }
}

function getFirstItemSlot(container, slots) {
  if (!container) return -1;

  const targetSlots = slots ?? [...Array(container.size).keys()];

  for (const slot of targetSlots) {
    if (container.getItem(slot)) {
      return slot;
    }
  }

  return -1;
}

function getFirstEmptySlot(container, slots) {
  if (!container) return -1;

  for (const slot of slots) {
    if (!container.getItem(slot)) {
      return slot;
    }
  }

  return -1;
}

function getFirstCompatibleSlot(container, slots, item) {
  if (!container || !item) return -1;

  for (const slot of slots) {
    const slotItem = container.getItem(slot);
    if (!slotItem) continue;
    if (slotItem.typeId !== item.typeId) continue;
    if (slotItem.amount >= slotItem.maxAmount) continue;

    return slot;
  }

  return -1;
}

function hasEmptySlot(container, slots) {
  return getFirstEmptySlot(container, slots) !== -1;
}

function mergeIntoSlot(sourceContainer, sourceSlot, targetContainer, targetSlot) {
  const sourceItem = sourceContainer?.getItem(sourceSlot);
  const targetItem = targetContainer?.getItem(targetSlot);

  if (!sourceItem || !targetItem) return false;
  if (sourceItem.typeId !== targetItem.typeId) return false;

  const space = targetItem.maxAmount - targetItem.amount;
  if (space <= 0) return false;

  const moved = Math.min(space, sourceItem.amount);
  targetItem.amount += moved;
  targetContainer.setItem(targetSlot, targetItem);

  if (moved >= sourceItem.amount) {
    sourceContainer.setItem(sourceSlot);
  } else {
    sourceItem.amount -= moved;
    sourceContainer.setItem(sourceSlot, sourceItem);
  }

  return moved > 0;
}

function tryAddItemToContainer(sourceContainer, sourceSlot, targetContainer) {
  const sourceItem = sourceContainer?.getItem(sourceSlot);
  if (!sourceItem || !targetContainer) return false;

  const itemToInsert = sourceItem.clone();
  const remainder = targetContainer.addItem(itemToInsert);

  if (!remainder) {
    sourceContainer.setItem(sourceSlot);
    return true;
  }

  if (remainder.amount === sourceItem.amount) {
    return false;
  }

  sourceContainer.setItem(sourceSlot, remainder);
  return true;
}

export function distributeInput(entity, entityContainer, inputSlots) {
  if (!entity || !entityContainer || !inputSlots?.length) return false;

  const registry = EntityManager.getContainerRegistry(entity);

  for (const location of registry.input ?? []) {
    const sourceContainer = getContainerAtLocation(entity.dimension, location);
    if (!sourceContainer) continue;

    const sourceSlot = getFirstItemSlot(sourceContainer);
    if (sourceSlot === -1) continue;

    const sourceItem = sourceContainer.getItem(sourceSlot);
    if (!sourceItem) continue;

    const emptyMachineSlot = getFirstEmptySlot(entityContainer, inputSlots);
    if (emptyMachineSlot !== -1) {
      entityContainer.swapItems(emptyMachineSlot, sourceSlot, sourceContainer);
      return true;
    }

    const compatibleMachineSlot = getFirstCompatibleSlot(
      entityContainer,
      inputSlots,
      sourceItem,
    );

    if (compatibleMachineSlot !== -1) {
      if (
        mergeIntoSlot(
          sourceContainer,
          sourceSlot,
          entityContainer,
          compatibleMachineSlot,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function distributeOutput(entity, entityContainer, outputSlots) {
  if (!entity || !entityContainer || !outputSlots?.length) return false;

  const registry = EntityManager.getContainerRegistry(entity);

  for (const location of registry.output ?? []) {
    const targetContainer = getContainerAtLocation(entity.dimension, location);
    if (!targetContainer) continue;

    const targetSlots = [...Array(targetContainer.size).keys()];

    const sourceSlot = getFirstItemSlot(entityContainer, outputSlots);
    if (sourceSlot === -1) continue;

    const sourceItem = entityContainer.getItem(sourceSlot);
    if (!sourceItem) continue;

    if (hasEmptySlot(targetContainer, targetSlots)) {
      if (tryAddItemToContainer(entityContainer, sourceSlot, targetContainer)) {
        return true;
      }
    }

    const compatibleTargetSlot = getFirstCompatibleSlot(
      targetContainer,
      targetSlots,
      sourceItem,
    );

    if (compatibleTargetSlot !== -1) {
      if (
        mergeIntoSlot(
          entityContainer,
          sourceSlot,
          targetContainer,
          compatibleTargetSlot,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

export function registerAdjacentContainersFromStructure(entity, block, structure) {
  EntityManager.setContainers(entity, {
    input: [],
    output: [],
  });

  for (const group of ['input', 'output']) {
    for (const portLocation of structure?.ports?.[group] ?? []) {
      const portBlock = block.dimension.getBlock(portLocation);
      if (!portBlock) continue;

      for (const getNeighbor of DIRECTIONS) {
        const adjacent = getNeighbor(portBlock);
        if (!adjacent || !hasInventory(adjacent)) continue;

        EntityManager.registerContainer(entity, group, adjacent.location);
      }
    }
  }
}

function registerContainerForAdjacentPorts(containerBlock) {
  for (const getNeighbor of DIRECTIONS) {
    const portBlock = getNeighbor(containerBlock);
    if (!isActiveItemPort(portBlock)) continue;

    const group = portBlock.hasTag(Constants.INPUT_PORT_TAG) ? 'input' : 'output';
    const controller = getControllerForPort(portBlock, group);
    if (!controller) continue;

    EntityManager.registerContainer(controller, group, containerBlock.location);
  }
}

function removeContainerForAdjacentPorts(block) {
  for (const getNeighbor of DIRECTIONS) {
    const portBlock = getNeighbor(block);
    if (!isActiveItemPort(portBlock)) continue;

    const group = portBlock.hasTag(Constants.INPUT_PORT_TAG) ? 'input' : 'output';
    const controller = getControllerForPort(portBlock, group);
    if (!controller) continue;

    EntityManager.deleteContainer(controller, group, block.location);
  }
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const block = event.block;
  if (!VANILLA_CONTAINERS.includes(block.typeId)) return;

  registerContainerForAdjacentPorts(block);
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const brokenTypeId = event.brokenBlockPermutation?.type?.id;
  if (!VANILLA_CONTAINERS.includes(brokenTypeId)) return;

  removeContainerForAdjacentPorts(event.block);
});
