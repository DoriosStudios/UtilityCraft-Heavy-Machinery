import { system, world } from '@minecraft/server';

const ROTOR_ID = 'utilitycraft:gas_turbine_rotor';
const ROTOR_KEY = 'hm:turbineRotor';
const OWNER_KEY = 'hm:turbineOwner';
const live = new WeakMap();

export function removeTurbineRotor(owner) {
    if (!owner) return;
    const id = owner.getDynamicProperty(ROTOR_KEY);
    try { if (id) world.getEntity(id)?.remove(); } catch {}
    owner.setDynamicProperty(ROTOR_KEY, undefined);
    live.delete(owner);
}

// Undefined means the center chunk is unavailable; null means the loaded BP
// definition is missing its properties and the controller must deactivate.
export function ensureTurbineRotor(owner, stats) {
    let rotor = live.get(owner);
    if (rotor?.isValid) return rotor;
    const id = owner.getDynamicProperty(ROTOR_KEY);
    try { rotor = id ? world.getEntity(id) : undefined; } catch {}
    if (rotor?.isValid && !hasRotorProperties(rotor)) {
        removeTurbineRotor(owner);
        rotor = undefined;
    }
    if (!rotor?.isValid) {
        try { rotor = owner.dimension.spawnEntity(ROTOR_ID, stats.origin); }
        catch { return undefined; } // Center chunk may be unloaded while its controller is ticking.
    }
    if (!hasRotorProperties(rotor)) {
        rotor.remove();
        owner.setDynamicProperty(ROTOR_KEY, undefined);
        console.warn('[Gas Turbine] Rotor properties are not loaded. Export the BP and reopen the world before forming the turbine again.');
        return null;
    }
    // Publish the owner reference only after the visual has initialized.
    try {
        rotor.setProperty('utilitycraft:height', stats.inner.y);
        rotor.setProperty('utilitycraft:radius', stats.radius);
        rotor.setDynamicProperty(OWNER_KEY, owner.id);
        owner.setDynamicProperty(ROTOR_KEY, rotor.id);
    } catch (error) {
        rotor.remove();
        owner.setDynamicProperty(ROTOR_KEY, undefined);
        console.warn('[Gas Turbine] Could not initialize rotor: ' + error);
        return null;
    }
    live.set(owner, rotor);
    return rotor;
}

function hasRotorProperties(rotor) {
    return typeof rotor.getProperty('utilitycraft:height') === 'number'
        && typeof rotor.getProperty('utilitycraft:radius') === 'number'
        && typeof rotor.getProperty('utilitycraft:speed') === 'number';
}

export function setTurbineRotorSpeed(owner, stats, speed) {
    const rotor = ensureTurbineRotor(owner, stats);
    const value = Math.round(Math.max(0, Math.min(4, speed)) * 1000) / 1000;
    if (rotor && rotor.getProperty('utilitycraft:speed') !== value) rotor.setProperty('utilitycraft:speed', value);
}

// The shared deactivator owns casing/port breaks. Observe its public state so
// visual entities also disappear after deactivation, removal, reload or rescan.
system.runInterval(() => {
    for (const dimensionId of ['overworld', 'nether', 'the_end']) {
        const dimension = world.getDimension(dimensionId);
        for (const rotor of dimension.getEntities({ type: ROTOR_ID })) {
            try {
                const ownerId = rotor.getDynamicProperty(OWNER_KEY);
                const owner = ownerId ? world.getEntity(ownerId) : undefined;
                if (!owner?.isValid || owner.typeId !== 'utilitycraft:gas_turbine'
                    || owner.getDynamicProperty(ROTOR_KEY) !== rotor.id
                    || owner.getDynamicProperty('dorios:state') !== 'on'
                    || !owner.getDynamicProperty('dorios:bounds')) rotor.remove();
            } catch { /* An unloaded entity is checked again when it is available. */ }
        }
    }
}, 20);
