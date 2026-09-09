// Per-gas balance: energy is DE/mB; speedMultiplier scales the rotor RPM,
// independently of the selected mB/t intake rate. Multipliers range from 0 to 4.
export const TURBINE_GASES = Object.freeze({
    steam: Object.freeze({ name: 'Steam', energy: 256, speedMultiplier: 1 }),
    hydrogen_gas: Object.freeze({ name: 'Hydrogen', energy: 1536, speedMultiplier: 0.5 }),
    methane_gas: Object.freeze({ name: 'Methane', energy: 4096, speedMultiplier: 1.25 }),
});

// Machine-local balance. No changes to DoriosCore or the reactor heat model.
export const GAS_TURBINE = Object.freeze({
    gasPerAirBlock: 64000,
    ratePerInteriorBlock: 0.25,
    spinTicks: 40,
    rotorRpm: 120,
});

export function getTurbineStructure(bounds, components) {
    const inner = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, bounds.max[axis] - bounds.min[axis] - 1]));
    if (inner.x < 3 || inner.z < 3 || inner.y < 2) return { error: 'Use at least a 5 x 4 x 5 bronze structure.' };
    if (Object.values(inner).some(n => !Number.isInteger(n) || n > 197)) return { error: 'Invalid turbine dimensions.' };
    if (!(components.energy_cell >= 1)) return { error: 'At least one Energy Cell is required.' };
    const volume = inner.x * inner.y * inner.z;
    const air = components.air ?? 0;
    if (air < 1 || air + components.energy_cell !== volume) return { error: 'The interior accepts only air and Energy Cells.' };
    return {
        bounds, inner, volume, air,
        gasCapacity: air * GAS_TURBINE.gasPerAirBlock,
        maxRate: volume * GAS_TURBINE.ratePerInteriorBlock,
        radius: Math.min(inner.x, inner.z) / 2 - 0.85,
        origin: { x: (bounds.min.x + bounds.max.x + 1) / 2, y: bounds.min.y + 1, z: (bounds.min.z + bounds.max.z + 1) / 2 },
    };
}

// Pure, scheduler-independent startup/coast calculation. Progress never stores
// unpaid energy: only whole mB that fit into storage are converted to DE.
export function simulateGasTurbine({ ticks, enabled, rate, maxRate, speed = 0, progress = 0, gas, energySpace, energyPerMb }) {
    const dt = Math.max(0, Number.isFinite(ticks) ? ticks : 0);
    const flowRate = Math.max(0, Math.min(Number.isFinite(rate) ? rate : 0, maxRate));
    const limit = energyPerMb > 0 ? Math.max(0, Math.min(Math.floor(gas), Math.floor(energySpace / energyPerMb))) : 0;
    const active = enabled && flowRate > 0 && limit > 0;
    const initial = Math.max(0, Math.min(1, speed));
    const previousProgress = Math.max(0, Math.min(0.999999999, progress));
    const integral = t => t + (initial - 1) * GAS_TURBINE.spinTicks * -Math.expm1(-t / GAS_TURBINE.spinTicks);
    let activeTicks = active ? dt : 0;
    let requested = active ? previousProgress + flowRate * integral(dt) : previousProgress;
    // Stop exactly at gas/buffer exhaustion, then coast during the rest of this batch.
    if (active && requested >= limit) {
        let low = 0, high = dt;
        for (let i = 0; i < 36; i++) {
            const middle = (low + high) / 2;
            if (previousProgress + flowRate * integral(middle) >= limit) high = middle;
            else low = middle;
        }
        activeTicks = high;
        requested = limit;
    }
    const consumed = active ? Math.min(limit, Math.floor(requested + 1e-9)) : 0;
    const poweredSpeed = active ? 1 + (initial - 1) * Math.exp(-activeTicks / GAS_TURBINE.spinTicks) : initial;
    const finalSpeed = poweredSpeed * Math.exp(-(dt - activeTicks) / GAS_TURBINE.spinTicks);
    return {
        consumed,
        energy: consumed * (energyPerMb || 0),
        progress: active ? Math.max(0, requested - consumed) : previousProgress,
        speed: finalSpeed < 0.0001 ? 0 : finalSpeed,
        activeTicks,
    };
}
