import { EnergyStorage } from "../machinery/energyStorage.js";
import { ENERGY_PER_UNIT } from "./constants.js";

export function activateMultiblock(entity, structure) {
  const { inputBlocks, bounds, ventBlocks, components } = structure;

  entity.triggerEvent("utilitycraft:show");

  for (const tag of inputBlocks) {
    entity.addTag(tag);

    const [x, y, z] = tag.slice(7, -1).split(",").map(Number);
    const block = entity.dimension.getBlock({ x, y, z });

    if (block?.hasTag("dorios:multiblock.port")) {
      block.setPermutation(block.permutation.withState("utilitycraft:active", 1));
      if (block.hasTag("dorios:energy")) entity.runCommand(`scriptevent dorios:updatePipes energy|[${x},${y},${z}]`);
      if (block.hasTag("dorios:fluid")) entity.runCommand(`scriptevent dorios:updatePipes fluid|[${x},${y},${z}]`);
      if (block.hasTag("dorios:item")) entity.runCommand(`scriptevent dorios:updatePipes item|[${x},${y},${z}]`);
    }
  }

  if (bounds) {
    entity.setDynamicProperty("dorios:bounds", JSON.stringify(bounds));
  }

  if (ventBlocks) {
    entity.setDynamicProperty("ventBlocks", JSON.stringify(ventBlocks));
  }

  const energyCap = calculateEnergyCapacity(components ?? {});
  if (energyCap > 0) {
    EnergyStorage.setCap(entity, energyCap);
    entity.setDynamicProperty("dorios:energyCap", energyCap);
  }

  entity.setDynamicProperty("dorios:state", "on");
  return energyCap;
}

export function calculateEnergyCapacity(components) {
  let total = 0;

  for (const [id, count] of Object.entries(components)) {
    const amount = ENERGY_PER_UNIT[id];
    if (!amount) continue;
    total += count * amount;
  }

  return total;
}
