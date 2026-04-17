import { world } from '@minecraft/server';
import * as beCore from 'bedrock-energistics-core-api';
import * as Constants from './constants';
import { EntityManager } from './entityManager';

/**
 * @type {Record<string, MachineDefinition>}
 */
const machineDefinitions = {};

/**
 * Global flag indicating whether the Minecraft world
 * has fully initialized.
 *
 * This flag becomes `true` only after the
 * `world.afterEvents.worldLoad` event fires.
 *
 * It is used across machine files and registries to:
 *
 * - Prevent premature access to dimension APIs
 * - Avoid dynamic property access before world initialization
 * - Avoid entity lookups before the world is ready
 * - Prevent BE Core registration errors
 *
 * Usage example inside other modules:
 *
 * if (!globalThis.worldLoaded) return;
 *
 * @type {boolean}
 */
globalThis.worldLoaded = false;

/**
 * Subscribes to the world load event and marks
 * the global world state as initialized.
 *
 * After this event:
 * - All machines are registered
 * - Dimension APIs are safe to use
 * - Dynamic properties are safe to access
 */
world.afterEvents.worldLoad.subscribe(() => {
  globalThis.worldLoaded = true;

  beCore.init('modular_energistics');
  registerAllMachines();
});

/**
 * Defines a machine without registering it immediately.
 *
 * This method queues the machine definition internally.
 * The actual registration into Bedrock Energistics Core
 * occurs later inside the `world.afterEvents.worldLoad` handler
 * when `registerAllMachines()` is executed.
 *
 * This ensures:
 * - The world is fully initialized before registration
 * - Dynamic properties are safe to use
 * - Dimension APIs are available
 *
 * Features automatically applied:
 * - Namespace prefixing using {@link Constants.PROJECT_IDENTIFIER}
 * - Universal dynamic storage cap validation
 * - Safe merging of custom `receive` logic with global cap logic
 * - Default `maxStorage` fallback if not provided
 *
 * ⚠ IMPORTANT:
 * The provided `identifier` must NOT include the namespace.
 * The namespace is automatically prefixed internally.
 *
 * Example:
 *   defineMachine('central_battery', { ... })
 *
 * Internally becomes:
 *   modular_energistics:central_battery
 *
 * The `description` object is optional.
 * This allows defining static machines that only require an ID.
 *
 * Example (static machine):
 *   defineMachine('fluid_port', {});
 *
 * @param {string} identifier Machine identifier WITHOUT namespace.
 * @param {MachineDefinition} [definition] Optional machine definition.
 * @returns {void}
 */
export function defineMachine(identifier, definition) {
  if (!definition || typeof definition !== 'object') {
    machineDefinitions[identifier] = {
      description: {
        id: Constants.PROJECT_IDENTIFIER + ':' + identifier,
      },
    };
    return;
  }

  if (machineDefinitions[identifier]) {
    console.warn(`[MachineRegistry] Machine already defined: ${identifier}`);
    return;
  }

  const description = definition.description ?? {};

  // Ensure id consistency
  description.id = Constants.PROJECT_IDENTIFIER + ':' + identifier;

  // Default maxStorage fallback
  if (description.maxStorage == null) {
    description.maxStorage = Constants.STORAGE_CAP_DEFAULT;
  }
  // Default persistentEntity]
  if (description.persistentEntity == null) {
    description.persistentEntity = true;
  }

  /* ============================================================
     STORAGE CAP && UPDATE UI MIDDLEWARE INJECTION
  ============================================================ */

  const originalReceive = definition.handlers?.receive;
  const originalUpdateUi = definition.handlers?.updateUi;

  if (!definition.handlers) {
    definition.handlers = {};
  }

  definition.handlers.receive = function (e) {
    const dimension = e.blockLocation.dimension;
    const block = dimension.getBlock(e.blockLocation);

    const entity = EntityManager.tryGetEntity(block);
    if (!entity) return {};

    let finalAmount;

    // ============================================================
    // GLOBAL CAP LOGIC (UNIVERSAL)
    // ============================================================

    const cap = EntityManager.getStorageCap(entity, e.receiveType);

    if (cap !== undefined) {
      const stored = beCore.getMachineStorage(block, e.receiveType);

      finalAmount = Math.min(e.receiveAmount, Math.max(cap - stored, 0));
    }

    // ============================================================
    // CUSTOM MACHINE LOGIC (OPTIONAL)
    // ============================================================

    if (originalReceive) {
      const customResult = originalReceive(e) ?? {};

      if (customResult.amount !== undefined) {
        finalAmount = customResult.amount;
      }

      return {
        amount: finalAmount,
        handleStorage: customResult.handleStorage,
      };
    }

    if (finalAmount !== undefined) {
      return { amount: finalAmount };
    }

    return {};
  };

  definition.handlers.updateUi = function (e) {
    const dimension = e.blockLocation.dimension;
    const block = dimension.getBlock(e.blockLocation);

    const entity = EntityManager.tryGetEntity(block);
    if (!entity) return {};

    const caps = EntityManager.getStorageCaps(entity);

    let baseResponse = {};

    // ============================================================
    // AUTO STORAGE BAR MAX SYNC
    // ============================================================

    if (description.ui?.elements) {
      const storageBars = {};

      for (const [key, element] of Object.entries(description.ui.elements)) {
        if (element.type !== 'storageBar') continue;

        const storageType = element.defaults?.type;

        if (!storageType) continue;

        const cap = caps[storageType];

        if (cap !== undefined) {
          storageBars[key] = {
            max: cap,
          };
        }
      }

      if (Object.keys(storageBars).length > 0) {
        baseResponse.storageBars = storageBars;
      }
    }

    // ============================================================
    // CUSTOM MACHINE UI LOGIC
    // ============================================================

    if (originalUpdateUi) {
      const customResponse = originalUpdateUi(e) ?? {};

      return {
        ...baseResponse,
        ...customResponse,
        storageBars: {
          ...(baseResponse.storageBars ?? {}),
          ...(customResponse.storageBars ?? {}),
        },
      };
    }

    return baseResponse;
  };

  machineDefinitions[identifier] = definition;
}

/**
 * Registers all defined machines into BE Core.
 */
function registerAllMachines() {
  for (const def of Object.values(machineDefinitions)) {
    beCore.registerMachine(def);
  }
}

// #region TypeDefs
/* ============================================================
   TYPEDEFS (Local mirror of BE Core)
============================================================ */

/**
 * @typedef {Object} UiStorageBarElementUpdateOptions
 * @property {string} [type]
 * @property {string} [label]
 * @property {number} [max]
 * @property {any} [textureOverride]
 */

/**
 * @typedef {Object} UiStorageBarElementDefinition
 * @property {"storageBar"} type
 * @property {number} startIndex
 * @property {number} [size]
 * @property {UiStorageBarElementUpdateOptions} [defaults]
 */

/**
 * @typedef {Object} UiItemSlotElementDefinition
 * @property {"itemSlot"} type
 * @property {number} index
 * @property {string[]} [allowedItems]
 * @property {string} [emptyItemId]
 */

/**
 * @typedef {Object} UiProgressIndicatorElementDefinition
 * @property {"progressIndicator"} type
 * @property {any} indicator
 * @property {number} index
 */

/**
 * @typedef {Object} UiButtonElementUpdateOptions
 * @property {string} [itemId]
 * @property {string} [name]
 */

/**
 * @typedef {Object} UiButtonElementDefinition
 * @property {"button"} type
 * @property {number} index
 * @property {UiButtonElementUpdateOptions} [defaults]
 */

/**
 * @typedef {UiStorageBarElementDefinition
 * | UiItemSlotElementDefinition
 * | UiProgressIndicatorElementDefinition
 * | UiButtonElementDefinition} UiElementDefinition
 */

/**
 * @typedef {Object} UiOptions
 * @property {Record<string, UiElementDefinition>} elements
 */

/**
 * @typedef {Object} MachineDefinitionDescription
 * @property {string} id
 * @property {string} [entityId]
 * @property {boolean} [persistentEntity]
 * @property {number} [maxStorage]
 * @property {UiOptions} [ui]
 */

/**
 * @typedef {Object} MachineReceiveHandlerArg
 * @property {any} blockLocation
 * @property {string} receiveType
 * @property {number} receiveAmount
 */

/**
 * @typedef {Object} MachineUpdateUiHandlerArg
 * @property {any} blockLocation
 * @property {string} entityId
 */

/**
 * @typedef {Object} MachineUpdateUiHandlerResponse
 * @property {Record<string, UiStorageBarElementUpdateOptions>} [storageBars]
 * @property {Record<string, number>} [progressIndicators]
 * @property {Record<string, UiButtonElementUpdateOptions>} [buttons]
 */

/**
 * @typedef {Object} RecieveHandlerResponse
 * @property {number} [amount]
 * @property {boolean} [handleStorage]
 */

/**
 * @typedef {Object} MachineDefinitionHandlers
 * @property {(arg: MachineReceiveHandlerArg) => RecieveHandlerResponse} [receive]
 * @property {(arg: MachineUpdateUiHandlerArg) => MachineUpdateUiHandlerResponse} [updateUi]
 */

/**
 * @typedef {Object} MachineDefinition
 * @property {MachineDefinitionDescription} description
 * @property {MachineDefinitionHandlers} [handlers]
 * @property {Object} [events]
 */
// #endregion
