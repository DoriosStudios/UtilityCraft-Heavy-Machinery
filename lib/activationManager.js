import { system } from '@minecraft/server';
import * as beCore from 'bedrock-energistics-core-api';
import { StructureDetector } from './structureDetection';
import { EntityManager } from './entityManager';
import { registerAdjacentContainersFromStructure } from './handleItemTransport';
import * as Constants from './constants';

/**
 * @typedef {Object} Requirement
 * @property {number} amount Minimum required amount
 * @property {string} [warning] Message shown if requirement is not met (soft requirement)
 */

/**
 * @typedef {Object} MultiblockScanResult
 * @property {Bounds} bounds
 * @property {Object.<string, number>} components
 * @property {Vector3[]} casingBlocks
 * @property {Ports} ports
 */

/**
 * @typedef {Object} MultiblockActivationResult
 * @property {MultiblockScanResult} structure
 * @property {import("@minecraft/server").Entity} entity
 */

/**
 * @typedef {Object.<string, Requirement>} RequirementMap
 */

export class ActivationManager {
  /* ============================================================
     PUBLIC ENTRY POINT
  ============================================================ */

  /**
   * Attempts to detect and activate a multiblock structure.
   *
   * @param {import("@minecraft/server").Block} block
   * @param {import("@minecraft/server").Player} player
   * @param {RequirementMap} requirements
   * @returns {Promise<MultiblockActivationResult | null>}
   */
  static async tryActivate(
    block,
    player,
    requirements = {},
    portConfiguration,
  ) {
    let entity = EntityManager.tryGetEntity(block);
    if (entity) return null;

    const { structure, error } = await StructureDetector.detect(block);
    const PREFIX = '\u00A78[\u00A7bStructure\u00A78]\u00A7r ';

    if (!structure) {
      const reason = error?.message ?? 'Invalid multiblock structure detected.';
      this.send(player, `${PREFIX}\u00A7c${reason}`);
      return null;
    }

    const valid = this.checkRequirements(structure, requirements, player);
    if (!valid) return null;

    entity = EntityManager.getOrSpawnEntity(block);

    if (!entity) {
      this.send(player, `${PREFIX}\u00A7cFailed to create controller entity.`);
      return null;
    }

    EntityManager.storeStructure(entity, structure);

    if (portConfiguration && portConfiguration.energy) {
      this.setEnergyPortMode(block, structure, portConfiguration.energy.mode);
    }

    if (portConfiguration && portConfiguration.fluid) {
      this.setFluidPortMachine(
        block,
        structure,
        portConfiguration.fluid.machine,
      );
    }

    this.setItemPortActivated(block, structure, true);

    await system.waitTicks(5);

    registerAdjacentContainersFromStructure(entity, block, structure);
    this.connectPorts(block, structure);

    this.send(
      player,
      `${PREFIX}\u00A7aMultiblock structure successfully formed.`,
    );

    return { structure, entity };
  }

  /* ============================================================
     REQUIREMENT VALIDATION
  ============================================================ */

  /**
   * Validates structure component requirements.
   *
   * If requirement is not met:
   * - If `warning` exists -> show formatted warning and continue.
   * - If no `warning` -> hard fail and stop activation.
   *
   * Supports placeholders inside warning string:
   * {required}, {current}, {missing}, {id}
   *
   * @param {import("./StructureDetector").MultiblockScanResult} structure
   * @param {RequirementMap} requirements
   * @param {import("@minecraft/server").Player} player
   * @returns {boolean}
   */
  static checkRequirements(structure, requirements, player) {
    const { components } = structure;

    for (const [id, rule] of Object.entries(requirements)) {
      const current = components[id] ?? 0;
      const required = rule.amount;

      if (current < required) {
        const missing = required - current;

        if (rule.warning) {
          const message = rule.warning
            .replace('{id}', id)
            .replace('{required}', required)
            .replace('{current}', current)
            .replace('{missing}', missing);

          this.send(player, message);
          return false;
        }

        this.send(
          player,
          `Requirement not met: ${id} x${required} (current: ${current}, missing: ${missing})`,
        );

        return false;
      }
    }

    return true;
  }

  /* ============================================================
     PORT CONNECTION
  ============================================================ */

  /**
   * Connects detected ports to Energistics network.
   *
   * Does nothing if no ports are present.
   *
   * @param {import("@minecraft/server").Block} block
   * @param {import("./StructureDetector").MultiblockScanResult} structure
   * @returns {void}
   */
  static async connectPorts(block, structure) {
    const { ports } = structure;
    let network;

    try {
      network = await beCore.NetworkLinkNode.get(block);
    } catch {
      return;
    }

    for (const port of ports.energy) {
      network.addConnection(port);
    }
    for (const port of ports.gas) {
      network.addConnection(port);
    }
    for (const port of ports.fluid) {
      network.addConnection(port);
    }
  }

  /**
   * Sets the respective mode for ports.
   *
   * @param {import("@minecraft/server").Block} block
   * @param {import("./StructureDetector").MultiblockScanResult} structure
   * @param {string} mode
   * @returns {void}
   */
  static setEnergyPortMode(block, structure, mode) {
    this.setPortState(block, structure, {
      portGroup: 'energy',
      portTag: Constants.ENERGY_PORT_TAG,
      stateId: 'modular_energistics:mode',
      value: mode,
    });
  }

  /**
   * Sets the respective type for fluid ports.
   *
   * @param {import("@minecraft/server").Block | import("@minecraft/server").Entity} block
   * @param {import("./StructureDetector").MultiblockScanResult} structure
   * @param {string} machine
   * @returns {void}
   */
  static setFluidPortMachine(block, structure, machine) {
    this.setPortState(block, structure, {
      portGroup: 'fluid',
      portTag: Constants.FLUID_PORT_TAG,
      stateId: 'modular_energistics:machine',
      value: machine,
    });
  }

  /**
   * Toggles activated state on input/output ports.
   *
   * @param {import("@minecraft/server").Block | import("@minecraft/server").Entity} block
   * @param {import("./StructureDetector").MultiblockScanResult} structure
   * @param {boolean} activated
   */
  static setItemPortActivated(block, structure, activated) {
    this.setPortState(block, structure, {
      portGroup: 'input',
      portTag: Constants.INPUT_PORT_TAG,
      stateId: 'modular_energistics:activated',
      value: activated,
    });

    this.setPortState(block, structure, {
      portGroup: 'output',
      portTag: Constants.OUTPUT_PORT_TAG,
      stateId: 'modular_energistics:activated',
      value: activated,
    });
  }

  /**
   * Applies a block state to every detected port of a given group.
   *
   * @param {import("@minecraft/server").Block | import("@minecraft/server").Entity} block
   * @param {import("./StructureDetector").MultiblockScanResult} structure
   * @param {{
   *   portGroup: 'energy' | 'gas' | 'fluid' | 'input' | 'output',
   *   portTag: string,
   *   stateId: string,
   *   value: string | boolean
   * }} options
   * @returns {void}
   */
  static setPortState(block, structure, options) {
    const { ports } = structure;
    const targetPorts = ports?.[options.portGroup];

    if (!targetPorts || targetPorts.length === 0) {
      return;
    }

    for (const port of targetPorts) {
      const portBlock = block.dimension.getBlock(port);
      if (portBlock?.hasTag(options.portTag)) {
        const dimLoc = {
          dimension: block.dimension,
          x: port.x,
          y: port.y,
          z: port.z,
        };
        beCore.MachineNetwork.updateAdjacent(dimLoc);
        portBlock.setPermutation(
          portBlock.permutation.withState(options.stateId, options.value),
        );
      }
    }
  }

  /* ============================================================
     UTILITY
  ============================================================ */

  /**
   * Sends message to player if available.
   *
   * @param {import("@minecraft/server").Player} player
   * @param {string} message
   */
  static send(player, message) {
    if (player) player.sendMessage(message);
  }
}
