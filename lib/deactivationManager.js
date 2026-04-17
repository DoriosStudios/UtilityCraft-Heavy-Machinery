import { system, world } from '@minecraft/server';
import * as beCore from 'bedrock-energistics-core-api';
import { EntityManager } from './entityManager';
import { ActivationManager } from './activationManager';
import * as Constants from './constants';

/* ============================================================
   CONSTANTS
============================================================ */
const {
  CASING_TAG,
  CONTROLLER_TAG,
  CONTROLLER_FAMILY,
  BOUNDS_PROPERTY,
  STATE_PROPERTY,
  STRUCTURE_PROPERTY,
  MAX_STRUCTURE_RADIUS,
} = Constants;

// const DEACTIVATE_EVENT = 'modular_energistics:multiblock_deactivate';
// const HIDE_EVENT = 'modular_energistics:hide_controller';

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

/* ============================================================
   CLASS
============================================================ */

/**
 * DeactivationManager
 *
 * Handles automatic deactivation of formed multiblock structures
 * when a casing block is broken or destroyed.
 *
 * Detection Flow:
 * 1. A block is broken or exploded.
 * 2. If the block has the multiblock casing tag:
 *    - Search for nearby controller entities.
 * 3. For each controller:
 *    - Read stored bounds.
 *    - If broken block is inside bounds:
 *         → Deactivate structure.
 *
 * Requirements:
 * - Controller entity must store bounds in dynamic property:
 *     "modular_energistics:bounds"
 * - Controller must belong to family:
 *     "modular_energistics:multiblock"
 *
 * This system does not rescan structure volume.
 * It relies strictly on stored bounds.
 */
export class DeactivationManager {
  /**
   * Checks whether a position is inside given bounds.
   *
   * @param {Vector3} pos
   * @param {Bounds} bounds
   * @returns {boolean}
   */
  static isInsideBounds(pos, bounds) {
    return (
      pos.x >= bounds.min.x &&
      pos.x <= bounds.max.x &&
      pos.y >= bounds.min.y &&
      pos.y <= bounds.max.y &&
      pos.z >= bounds.min.z &&
      pos.z <= bounds.max.z
    );
  }

  /**
   * Handles casing/controller break detection.
   *
   * @param {import("@minecraft/server").PlayerBreakBlockAfterEvent |
   *         import("@minecraft/server").BlockExplodeAfterEvent} event
   */
  static async handleBlockBreak(event) {
    const block = event.block;
    const player = event.player;

    // Detect original permutation
    const permutation =
      event.brokenBlockPermutation ?? event.explodedBlockPermutation;

    if (!block || !permutation) return;

    const wasCasing = permutation.hasTag(CASING_TAG);
    const wasController = permutation.hasTag(CONTROLLER_TAG);

    if (!wasCasing && !wasController) return;

    const dimension = block.dimension;

    if (wasController) {
      const blockLocation = block.location;
      const dimLoc = {
        dimension: dimension,
        x: blockLocation.x,
        y: blockLocation.y,
        z: blockLocation.z,
      };
      removeBlockFromScoreboards(dimLoc);
    }

    const controllers = dimension.getEntities({
      location: block.location,
      maxDistance: MAX_STRUCTURE_RADIUS,
      families: [CONTROLLER_FAMILY],
    });

    for (const controller of controllers) {
      const rawStructure = controller.getDynamicProperty(STRUCTURE_PROPERTY);
      if (!rawStructure) continue;

      let structure;

      try {
        structure = JSON.parse(rawStructure);
      } catch {
        continue;
      }

      const bounds = structure?.bounds;
      if (!bounds) continue;

      if (!this.isInsideBounds(block.location, bounds)) continue;

      this.deactivateStructure(controller, player);
      // beCore.removeMachineData(dimLoc, permutation);
    }
  }

  /**
   * Deactivates a formed multiblock structure.
   *
   * This method:
   * - Disconnects network connections
   * - Destroys controller network node
   * - Clears stored metadata
   * - Updates state to invalid
   *
   * @param {import("@minecraft/server").Entity} controller
   * @param {import("@minecraft/server").Player} player
   * @returns {void}
   */
  static async deactivateStructure(controller, player) {
    if (!controller) return;

    const dimension = controller.dimension;

    const blockLocation = {
      x: Math.floor(controller.location.x),
      y: Math.floor(controller.location.y),
      z: Math.floor(controller.location.z),
    };

    const structure = EntityManager.getStructureData(controller);
    if (structure) {
      ActivationManager.setEnergyPortMode(controller, structure, 'none');
      ActivationManager.setFluidPortMachine(controller, structure, 'none');
      ActivationManager.setItemPortActivated(controller, structure, false);
    }

    EntityManager.resetContainers(controller);

    try {
      const network = beCore.NetworkLinkNode.tryGetAt(dimension, blockLocation);

      if (network) {
        const connections = await network.getConnections();
        await network.destroyNode();
        system.runTimeout(() => {
          connections.forEach((connection) => {
            dimension.getEntitiesAtBlockLocation(connection).forEach((ent) => {
              if (ent.typeId == 'fluffyalien_energisticscore:network_link')
                ent.remove();
            });
          });
        }, 10);
      }
    } catch {
      // safe fail
    }
    player.sendMessage(`§8[§bStructure§8]§r §cStructure deactivated`);
    const dimLoc = {
      dimension: controller.dimension,
      x: blockLocation.x,
      y: blockLocation.y,
      z: blockLocation.z,
    };
    // beCore.removeMachine(dimLoc);
    // removeBlockFromScoreboards(dimLoc);
    controller.remove();
  }
}

/* ============================================================
   EVENT REGISTRATION
============================================================ */

world.afterEvents.playerBreakBlock.subscribe((event) => {
  DeactivationManager.handleBlockBreak(event);
});

world.afterEvents.blockExplode.subscribe((event) => {
  DeactivationManager.handleBlockBreak(event);
});

// TEMPORAL

export function getBlockUniqueId(loc) {
  return (
    Math.floor(loc.x).toString() +
    ',' +
    Math.floor(loc.y).toString() +
    ',' +
    Math.floor(loc.z).toString() +
    ',' +
    loc.dimension.id
  );
}
export function removeBlockFromScoreboards(loc) {
  const participantId = getBlockUniqueId(loc);

  for (const objective of world.scoreboard.getObjectives()) {
    objective.removeParticipant(participantId);
  }
}
