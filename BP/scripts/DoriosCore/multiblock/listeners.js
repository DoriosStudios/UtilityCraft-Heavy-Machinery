import { world } from "@minecraft/server";
import { getEntityFromBlock } from "./entityManager.js";
import { deactivateMultiblock } from "./deactivationManager.js";

world.afterEvents.playerBreakBlock.subscribe((e) => {
  const { brokenBlockPermutation, block, player } = e;
  const tags = brokenBlockPermutation.getTags();
  const isCase = tags.some((tag) => tag.startsWith("dorios:multiblock.case"));
  if (!isCase) return;

  const entity = getEntityFromBlock(block);
  if (!entity) return;

  deactivateMultiblock(block, player, { blockId: "minecraft:water" });
});

world.afterEvents.blockExplode.subscribe((e) => {
  const { explodedBlockPermutation, block } = e;
  const tags = explodedBlockPermutation.getTags();
  const isCase = tags.some((tag) => tag.startsWith("dorios:multiblock.case"));
  if (!isCase) return;

  const entity = getEntityFromBlock(block);
  if (!entity) return;

  deactivateMultiblock(block, undefined, { blockId: "minecraft:water" });
});
