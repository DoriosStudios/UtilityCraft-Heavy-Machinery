import { system, world } from '@minecraft/server';
import { TURBINE_GAS_VISUALS, DEFAULT_TURBINE_GAS_VISUAL } from './gasTurbineVisuals.js';

const GAS_ID = 'utilitycraft:gas_turbine_gas';
const GAS_KEY = 'hm:turbineGasVisual';
const OWNER_KEY = 'hm:turbineOwner';
const live = new WeakMap();
const visualTypes = Object.keys(TURBINE_GAS_VISUALS);

export function getTurbineGasVisualType(type) {
    return Object.prototype.hasOwnProperty.call(TURBINE_GAS_VISUALS, type) ? type : DEFAULT_TURBINE_GAS_VISUAL;
}

export function getTurbineGasOpacity(type, amount, capacity) {
    const maxOpacity = TURBINE_GAS_VISUALS[getTurbineGasVisualType(type)].maxOpacity;
    if (type === 'empty') return 0;
    if (!(amount > 0) || !(capacity > 0) || !(maxOpacity > 0)) return 0;
    return Math.round(Math.min(1, maxOpacity) * Math.sqrt(Math.min(1, amount / capacity)) * 1000) / 1000;
}

export function removeTurbineGas(owner) {
    if (!owner) return;
    const id = owner.getDynamicProperty(GAS_KEY);
    try { if (id) world.getEntity(id)?.remove(); } catch {}
    owner.setDynamicProperty(GAS_KEY, undefined);
    live.delete(owner);
}

// World visuals update independently of container UI sessions. Opacity is
// quantized so steady tanks do not generate repeated property synchronization.
export function syncTurbineGas(owner, stats, type, amount, capacity, speed = 0) {
    const opacity = getTurbineGasOpacity(type, amount, capacity);
    let cache = live.get(owner);
    if (cache?.disabled || (cache?.retryAt ?? 0) > system.currentTick) return;
    let entity = cache?.entity;
    if (!entity?.isValid) {
        const id = owner.getDynamicProperty(GAS_KEY);
        try { entity = id ? world.getEntity(id) : undefined; } catch {}
        if (!entity?.isValid) {
            if (!opacity) return;
            try { entity = owner.dimension.spawnEntity(GAS_ID, stats.origin); }
            catch { live.set(owner, { retryAt: system.currentTick + 20 }); return; }
        }
        try {
            if (typeof entity.getProperty('utilitycraft:opacity') !== 'number') throw new Error('Gas visual properties are not loaded; reopen the world after exporting the pack.');
            entity.setProperty('utilitycraft:width', stats.inner.x);
            entity.setProperty('utilitycraft:height', stats.inner.y);
            entity.setProperty('utilitycraft:depth', stats.inner.z);
            entity.setDynamicProperty(OWNER_KEY, owner.id);
            owner.setDynamicProperty(GAS_KEY, entity.id);
            cache = { entity, type: entity.getProperty('utilitycraft:gas_type'), opacity: entity.getProperty('utilitycraft:opacity'), speed: entity.getProperty('utilitycraft:speed') };
            live.set(owner, cache);
        } catch (error) {
            try { entity.remove(); } catch {}
            owner.setDynamicProperty(GAS_KEY, undefined);
            live.set(owner, { disabled: true });
            console.warn('[Gas Turbine] ' + error);
            return;
        }
    }
    const visualType = visualTypes.indexOf(getTurbineGasVisualType(type));
    try {
        if (cache.type !== visualType) {
            entity.setProperty('utilitycraft:gas_type', visualType);
            cache.type = visualType;
        }
        if (cache.opacity !== opacity) {
            entity.setProperty('utilitycraft:opacity', opacity);
            cache.opacity = opacity;
        }
        const visualSpeed = Math.round(Math.max(0, Math.min(4, speed)) * 1000) / 1000;
        // Older loaded definitions keep the gas shell until the updated BP is reloaded.
        if (typeof cache.speed === 'number' && cache.speed !== visualSpeed) {
            entity.setProperty('utilitycraft:speed', visualSpeed);
            cache.speed = visualSpeed;
        }
        return entity;
    } catch (error) {
        removeTurbineGas(owner);
        live.set(owner, { disabled: true });
        console.warn('[Gas Turbine] Could not update gas visual: ' + error);
    }
}

// Observe shared multiblock deactivation, unloaded owners and controller removal.
system.runInterval(() => {
    for (const dimensionId of ['overworld', 'nether', 'the_end']) {
        for (const entity of world.getDimension(dimensionId).getEntities({ type: GAS_ID })) {
            try {
                const ownerId = entity.getDynamicProperty(OWNER_KEY);
                const owner = ownerId ? world.getEntity(ownerId) : undefined;
                if (!owner?.isValid || owner.typeId !== 'utilitycraft:gas_turbine'
                    || owner.getDynamicProperty(GAS_KEY) !== entity.id
                    || owner.getDynamicProperty('dorios:state') !== 'on'
                    || !owner.getDynamicProperty('dorios:bounds')) entity.remove();
            } catch { /* Retry when the chunk is available again. */ }
        }
    }
}, 20);
