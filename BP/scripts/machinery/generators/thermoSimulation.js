import { advanceReactorHeat } from './reactorHeatExchange.js'

/** Thermo-specific balance: HU are independent of DE and the safety thresholds. */
export const THERMO_THERMAL = Object.freeze({
    heatPerLavaUnit: 16,             // HU/mB; multiplied by (2 - efficiency)
    conductorConductance: 0.2,     // HU/(tick K) per conductor
    passiveCoolingFraction: 0.02,
    coolantHeatPerMb: 40,          // HU/mB times coolant efficiency
    baseHeatCapacity: 20,
})

export function getThermoHeatCapacity(bounds, components = {}) {
    let shell = 0
    if (bounds?.min && bounds?.max) {
        const sizes = ['x', 'y', 'z'].map(axis => Math.max(0, bounds.max[axis] - bounds.min[axis] + 1))
        shell = sizes.reduce((v, n) => v * n, 1) - sizes.reduce((v, n) => v * Math.max(0, n - 2), 1)
    }
    let solids = 0
    for (const [id, count] of Object.entries(components)) {
        if (id !== 'air' && id !== 'vent') solids += Math.max(0, count)
    }
    return THERMO_THERMAL.baseHeatCapacity + shell + solids
        + (components.thermo_core ?? 0) * 3 + (components.heat_conductor ?? 0)
}

export function getThermoEfficiency(temperature, config) {
    const normalized = Math.max(0, Math.min(1,
        (temperature - config.ambientTemperatureK) / (config.maximumTemperatureK - config.ambientTemperatureK)))
    const distance = Math.abs(normalized - config.idealTemperatureFraction) / config.idealTemperatureFraction
    const base = Math.max(0, 1 - distance ** config.efficiencyGamma)
    const shape = base ** (normalized < config.idealTemperatureFraction ? config.coldEfficiencyAlpha : config.hotEfficiencyAlpha)
    return config.minimumEfficiency + (config.maximumEfficiency - config.minimumEfficiency) * shape
}

/** Four-tick combustion slices; world storage is read/written only by the caller. */
export function simulateThermoReactor(input, config) {
    input = { ...input, passiveConductance: input.conductance * THERMO_THERMAL.passiveCoolingFraction }
    let temperature = input.temperature, fuel = input.fuel, energySpace = input.energySpace
    let coolantBudget = input.coolantHeatBudget, remaining = input.ticks
    let consumedLava = 0, producedEnergy = 0, coolantHeatRemoved = 0
    let meltdown = temperature >= config.meltdownTemperatureK
    while (remaining > 1e-10 && !meltdown) {
        const efficiency = getThermoEfficiency(temperature, config)
        let duration = remaining, rate = 0
        if (input.running && input.rate > 0 && fuel > 0 && energySpace > 0) {
            rate = input.rate
            duration = Math.min(4, remaining, fuel / rate,
                energySpace / (rate * config.energyPerLavaUnit * efficiency))
        }
        if (duration <= 1e-10) { rate = 0; duration = remaining }
        const result = advanceReactorHeat(temperature, duration,
            rate * THERMO_THERMAL.heatPerLavaUnit * (2 - efficiency), input, coolantBudget, config)
        const burned = Math.min(fuel, rate * result.elapsed)
        const energy = Math.min(energySpace, burned * config.energyPerLavaUnit * efficiency)
        consumedLava += burned
        producedEnergy += energy
        coolantHeatRemoved += result.coolantHeat
        fuel = Math.max(0, fuel - burned)
        energySpace = Math.max(0, energySpace - energy)
        coolantBudget = Math.max(0, coolantBudget - result.coolantHeat)
        temperature = result.temperature
        meltdown = result.meltdown
        remaining = Math.max(0, remaining - result.elapsed)
    }
    return { temperature, consumedLava, producedEnergy, coolantHeatRemoved, meltdown }
}
