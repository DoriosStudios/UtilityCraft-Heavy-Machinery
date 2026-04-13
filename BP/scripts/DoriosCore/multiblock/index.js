/**
 * Public entry point for the DoriosCore multiblock library.
 *
 * Re-exports the main facade and controller runtime class, and loads the global
 * listeners as a side effect.
 */
export { MultiblockManager } from "./multiblock.js";
export { MultiblockMachine } from "./multiblockMachine.js";
export { MultiblockGenerator } from "./multiblockGenerator.js";

import "./listeners.js";
