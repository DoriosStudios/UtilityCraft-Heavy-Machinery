import { system } from '@minecraft/server';

// UC broadcasts defaults; other addons can add or replace fuels through the same event.
export const solidFuels = [];
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== 'utilitycraft:register_fuel') return;
    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== 'object') return;
        for (const [fuelId, de] of Object.entries(payload)) {
            if (typeof de !== 'number') continue;
            const existing = solidFuels.find(fuel => fuel.id === fuelId);
            if (existing) existing.de = de;
            else solidFuels.push({ id: fuelId, de });
        }
    } catch { }
});

export function findSolidFuel(typeId) {
    // Match the Furnator's ordered wildcard/substring lookup exactly.
    return solidFuels.find(fuel => fuel.id.includes('*')
        ? new RegExp('^' + fuel.id.replace(/\*/g, '.*') + '$').test(typeId)
        : typeId.includes(fuel.id));
}
