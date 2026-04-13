/**
 * Maximum scan radius used while searching for multiblock casing bounds.
 *
 * This caps how far the detection logic may expand from the controller.
 */
export const MAX_SIZE = 99;

/**
 * Scan pacing value used to yield periodically during structure validation.
 *
 * Higher values reduce yielding frequency, lower values spread the scan across
 * more ticks.
 */
export const SCAN_SPEED = 64;

/**
 * Energy contribution per multiblock component unit.
 *
 * Keys must match multiblock component ids detected during structure scanning.
 */
export const ENERGY_PER_UNIT = {
  energy_cell: 4e6,
  basic_power_condenser_unit: 40e6,
  advanced_power_condenser_unit: 320e6,
  expert_power_condenser_unit: 2.56e9,
  ultimate_power_condenser_unit: 64e9,
};
