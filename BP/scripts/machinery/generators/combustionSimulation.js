export const COMBUSTION = { efficiency: 1.25, burnRatePerAirBlock: 128 };

export function getCombustionStats(bounds, components, vents = []) {
    const air = components.air ?? 0;
    const volume = (bounds.max.x - bounds.min.x - 1) * (bounds.max.y - bounds.min.y - 1) * (bounds.max.z - bounds.min.z - 1);
    if (air < 1 || air + (components.energy_cell ?? 0) !== volume) return undefined;
    return { bounds, air, energyCells: components.energy_cell, maxRate: air * COMBUSTION.burnRatePerAirBlock, vents };
}

// One BU is one DE of the original Furnator fuel value, before the 1.25x bonus.
// At most one inventory stack is read/consumed per update; unused fuel stays prepaid.
export function burnSolidFuel({ ticks, rate, reserve, fuelValue = 0, itemCount = 0, energySpace }) {
    const budget = Math.max(0, Math.min(rate * ticks, energySpace / COMBUSTION.efficiency));
    const missing = Math.max(0, budget - reserve);
    const items = fuelValue > 0 ? Math.min(itemCount, Math.ceil(missing / fuelValue)) : 0;
    const available = reserve + items * fuelValue;
    const burned = Math.min(budget, available);
    return { items, burned, reserve: Math.max(0, available - burned), energy: burned * COMBUSTION.efficiency };
}
