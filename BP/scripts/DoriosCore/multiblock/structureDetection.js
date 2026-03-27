import { system } from "@minecraft/server";
import { MAX_SIZE, SCAN_SPEED } from "./constants.js";
import { getCenter } from "./entityManager.js";

export async function detectFromController(e, caseTag) {
  const controllerBlock = e.block;
  const sendMessage = e.player.sendMessage.bind(e.player);
  const dim = controllerBlock.dimension;
  const startPos = controllerBlock.location;

  const bounds = await findMultiblockBounds(startPos, dim, caseTag);
  if (bounds === undefined) {
    sendMessage("§c[Scan] No valid casing structure found around the controller.");
    return false;
  }

  sendMessage("§7[Scan] Detecting outer casing bounds and scanning internal components...");
  const { min, max } = bounds;
  const data = await scanStructure(min, max, dim, startPos, caseTag);
  if (typeof data === "string") {
    sendMessage(`§c[Scan] Invalid block detected at:${data}`);
    return false;
  }

  const { components, inputBlocks, caseBlocks, ventBlocks } = data;
  await showFormationEffect(bounds, dim);

  return {
    bounds,
    components,
    inputBlocks,
    caseBlocks,
    ventBlocks,
    center: getCenter(min, max),
  };
}

export async function showFormationEffect(bounds, dim) {
  const { min, max } = bounds;

  for (let y = min.y; y <= max.y; y++) {
    const yOffset = y + 0.5;

    for (let x = min.x; x <= max.x; x++) {
      dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
        x: x + 0.5,
        y: yOffset,
        z: min.z - 0.1,
      });
    }

    for (let x = min.x; x <= max.x; x++) {
      dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
        x: x + 0.5,
        y: yOffset,
        z: max.z + 1.1,
      });
    }

    for (let z = min.z; z <= max.z; z++) {
      dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
        x: min.x - 0.1,
        y: yOffset,
        z: z + 0.5,
      });
    }

    for (let z = min.z; z <= max.z; z++) {
      dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
        x: max.x + 1.1,
        y: yOffset,
        z: z + 0.5,
      });
    }

    await system.waitTicks(2);
  }
}

export async function findMultiblockBounds(start, dim, caseTag) {
  const isCasing = (pos) => dim.getBlock(pos)?.hasTag(caseTag);

  async function expandAxis(axis, origin) {
    let min = origin[axis];
    let max = origin[axis];

    for (let i = 1; i <= MAX_SIZE; i++) {
      if (i % 2 === 0) await system.waitTicks(1);
      const pos = { ...origin, [axis]: origin[axis] + i };
      if (!isCasing(pos)) break;
      max = pos[axis];
    }

    for (let i = 1; i <= MAX_SIZE; i++) {
      if (i % 2 === 0) await system.waitTicks(1);
      const pos = { ...origin, [axis]: origin[axis] - i };
      if (!isCasing(pos)) break;
      min = pos[axis];
    }

    return [min, max];
  }

  const origin = { ...start };

  const hasEast = isCasing({ ...origin, x: origin.x + 1 });
  const hasWest = isCasing({ ...origin, x: origin.x - 1 });
  const hasNorth = isCasing({ ...origin, z: origin.z - 1 });
  const hasSouth = isCasing({ ...origin, z: origin.z + 1 });

  let minX;
  let maxX;
  let minZ;
  let maxZ;

  if (hasEast || hasWest) {
    [minX, maxX] = await expandAxis("x", origin);

    let zScanPoint = { ...origin, x: minX };
    if (!isCasing(zScanPoint)) zScanPoint = { ...origin, x: maxX };
    if (!isCasing(zScanPoint)) return null;

    [minZ, maxZ] = await expandAxis("z", zScanPoint);
  } else if (hasNorth || hasSouth) {
    [minZ, maxZ] = await expandAxis("z", origin);

    let xScanPoint = { ...origin, z: minZ };
    if (!isCasing(xScanPoint)) xScanPoint = { ...origin, z: maxZ };
    if (!isCasing(xScanPoint)) return null;

    [minX, maxX] = await expandAxis("x", xScanPoint);
  } else {
    return null;
  }

  const yScanPoint = { x: minX, y: origin.y, z: minZ };
  const [minY, maxY] = await expandAxis("y", yScanPoint);

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

export async function scanStructure(min, max, dim, controller, caseTag) {
  const components = {};
  const inputBlocks = [];
  const ventBlocks = [];

  for (let x = min.x; x <= max.x; x++) {
    for (let y = min.y; y <= max.y; y++) {
      for (let z = min.z; z <= max.z; z++) {
        if (z % SCAN_SPEED === 0) await system.waitTicks(1);
        const block = dim.getBlock({ x, y, z });

        const isEdge =
          x === min.x ||
          x === max.x ||
          y === min.y ||
          y === max.y ||
          z === min.z ||
          z === max.z;

        if (isEdge) {
          if (block.x === controller.x && block.y === controller.y && block.z === controller.z) continue;
          if (block?.hasTag(caseTag)) {
            if (block?.hasTag("dorios:multiblock.port")) {
              inputBlocks.push(`input:[${x},${y},${z}]`);
            }
            if (block?.hasTag("dorios:vent_block") && y === max.y) {
              components.vent = (components.vent ?? 0) + 1;
              ventBlocks.push({ x, y, z });
            }
            continue;
          }
          return `x: ${x}, y: ${y}, z: ${z}`;
        }

        if (block?.typeId === "minecraft:air") {
          components.air = (components.air ?? 0) + 1;
          continue;
        }

        if (block?.hasTag("dorios:multiblock_component")) {
          const id = block.typeId.split(":")[1];
          components[id] = (components[id] ?? 0) + 1;
          continue;
        }

        if (block?.isLiquid) continue;
        return `x: ${x}, y: ${y}, z: ${z}`;
      }
    }
  }

  return { components, inputBlocks, ventBlocks };
}
