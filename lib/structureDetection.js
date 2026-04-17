import { system } from '@minecraft/server';
import * as Constants from './constants';

/* ============================================================
   CONSTANTS
============================================================ */
const {
  MAX_STRUCTURE_SIZE,
  CASING_TAG,
  COMPONENT_TAG,
  CONTROLLER_TAG,
  ENERGY_PORT_TAG,
  GAS_PORT_TAG,
  FLUID_PORT_TAG,
  INPUT_PORT_TAG,
  OUTPUT_PORT_TAG,
} = Constants;

/* ============================================================
   TYPEDEFS
============================================================ */

/**
 * @typedef {Object} Vector3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Bounds
 * @property {Vector3} min
 * @property {Vector3} max
 */

/**
 * @typedef {Object} Ports
 * @property {Vector3[]} energy
 * @property {Vector3[]} gas
 * @property {Vector3[]} fluid
 * @property {Vector3[]} input
 * @property {Vector3[]} output
 */

/**
 * @typedef {Object} MultiblockScanResult
 * @property {Bounds} bounds
 * @property {Object.<string, number>} components
 * @property {Vector3[]} casingBlocks
 * @property {Ports} ports
 */

/**
 * @typedef {Object} StructureDetectionError
 * @property {'invalid_bounds' | 'missing_block' | 'invalid_casing' | 'invalid_interior'} code
 * @property {string} message
 * @property {Vector3} [location]
 * @property {string} [blockTypeId]
 */

/**
 * @typedef {Object} StructureDetectionResult
 * @property {MultiblockScanResult | null} structure
 * @property {StructureDetectionError | null} error
 */

/* ============================================================
   CLASS
============================================================ */

/**
 * StructureDetector
 *
 * Handles cubic multiblock structure detection from a controller block.
 *
 * Detection flow:
 * 1. Resolve the controller face using its facing direction.
 * 2. Find the lower controller column on that face.
 * 3. Walk left/right/up/back from that face to resolve bounds.
 * 4. Validate maximum size (15x15x15).
 * 5. Scan entire volume.
 *    - Outer layer -> must be casing.
 *    - Inner layer -> must be air or component.
 */
export class StructureDetector {
  /**
   * Detects a cubic multiblock structure from a controller block.
   *
   * @async
   * @param {import("@minecraft/server").Block} controllerBlock
   * @param {import("@minecraft/server").Player} [debugPlayer]
   * @returns {Promise<StructureDetectionResult>}
   */
  static async detect(controllerBlock, debugPlayer) {
    const origin = controllerBlock.location;

    const boundsResult = this.findBounds(controllerBlock);
    if (!boundsResult.bounds) {
      this.sendDebug(debugPlayer, boundsResult.error);
      return { structure: null, error: boundsResult.error };
    }

    const scanResult = await this.scanVolume(
      boundsResult.bounds,
      controllerBlock.dimension,
      origin,
      debugPlayer,
    );

    if (!scanResult.structure) {
      this.sendDebug(debugPlayer, scanResult.error);
    }

    return scanResult;
  }

  /**
   * Resolves multiblock bounds from the controller face.
   *
   * Flow:
   * - Follow the controller column downward until casing stops.
   * - From that lower point, walk left/right on the controller face.
   * - Use the left lower corner to expand upward and toward the structure interior.
   *
   * @param {import("@minecraft/server").Block} controllerBlock
   * @returns {{ bounds: Bounds | null, error: StructureDetectionError | null }}
   */
  static findBounds(controllerBlock) {
    const dim = controllerBlock.dimension;
    const origin = controllerBlock.location;
    const isCasingAt = (pos) => dim.getBlock(pos)?.hasTag(CASING_TAG) === true;
    const isControllerAt =
      (pos) => dim.getBlock(pos)?.hasTag(CONTROLLER_TAG) === true;
    const offset = (pos, vector, steps = 1) => ({
      x: pos.x + vector.x * steps,
      y: pos.y + vector.y * steps,
      z: pos.z + vector.z * steps,
    });

    /**
     * Moves while the next position remains valid for a given predicate.
     */
    const walkWhile = (start, vector, predicate) => {
      let current = { ...start };

      for (let i = 0; i < MAX_STRUCTURE_SIZE; i++) {
        const next = offset(current, vector);
        if (!predicate(next)) break;
        current = next;
      }

      return current;
    };

    const facing = controllerBlock.permutation?.getState(
      'minecraft:cardinal_direction',
    );

    if (typeof facing !== 'string') {
      return {
        bounds: null,
        error: this.createError(
          'invalid_bounds',
          'Could not resolve the controller facing direction.',
        ),
      };
    }

    const orientationMap = {
      north: {
        left: { x: -1, y: 0, z: 0 },
        right: { x: 1, y: 0, z: 0 },
        back: { x: 0, y: 0, z: 1 },
      },
      south: {
        left: { x: 1, y: 0, z: 0 },
        right: { x: -1, y: 0, z: 0 },
        back: { x: 0, y: 0, z: -1 },
      },
      east: {
        left: { x: 0, y: 0, z: -1 },
        right: { x: 0, y: 0, z: 1 },
        back: { x: -1, y: 0, z: 0 },
      },
      west: {
        left: { x: 0, y: 0, z: 1 },
        right: { x: 0, y: 0, z: -1 },
        back: { x: 1, y: 0, z: 0 },
      },
    };

    const orientation = orientationMap[facing];
    if (!orientation) {
      return {
        bounds: null,
        error: this.createError(
          'invalid_bounds',
          `Unsupported controller facing direction: ${facing}.`,
        ),
      };
    }

    const faceColumnPredicate = (pos) => {
      if (!isCasingAt(pos)) return false;
      const above = offset(pos, { x: 0, y: 1, z: 0 });
      return isCasingAt(above) || isControllerAt(above);
    };

    // ============================================================
    // STEP 1: Walk down below the controller until the face casing ends
    // ============================================================

    const bottomAnchor = walkWhile(origin, { x: 0, y: -1, z: 0 }, isCasingAt);

    if (!isCasingAt(bottomAnchor)) {
      return {
        bounds: null,
        error: this.createError(
          'invalid_bounds',
          'Could not find the lower multiblock casing below the controller.',
        ),
      };
    }

    // ============================================================
    // STEP 2: Resolve the lower-left and lower-right face bounds
    // ============================================================

    const lowerLeftFront = walkWhile(
      bottomAnchor,
      orientation.left,
      faceColumnPredicate,
    );
    const lowerRightFront = walkWhile(
      bottomAnchor,
      orientation.right,
      faceColumnPredicate,
    );

    if (!isCasingAt(lowerLeftFront) || !isCasingAt(lowerRightFront)) {
      return {
        bounds: null,
        error: this.createError(
          'invalid_bounds',
          'Could not resolve the lower controller face bounds.',
        ),
      };
    }

    // ============================================================
    // STEP 3: Expand upward and toward the structure interior
    // ============================================================

    const upperLeftFront = walkWhile(
      lowerLeftFront,
      { x: 0, y: 1, z: 0 },
      isCasingAt,
    );
    const lowerLeftBack = walkWhile(
      lowerLeftFront,
      orientation.back,
      isCasingAt,
    );

    const width =
      Math.abs(lowerRightFront.x - lowerLeftFront.x) +
      Math.abs(lowerRightFront.z - lowerLeftFront.z) +
      1;
    const height = upperLeftFront.y - lowerLeftFront.y + 1;
    const depth =
      Math.abs(lowerLeftBack.x - lowerLeftFront.x) +
      Math.abs(lowerLeftBack.z - lowerLeftFront.z) +
      1;

    const farCorner = offset(
      offset(
        offset(lowerLeftFront, orientation.right, width - 1),
        { x: 0, y: 1, z: 0 },
        height - 1,
      ),
      orientation.back,
      depth - 1,
    );

    const min = {
      x: Math.min(lowerLeftFront.x, farCorner.x),
      y: Math.min(lowerLeftFront.y, farCorner.y),
      z: Math.min(lowerLeftFront.z, farCorner.z),
    };
    const max = {
      x: Math.max(lowerLeftFront.x, farCorner.x),
      y: Math.max(lowerLeftFront.y, farCorner.y),
      z: Math.max(lowerLeftFront.z, farCorner.z),
    };

    // ============================================================
    // STEP 4: Validate bounds size
    // ============================================================

    const sizeX = max.x - min.x + 1;
    const sizeY = max.y - min.y + 1;
    const sizeZ = max.z - min.z + 1;

    if (
      sizeX > MAX_STRUCTURE_SIZE ||
      sizeY > MAX_STRUCTURE_SIZE ||
      sizeZ > MAX_STRUCTURE_SIZE
    ) {
      return {
        bounds: null,
        error: this.createError(
          'invalid_bounds',
          `Structure is too large. Maximum supported size is ${MAX_STRUCTURE_SIZE}x${MAX_STRUCTURE_SIZE}x${MAX_STRUCTURE_SIZE}.`,
        ),
      };
    }

    return {
      bounds: { min, max },
      error: null,
    };
  }

  /**
   * Scans full cubic volume and validates structure integrity.
   *
   * Detects:
   * - Casing blocks
   * - Components
   * - Energy / Gas / Fluid ports
   *
   * @async
   * @param {Bounds} bounds
   * @param {import("@minecraft/server").Dimension} dim
   * @param {Vector3} controllerPos
   * @param {import("@minecraft/server").Player} [debugPlayer]
   * @returns {Promise<StructureDetectionResult>}
   */
  static async scanVolume(bounds, dim, controllerPos, debugPlayer) {
    const components = {};
    const casingBlocks = [];

    const ports = {
      energy: [],
      gas: [],
      fluid: [],
      input: [],
      output: [],
    };

    for (let y = bounds.min.y; y <= bounds.max.y; y++) {
      for (let x = bounds.min.x; x <= bounds.max.x; x++) {
        for (let z = bounds.min.z; z <= bounds.max.z; z++) {
          const location = { x, y, z };
          const block = dim.getBlock(location);

          if (!block) {
            return {
              structure: null,
              error: this.createError(
                'missing_block',
                `Missing block at ${this.formatCoordinates(location)}.`,
                { location },
              ),
            };
          }

          const isEdge =
            x === bounds.min.x ||
            x === bounds.max.x ||
            y === bounds.min.y ||
            y === bounds.max.y ||
            z === bounds.min.z ||
            z === bounds.max.z;

          const isController =
            x === controllerPos.x &&
            y === controllerPos.y &&
            z === controllerPos.z;

          // ============================================================
          // EDGE VALIDATION
          // ============================================================

          if (isEdge) {
            if (isController) continue;

            if (!block.hasTag(CASING_TAG)) {
              return {
                structure: null,
                error: this.createInvalidBlockError(
                  'invalid_casing',
                  location,
                  block.typeId,
                ),
              };
            }

            casingBlocks.push(location);

            if (block.hasTag(ENERGY_PORT_TAG)) {
              ports.energy.push(location);
            }

            if (block.hasTag(GAS_PORT_TAG)) {
              ports.gas.push(location);
            }

            if (block.hasTag(FLUID_PORT_TAG)) {
              ports.fluid.push(location);
            }

            if (block.hasTag(INPUT_PORT_TAG)) {
              ports.input.push(location);
            }

            if (block.hasTag(OUTPUT_PORT_TAG)) {
              ports.output.push(location);
            }

            continue;
          }

          // ============================================================
          // INTERIOR VALIDATION
          // ============================================================

          if (block.typeId === 'minecraft:air') continue;

          if (block.hasTag(COMPONENT_TAG)) {
            const id = block.typeId.split(':')[1];
            components[id] = (components[id] ?? 0) + 1;
            continue;
          }

          return {
            structure: null,
            error: this.createInvalidBlockError(
              'invalid_interior',
              location,
              block.typeId,
            ),
          };
        }
      }

      await system.waitTicks(1);
    }

    return {
      structure: {
        bounds,
        components,
        casingBlocks,
        ports,
      },
      error: null,
    };
  }

  /**
   * @param {StructureDetectionError['code']} code
   * @param {string} message
   * @param {Partial<StructureDetectionError>} [extra]
   * @returns {StructureDetectionError}
   */
  static createError(code, message, extra = {}) {
    return {
      code,
      message,
      ...extra,
    };
  }

  /**
   * @param {'invalid_casing' | 'invalid_interior'} code
   * @param {Vector3} location
   * @param {string} blockTypeId
   * @returns {StructureDetectionError}
   */
  static createInvalidBlockError(code, location, blockTypeId) {
    const blockLabel = this.formatBlockLabel(blockTypeId);
    const coordinates = this.formatCoordinates(location);

    if (code === 'invalid_casing') {
      return this.createError(
        code,
        `Invalid casing block: ${blockLabel} at ${coordinates}. Expected a valid machine casing or port block.`,
        { location, blockTypeId },
      );
    }

    return this.createError(
      code,
      `Invalid interior block: ${blockLabel} at ${coordinates}. Expected air or a valid machine component.`,
      { location, blockTypeId },
    );
  }

  /**
   * @param {string} typeId
   * @returns {string}
   */
  static formatBlockLabel(typeId) {
    const prettyName = this.formatTypeId(typeId);

    if (!typeId) {
      return 'Unknown Block';
    }

    return prettyName ? `${prettyName} (${typeId})` : typeId;
  }

  /**
   * @param {string} typeId
   * @returns {string}
   */
  static formatTypeId(typeId) {
    const shortId = typeId?.split(':').pop() ?? '';
    if (!shortId) return '';

    return shortId
      .split('_')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  /**
   * @param {Vector3} location
   * @returns {string}
   */
  static formatCoordinates(location) {
    return `(${location.x}, ${location.y}, ${location.z})`;
  }

  /**
   * @param {import("@minecraft/server").Player | undefined} debugPlayer
   * @param {StructureDetectionError | null} error
   */
  static sendDebug(debugPlayer, error) {
    if (!debugPlayer || !error?.message) return;
    debugPlayer.sendMessage(`\u00A7c[Scan Error] ${error.message}`);
  }
}
