/* ============================================================
   MULTIBLOCK SYSTEM CONSTANTS
============================================================ */

export const ENERGY_PER_CELL = 8_000;
export const FLUID_PER_CELL = 2_000;

export const PROJECT_IDENTIFIER = 'modular_energistics';

/**
 * Dynamic property key used to store per-type storage caps.
 *
 * Stored as JSON string:
 * {
 *   energy: number,
 *   lava: number,
 *   water: number,
 *   ...
 * }
 *
 * @constant
 * @type {string}
 */
export const STORAGE_PROPERTY_ID = 'modular_energistics:storage_caps';

/**
 * Default fallback cap if a type is requested but not defined.
 *
 * @constant
 * @type {number}
 */
export const STORAGE_CAP_DEFAULT = 1e8;

/**
 * Maximum allowed cubic size of a multiblock structure.
 *
 * The structure must be NxNxN and cannot exceed this value.
 * Used during bounds detection to prevent excessive scanning.
 *
 * @constant
 * @type {number}
 */
export const MAX_STRUCTURE_SIZE = 15;

/**
 * Block tag used to identify valid casing blocks
 * forming the outer shell of a multiblock.
 *
 * @constant
 * @type {string}
 */
export const CASING_TAG = 'modular_energistics:case.default';

/**
 * Block tag used to identify valid interior components
 * inside a multiblock structure.
 *
 * Components contribute to structure behavior
 * (energy, processing, storage, etc).
 *
 * @constant
 * @type {string}
 */
export const COMPONENT_TAG = 'modular_energistics:component';

/**
 * Block tag used to identify energy port blocks
 * embedded in the multiblock casing.
 *
 * These ports are connected to the Energistics network
 * during activation.
 *
 * @constant
 * @type {string}
 */
export const ENERGY_PORT_TAG = 'modular_energistics:port.energy';

/**
 * Block tag used to identify gas port blocks
 * embedded in the multiblock casing.
 *
 * @constant
 * @type {string}
 */
export const GAS_PORT_TAG = 'modular_energistics:port.gas';

/**
 * Block tag used to identify fluid port blocks
 * embedded in the multiblock casing.
 *
 * @constant
 * @type {string}
 */
export const FLUID_PORT_TAG = 'modular_energistics:port.fluid';

/**
 * Block tag used to identify input item ports
 * embedded in the multiblock casing.
 *
 * @constant
 * @type {string}
 */
export const INPUT_PORT_TAG = 'modular_energistics:port.input';

/**
 * Block tag used to identify output item ports
 * embedded in the multiblock casing.
 *
 * @constant
 * @type {string}
 */
export const OUTPUT_PORT_TAG = 'modular_energistics:port.output';

/**
 * Block tag used to identify controller blocks
 * responsible for activating and managing multiblocks.
 *
 * @constant
 * @type {string}
 */
export const CONTROLLER_TAG = 'modular_energistics:multiblock_controller';

/**
 * Entity family assigned to multiblock controller entities.
 *
 * Used when searching nearby controllers during
 * automatic deactivation checks.
 *
 * @constant
 * @type {string}
 */
export const CONTROLLER_FAMILY = 'modular_energistics:multiblock';

/**
 * Dynamic property key used to store multiblock bounding data.
 *
 * ⚠ Legacy usage:
 * Previously used to store bounds independently.
 * Superseded by STRUCTURE_PROPERTY.
 *
 * Kept for backward compatibility or migration support.
 *
 * @constant
 * @type {string}
 */
export const BOUNDS_PROPERTY = 'modular_energistics:bounds';

/**
 * Dynamic property key used to store current multiblock state.
 *
 * Example values:
 * - "formed"
 * - "invalid"
 *
 * @constant
 * @type {string}
 */
export const STATE_PROPERTY = 'modular_energistics:state';

/**
 * Maximum radius used when searching for nearby controller
 * entities during casing break detection.
 *
 * Ensures detection remains bounded and performant.
 *
 * @constant
 * @type {number}
 */
export const MAX_STRUCTURE_RADIUS = MAX_STRUCTURE_SIZE + 10;

/**
 * Dynamic property key used to store full multiblock structure data.
 *
 * Structure format:
 * {
 *   bounds: { min, max },
 *   components: { id: count },
 *   ports: {
 *     energy: Vector3[],
 *     gas: Vector3[],
 *     fluid: Vector3[]
 *   }
 * }
 *
 * This is the primary metadata storage key for controller entities.
 *
 * @constant
 * @type {string}
 */
export const STRUCTURE_PROPERTY = 'modular_energistics:structure';

/**
 * Dynamic property key used to store linked input/output containers.
 *
 * Format:
 * {
 *   input: Vector3[],
 *   output: Vector3[]
 * }
 *
 * @constant
 * @type {string}
 */
export const CONTAINER_REGISTRY_PROPERTY =
  'modular_energistics:linked_containers';
