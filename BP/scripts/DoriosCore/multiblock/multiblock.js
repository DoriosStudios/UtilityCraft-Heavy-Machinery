import { activateMultiblock, calculateEnergyCapacity, fillBlocks } from "./activationManager.js";
import { deactivateMultiblock, emptyBlocks, handleBreakController } from "./deactivationManager.js";
import { getCenter, getEntityFromBlock, getVolume } from "./entityManager.js";
import {
  detectFromController,
  findMultiblockBounds,
  scanStructure,
  showFormationEffect,
} from "./structureDetection.js";

/**
 * Facade object exposing the multiblock helper API.
 *
 * This mirrors the style used by other DoriosCore modules by grouping the
 * low-level helpers behind a single import surface.
 */
export const MultiblockManager = {
  activateMultiblock,
  calculateEnergyCapacity,
  deactivateMultiblock,
  detectFromController,
  emptyBlocks,
  fillBlocks,
  findMultiblockBounds,
  getCenter,
  getEntityFromBlock,
  getVolume,
  handleBreakController,
  scanStructure,
  showFormationEffect,
};
