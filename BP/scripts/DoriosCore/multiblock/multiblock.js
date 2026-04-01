import { activateMultiblock, calculateEnergyCapacity, fillBlocks } from "./activationManager.js";
import { deactivateMultiblock, emptyBlocks, handleBreakController } from "./deactivationManager.js";
import { getCenter, getEntityFromBlock, getVolume } from "./entityManager.js";
import {
  detectFromController,
  findMultiblockBounds,
  scanStructure,
  showFormationEffect,
} from "./structureDetection.js";

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
