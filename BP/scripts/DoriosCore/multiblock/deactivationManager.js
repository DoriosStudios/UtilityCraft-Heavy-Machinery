import { system } from "@minecraft/server";
import { getEntityFromBlock } from "./entityManager.js";

export function emptyBlocks(entity, blockId = "minecraft:water") {
  const oldDataRaw = entity.getDynamicProperty("reactorStats");
  if (!oldDataRaw) return;
  const oldData = JSON.parse(oldDataRaw);
  const bounds = oldData.bounds;
  const dim = entity.dimension;
  const xA = bounds.min.x;
  const yA = bounds.min.y;
  const zA = bounds.min.z;
  const xB = bounds.max.x;
  const yB = bounds.max.y;
  const zB = bounds.max.z;

  const yBottom = yA <= yB ? yA : yB;
  const yTop = yA <= yB ? yB : yA;

  system.run(async () => {
    for (let y = yTop; y >= yBottom; y--) {
      dim.runCommand(`fill ${xA} ${y} ${zA} ${xB} ${y} ${zB} air replace ${blockId}`);
      await system.waitTicks(2);
    }
  });
}

export function deactivateMultiblock(block, player, emptyBlocksConfig) {
  const entity = getEntityFromBlock(block);
  if (player) player.sendMessage("§c[Scan] Multiblock structure deactivated.");
  if (!entity) return;

  entity.triggerEvent("utilitycraft:hide");
  entity.getTags().forEach((tag) => {
    if (!tag.startsWith("input:")) return;

    const [x, y, z] = tag.slice(7, -1).split(",").map(Number);
    const inputBlock = entity.dimension.getBlock({ x, y, z });
    if (!inputBlock?.hasTag("dorios:multiblock.port")) return;

    entity.removeTag(tag);
    if (inputBlock.hasTag("dorios:energy")) entity.runCommand(`scriptevent dorios:updatePipes energy|[${x},${y},${z}]`);
    if (inputBlock.hasTag("dorios:fluid")) entity.runCommand(`scriptevent dorios:updatePipes fluid|[${x},${y},${z}]`);
    if (inputBlock.hasTag("dorios:item")) entity.runCommand(`scriptevent dorios:updatePipes item|[${x},${y},${z}]`);
    inputBlock.setPermutation(inputBlock.permutation.withState("utilitycraft:active", 0));
  });

  entity.setDynamicProperty("dorios:rateSpeed", 0);
  entity.setDynamicProperty("dorios:bounds", undefined);
  entity.setDynamicProperty("dorios:state", "off");

  if (emptyBlocksConfig) {
    emptyBlocks(entity, emptyBlocksConfig.blockId);
  }

  return entity;
}

export function handleBreakController(block, player, emptyBlocksConfig) {
  const entity = deactivateMultiblock(block, player, emptyBlocksConfig);
  if (!entity) return;

  system.runTimeout(() => entity.remove(), 2);
  return entity;
}
