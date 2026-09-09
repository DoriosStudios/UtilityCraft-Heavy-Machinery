import { advanceReactorHeat } from './reactorHeatExchange.js'

/** Nuclear balance only; DoriosCore knows nothing about these coefficients. */
export const NUCLEAR_THERMAL = Object.freeze({
    heatPerFuelUnit: 100,              // HU/FU at nominal load
    conductorConductance: 1 / 15,     // HU/(tick K) per conductor with coolant
    passiveCoolingFraction: 0.02,
    coolantHeatPerMb: 200,            // HU/mB, multiplied by coolant efficiency
    baseHeatCapacity: 20,             // HU/K
    casingHeatCapacity: 1,            // HU/K per shell block
    componentHeatCapacity: 1,         // HU/K per internal solid
    assemblyHeatCapacity: 4,          // total HU/K per fuel assembly
    conductorHeatCapacity: 2,         // total HU/K per heat conductor
})

/** Shell plus counted solid components; air and pre-existing liquids add no mass. */
export function getNuclearHeatCapacity(bounds, components = {}) {
    let shell = 0
    if (bounds?.min && bounds?.max) {
        const lengths = ['x', 'y', 'z'].map(axis => Math.max(0, bounds.max[axis] - bounds.min[axis] + 1))
        shell = lengths.reduce((a, n) => a * n, 1)
            - lengths.reduce((a, n) => a * Math.max(0, n - 2), 1)
    }
    let solids = 0
    for (const [id, count] of Object.entries(components)) {
        if (id !== 'air' && id !== 'vent') solids += Math.max(0, count)
    }
    return NUCLEAR_THERMAL.baseHeatCapacity + shell * NUCLEAR_THERMAL.casingHeatCapacity
        + solids * NUCLEAR_THERMAL.componentHeatCapacity
        + (components.fuel_assemblies ?? 0) * (NUCLEAR_THERMAL.assemblyHeatCapacity - NUCLEAR_THERMAL.componentHeatCapacity)
        + (components.heat_conductor ?? 0) * (NUCLEAR_THERMAL.conductorHeatCapacity - NUCLEAR_THERMAL.componentHeatCapacity)
}

export function getNuclearEfficiency(temperature, config) {
    const normalized = Math.max(0, Math.min(1,
        (temperature - config.ambientTemperatureK) / (config.maximumTemperatureK - config.ambientTemperatureK)))
    const ideal = config.idealTemperatureFraction
    const distance = Math.abs(normalized - ideal) / ideal
    const base = Math.max(0, 1 - distance ** config.efficiencyGamma)
    const shape = normalized < ideal ? base ** config.coldEfficiencyAlpha : base ** config.hotEfficiencyAlpha
    return config.minimumEfficiency + (config.maximumEfficiency - config.minimumEfficiency) * shape
}

/**
 * In-memory nuclear update. Internal four-tick burn slices make temperature-driven
 * efficiency identical for the 4/20/40/80-tick scheduler profiles. Off/starved
 * cooling is integrated in one step. No inventory, scoreboard or entity access.
 * Resource exhaustion and meltdown split a slice instead of borrowing resources.
 */
export function simulateNuclearReactor(input, config) {
    input = { ...input, passiveConductance: input.conductance * NUCLEAR_THERMAL.passiveCoolingFraction }
    let temperature = input.temperature
    let fuel = input.fuel, energySpace = input.energySpace, wasteSpace = input.wasteSpace
    let coolantBudget = input.coolantHeatBudget
    let remaining = input.ticks, consumedFuel = 0, producedEnergy = 0, removedHeat = 0
    let meltdown = temperature >= config.meltdownTemperatureK
    while (remaining > 1e-10 && !meltdown) {
        const efficiency = getNuclearEfficiency(temperature, config) * input.fuelEfficiency
        const canBurn = input.running && input.rate > 0 && fuel > 0 && energySpace > 0
            && wasteSpace > 0 && efficiency > 0
        let duration = remaining, burnRate = 0
        if (canBurn) {
            burnRate = input.rate
            duration = Math.min(4, remaining, fuel / burnRate,
                energySpace / (burnRate * config.energyPerFuelUnit * efficiency),
                wasteSpace / (burnRate * config.wasteMbPerFuelUnit))
        }
        if (duration <= 1e-10) {
            // Sub-floating-point resource residue must not keep a running loop alive.
            burnRate = 0
            duration = remaining
        }
        const load = input.nominalRate > 0 ? Math.max(1, burnRate / input.nominalRate) : 1
        const thermal = advanceReactorHeat(temperature, duration,
            burnRate * NUCLEAR_THERMAL.heatPerFuelUnit * load, input, coolantBudget, config)
        const burned = Math.min(fuel, burnRate * thermal.elapsed)
        const energy = Math.min(energySpace, burned * config.energyPerFuelUnit * efficiency)
        fuel = Math.max(0, fuel - burned)
        energySpace = Math.max(0, energySpace - energy)
        wasteSpace = Math.max(0, wasteSpace - burned * config.wasteMbPerFuelUnit)
        consumedFuel += burned
        producedEnergy += energy
        removedHeat += thermal.coolantHeat
        coolantBudget = Math.max(0, coolantBudget - thermal.coolantHeat)
        temperature = thermal.temperature
        meltdown = thermal.meltdown
        remaining = Math.max(0, remaining - thermal.elapsed)
    }
    return { temperature, consumedFuel, producedEnergy, coolantHeatRemoved: removedHeat, meltdown }
}
