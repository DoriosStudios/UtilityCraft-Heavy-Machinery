import { world, system, ItemStack } from '@minecraft/server';
import * as DoriosLib from 'DoriosLib/index.js';
import { EnergyStorage, InterfaceManager, Multiblock, MultiblockGenerator, registerLinkNodeIO } from 'DoriosCore/index.js';
import { runtimes } from '../../HeavyCore/runtimes.js';
import { solidFuels, findSolidFuel } from '../../config/recipes/solidFuels.js';
import { COMBUSTION, getCombustionStats, burnSolidFuel } from './combustionSimulation.js';

const STATE_KEY = 'hm:combustionChamber';
const STATS_KEY = 'hm:combustionStructure';
const INTERFACE_ID = 'uc_heavy_machinery:combustion_controls';
const initialState = { enabled: false, rate: 1, reserve: 0, fuelValue: 0, fuelType: 'empty' };
const config = {
    entity: { identifier: 'utilitycraft:combustion_chamber', name: 'combustion_chamber', inventory_size: 26 },
    generator: { energy_cap: 1, rate_speed_base: 0 },
    multiblock: { transfer_rate_ratio: 20 },
    required_case: 'dorios:multiblock.case.bronze',
    requirements: {
        energy_cell: { amount: 1, warning: '\u00a7c[Combustion] At least one Energy Cell is required.' },
        vent: { amount: 1, warning: '\u00a7c[Combustion] At least one vent in the roof is required.' },
    },
    missingEnergyWarning: '\u00a7c[Combustion] At least one Energy Cell is required.',
};
registerLinkNodeIO('utilitycraft:combustion_chamber_controller', {
    items: { anyInputSlots: [21], anyOutputSlots: [], inputs: [{ id: 'fuel', label: 'Fuel', slots: [21] }], outputs: [] },
    liquids: { anyInputIndices: [], anyOutputIndices: [], inputs: [], outputs: [] },
    gases: { anyInputIndices: [], anyOutputIndices: [], inputs: [], outputs: [] },
});

export function getCombustionData(entity) {
    let data = runtimes.get(entity.id);
    if (data) return data;
    let saved = {}, stats = {};
    try { saved = JSON.parse(entity.getDynamicProperty(STATE_KEY) ?? '{}') ?? {}; } catch {}
    try { stats = JSON.parse(entity.getDynamicProperty(STATS_KEY) ?? '{}') ?? {}; } catch {}
    data = { ...initialState, ...saved, ...stats, nextSmokeTick: 0 };
    runtimes.set(entity.id, data);
    return data;
}
function saveState(entity, state) {
    const saved = {};
    for (const key of Object.keys(initialState)) saved[key] = state[key];
    const raw = JSON.stringify(saved);
    if (entity.getDynamicProperty(STATE_KEY) !== raw) entity.setDynamicProperty(STATE_KEY, raw);
}
function writeLabel(entity, slot, text) {
    const inventory = entity.getComponent('minecraft:inventory')?.container;
    if (!inventory || inventory.getItem(slot)?.nameTag === text) return;
    const item = inventory.getItem(slot) ?? new ItemStack('utilitycraft:arrow_right_0');
    item.nameTag = text;
    inventory.setItem(slot, item);
}
function input(entity) {
    return (entity.getComponent('minecraft:inventory')?.container?.getItem(6)?.nameTag ?? '')
        .replace(/\u00a7./g, '').replace(/ BU\/t$/, '').trim();
}
function writeInput(entity, value) { writeLabel(entity, 6, '\u00a7r\u00a7f' + value + ' BU/t'); }
const keys = { 7: '7', 8: '8', 9: '9', 10: '4', 11: '5', 12: '6', 13: '1', 14: '2', 15: '3', 16: '.', 17: '0' };
const buttons = {
    power: { slot: 5, onPress: ({ entity }) => {
        if (!entity || entity.getDynamicProperty('dorios:state') !== 'on') return;
        const state = getCombustionData(entity); state.enabled = !state.enabled; saveState(entity, state);
    } },
    apply: { slot: 18, onPress: ({ entity }) => {
        if (!entity) return;
        const value = Number(input(entity));
        if (!Number.isFinite(value) || value < 0) return;
        const state = getCombustionData(entity);
        state.rate = Math.min(value, state.maxRate ?? 0);
        saveState(entity, state); writeInput(entity, String(state.rate));
        writeLabel(entity, 23, '\u00a7r\u00a78Current Rate: ' + state.rate.toFixed(2) + ' BU/t');
    } },
    clear: { slot: 19, onPress: ({ entity }) => { if (entity) writeInput(entity, ''); } },
    delete: { slot: 20, onPress: ({ entity }) => { if (entity) writeInput(entity, input(entity).slice(0, -1)); } },
};
for (const [slot, character] of Object.entries(keys)) buttons['key_' + slot] = { slot: Number(slot), onPress: ({ entity }) => {
    if (!entity) return;
    const value = input(entity);
    if (value.length < 7 && (character !== '.' || !value.includes('.'))) writeInput(entity, value + character);
} };
InterfaceManager.registerInterface(INTERFACE_ID, { buttons });
InterfaceManager.linkBlockInterface('utilitycraft:combustion_chamber_controller', INTERFACE_ID);
InterfaceManager.linkEntityInterface('utilitycraft:combustion_chamber', INTERFACE_ID);
world.afterEvents.entityContainerOpened.subscribe(({ entity }) => {
    if (entity?.typeId === 'utilitycraft:combustion_chamber' && !input(entity)) writeInput(entity, String(getCombustionData(entity).rate));
});


export function activateCombustion({ entity, components, structure, energyCap, player }) {
    const stats = getCombustionStats(structure.bounds, components, structure.ventBlocks);
    if (!stats) { player?.sendMessage('\u00a7c[Combustion] The interior accepts only empty space and Energy Cells.'); return false; }
    entity.setDynamicProperty(STATS_KEY, JSON.stringify(stats));
    entity.setDynamicProperty('dorios:rateSpeed', energyCap / config.multiblock.transfer_rate_ratio);
    runtimes.delete(entity.id);
    const data = getCombustionData(entity);
    data.enabled = false; data.rate = Math.min(data.rate, data.maxRate);
    saveState(entity, data);
    InterfaceManager.ensureEntityInterfaces(entity);
    writeInput(entity, String(data.rate));
    player?.sendMessage('\u00a7a[Combustion] Formed. Max rate: ' + data.maxRate + ' BU/t | Efficiency: 125%');
}

export function tickCombustion(block) {
    const machine = new MultiblockGenerator(block, config);
    if (!machine.valid) return;
    const { entity, energy, container, processingInterval: ticks } = machine;
    const data = getCombustionData(entity);
    const formed = entity.getDynamicProperty('dorios:state') === 'on' && !!entity.getDynamicProperty('dorios:bounds') && data.maxRate > 0;
    let producing = 0, status = 'Unformed - use a wrench';
    if (formed) {
        energy.transferToNetwork((entity.getDynamicProperty('dorios:rateSpeed') ?? 0) * ticks);
        data.rate = Math.max(0, Math.min(data.rate, data.maxRate));
        status = !data.enabled ? 'Stopped' : data.rate <= 0 ? 'Rate is zero' : energy.getFreeSpace() <= 0 ? 'Energy Full' : 'No Fuel';
        if (data.enabled && data.rate > 0 && energy.getFreeSpace() > 0) {
            const needed = Math.min(data.rate * ticks, energy.getFreeSpace() / COMBUSTION.efficiency);
            const item = needed > data.reserve ? container.getItem(21) : undefined;
            const fuel = item && findSolidFuel(item.typeId);
            const fuelValue = Number.isFinite(fuel?.de) && fuel.de > 0 ? fuel.de : 0;
            const result = burnSolidFuel({ ticks, rate: data.rate, reserve: data.reserve, fuelValue, itemCount: item?.amount ?? 0, energySpace: energy.getFreeSpace() });
            if (result.items > 0) {
                const remaining = item.amount - result.items;
                if (remaining) { item.amount = remaining; container.setItem(21, item); }
                else container.setItem(21, undefined);
                data.fuelValue = fuelValue; data.fuelType = item.typeId;
            }
            data.reserve = result.reserve;
            if (result.energy > 0) { energy.add(result.energy); producing = result.energy / ticks; status = 'Running'; }
            else if (!solidFuels.length) status = 'Waiting for UtilityCraft fuels';
            else if (item && !fuelValue) status = 'Invalid Fuel';
            if (producing > 0 && system.currentTick >= data.nextSmokeTick) {
                const vent = data.vents?.[Math.floor(Math.random() * data.vents.length)];
                if (vent) try { entity.dimension.spawnParticle('minecraft:campfire_tall_smoke_particle', { x: vent.x + .5, y: vent.y + 1, z: vent.z + .5 }); } catch {}
                const count = data.rate >= data.maxRate / 2 ? 5 : 3;
                const { min, max } = data.bounds;
                // Emit a few flames anywhere inside the chamber.
                for (let index = 0; index < count; index++) {
                    const position = {
                        x: min.x + 1.15 + Math.random() * (max.x - min.x - 1.3),
                        y: min.y + 1.15 + Math.random() * (max.y - min.y - 1.3),
                        z: min.z + 1.15 + Math.random() * (max.z - min.z - 1.3),
                    };
                    try {
                        entity.dimension.spawnParticle('minecraft:basic_flame_particle', position);
                    } catch {}
                }
                data.nextSmokeTick = system.currentTick + 20;
            }
        }
        saveState(entity, data);
    }
    if (!machine.shouldUpdateUI) return;
    const format = EnergyStorage.formatEnergyToText;
    writeLabel(entity, 1, '\u00a7r\u00a7e' + status + '\n\n\u00a7r\u00a7aRate: \u00a7f' + data.rate.toFixed(2) + ' BU/t\n\u00a7r\u00a7aEfficiency: \u00a7f125%\n\n\u00a7r\u00a7bProducing: \u00a7f' + format(producing) + '/t\n\u00a7r\u00a7bStored: \u00a7f' + format(energy.get()));
    const fuelName = data.fuelType === 'empty' ? 'Empty' : DoriosLib.text.formatIdentifier(data.fuelType.split(':').pop());
    writeLabel(entity, 22, '\u00a7r\u00a7eFuel Information\n\u00a7r\u00a7aType: \u00a7f' + fuelName + '\n\u00a7r\u00a7aRemaining: \u00a7f' + format(data.reserve * COMBUSTION.efficiency) + '\n\n\u00a7r\u00a7eChamber\n\u00a7r\u00a7aAir Blocks: \u00a7f' + (data.air ?? 0) + '\n\u00a7r\u00a7aMax Rate: \u00a7f' + (data.maxRate ?? 0) + ' BU/t');
    writeLabel(entity, 4, '\u00a7r\u00a78125%');
    writeLabel(entity, 23, '\u00a7r\u00a78Current Rate: ' + data.rate.toFixed(2) + ' BU/t');
    writeLabel(entity, 25, '\u00a7r\u00a78Maximum Rate:\n' + (data.maxRate ?? 0) + ' BU/t');
    const frame = data.fuelValue > 0 ? Math.floor(Math.min(1, data.reserve / data.fuelValue) * 13) : 0;
    const typeId = 'utilitycraft:fuel_bar_' + frame;
    const nameTag = '\u00a7r\u00a78Remaining Fuel:\n' + format(data.reserve * COMBUSTION.efficiency);
    const previous = container.getItem(2);
    if (previous?.typeId !== typeId || previous?.nameTag !== nameTag) { const item = new ItemStack(typeId); item.nameTag = nameTag; container.setItem(2, item); }
    machine.displayEnergy();
}

DoriosLib.registry.blockComponent('utilitycraft:combustion_chamber', {
    onPlayerInteract(e) { return MultiblockGenerator.handlePlayerInteract(e, config, { onActivate: activateCombustion }); },
    onPlayerBreak({ block, player, brokenBlockPermutation }) {
        const entity = Multiblock.EntityManager.getControllerEntityFromBlock(block, brokenBlockPermutation);
        const item = entity?.getComponent('inventory')?.container?.getItem(21);
        if (item && player && DoriosLib.player.isSurvival(player)) block.dimension.spawnItem(item, block.center());
        Multiblock.DeactivationManager.handleBreakController(block, player, undefined, brokenBlockPermutation);
    },
    onTick({ block }) { tickCombustion(block); },
});

// Interior edits invalidate the size-derived rate until the next wrench scan.
function invalidateCombustion(block, player) {
    if (!block?.dimension) return;
    for (const entity of block.dimension.getEntities({ type: 'utilitycraft:combustion_chamber' })) {
        if (entity.getDynamicProperty('dorios:state') !== 'on') continue;
        const data = getCombustionData(entity), bounds = data.bounds;
        if (!bounds || !['x','y','z'].every(axis => block.location[axis] >= bounds.min[axis] && block.location[axis] <= bounds.max[axis])) continue;
        data.enabled = false; saveState(entity, data);
        Multiblock.DeactivationManager.deactivateEntity(entity, player);
    }
}
world.afterEvents.playerBreakBlock.subscribe(({ block, player }) => invalidateCombustion(block, player));
world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => invalidateCombustion(block, player));
world.afterEvents.blockExplode.subscribe(({ block }) => invalidateCombustion(block));
