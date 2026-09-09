import { runtimes } from '../../HeavyCore/runtimes.js';
import { world, ItemStack } from '@minecraft/server';
import * as DoriosLib from 'DoriosLib/index.js';
import { EnergyStorage, GasStorage, InterfaceManager, Multiblock, MultiblockGenerator, registerLinkNodeIO } from 'DoriosCore/index.js';
import { TURBINE_GASES, GAS_TURBINE, getTurbineStructure, getTurbineMaxRate, simulateGasTurbine } from './gasTurbineSimulation.js';
import { ensureTurbineRotor, removeTurbineRotor, setTurbineRotorSpeed } from './gasTurbineRotor.js';
import { syncTurbineGas, removeTurbineGas } from './gasTurbineGas.js';

const STATE_KEY = 'hm:gasTurbine';
const STATS_KEY = 'hm:gasTurbineStructure';
const INTERFACE_ID = 'uc_heavy_machinery:gas_turbine_controls';
const initialState = { version: 2, enabled: false, rate: 1, speed: 0, progress: 0, fuelType: 'empty' };
const config = {
    entity: { identifier: 'utilitycraft:gas_turbine', name: 'gas_turbine', inventory_size: 26 },
    generator: { energy_cap: 1, gas_cap: 1, gas_types: 1, rate_speed_base: 0 },
    multiblock: { transfer_rate_ratio: 20 },
    required_case: 'dorios:multiblock.case.bronze',
    requirements: { energy_cell: { amount: 1, warning: '\u00a7c[Turbine] At least one Energy Cell is required.' } },
    missingEnergyWarning: '\u00a7c[Turbine] At least one Energy Cell is required.',
};

registerLinkNodeIO('utilitycraft:gas_turbine_controller', {
    items: { anyInputSlots: [], anyOutputSlots: [], inputs: [], outputs: [] },
    liquids: { anyInputIndices: [], anyOutputIndices: [], inputs: [], outputs: [] },
    gases: {
        anyInputIndices: [0], anyOutputIndices: [0],
        inputs: [{ id: 'fuel', label: 'Gas Intake', indices: [0] }],
        outputs: [{ id: 'drain', label: 'Drain Gas', indices: [0] }],
    },
});

export function getTurbineState(entity) {
    let data = runtimes.get(entity.id);
    if (data) return data;
    let saved = {}, stats;
    try { saved = JSON.parse(entity.getDynamicProperty(STATE_KEY) ?? '{}') ?? {}; } catch {}
    try { stats = JSON.parse(entity.getDynamicProperty(STATS_KEY) ?? 'null'); } catch {}
    data = { ...initialState, ...saved, stats };
    // Preserve physical RPM when loading the previous multiplier model.
    if (saved.version !== 2) data.speed = Math.max(0, Math.min(1, (saved.speed ?? 0) * (saved.rotorMultiplier ?? 1) * 150 / GAS_TURBINE.rotorRpm));
    data.version = 2;
    delete data.rotorMultiplier;
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
        .replace(/\u00a7./g, '').replace(/ mB\/t$/, '').trim();
}
function writeInput(entity, value) { writeLabel(entity, 6, '\u00a7r\u00a7f' + value + ' mB/t'); }
const keys = { 7: '7', 8: '8', 9: '9', 10: '4', 11: '5', 12: '6', 13: '1', 14: '2', 15: '3', 16: '.', 17: '0' };
const buttons = {
    power: { slot: 5, onPress: ({ entity }) => {
        if (!entity || entity.getDynamicProperty('dorios:state') !== 'on') return;
        const state = getTurbineState(entity); state.enabled = !state.enabled; saveState(entity, state);
    } },
    apply: { slot: 18, onPress: ({ entity }) => {
        if (!entity) return;
        const value = Number(input(entity));
        if (!Number.isFinite(value) || value < 0) return;
        const state = getTurbineState(entity);
        const gas = GasStorage.initializeSingle(entity);
        state.rate = Math.min(value, getTurbineMaxRate(state.stats?.maxRate, gas.getType()));
        saveState(entity, state); writeInput(entity, String(state.rate));
        writeLabel(entity, 23, '\u00a7r\u00a78Current Rate: ' + state.rate.toFixed(2) + ' mB/t');
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
InterfaceManager.linkBlockInterface('utilitycraft:gas_turbine_controller', INTERFACE_ID);
InterfaceManager.linkEntityInterface('utilitycraft:gas_turbine', INTERFACE_ID);
world.afterEvents.entityContainerOpened.subscribe(({ entity }) => {
    if (entity?.typeId === 'utilitycraft:gas_turbine' && !input(entity)) writeInput(entity, String(getTurbineState(entity).rate));
});

// Reserve a clear cylindrical sweep without replacing any interior blocks.
export function hasRotorClearance(dimension, stats) {
    const { min, max } = stats.bounds;
    for (let x = min.x + 1; x < max.x; x++) for (let z = min.z + 1; z < max.z; z++) {
        const dx = Math.max(x - stats.origin.x, 0, stats.origin.x - (x + 1));
        const dz = Math.max(z - stats.origin.z, 0, stats.origin.z - (z + 1));
        if (Math.hypot(dx, dz) >= stats.radius) continue;
        for (let y = min.y + 1; y < max.y; y++) if (dimension.getBlock({ x, y, z })?.typeId !== 'minecraft:air') return false;
    }
    return true;
}

function removeTurbineVisuals(owner) {
    removeTurbineRotor(owner);
    removeTurbineGas(owner);
}

export function activateTurbine({ entity, components, structure, energyCap, player }) {
    removeTurbineVisuals(entity);
    const stats = getTurbineStructure(structure.bounds, components);
    const fail = message => { player?.sendMessage('\u00a7c[Turbine] ' + message); return false; };
    if (stats.error) return fail(stats.error);
    if (!hasRotorClearance(entity.dimension, stats)) return fail('Keep the central rotor space clear. Put Energy Cells in the outer corners.');
    const gas = GasStorage.initializeMultiple(entity, 1)[0];
    if (gas.get() > stats.gasCapacity) return fail('Drain excess gas before reducing the structure size.');
    gas.setCap(stats.gasCapacity);
    entity.setDynamicProperty(STATS_KEY, JSON.stringify(stats));
    runtimes.delete(entity.id);
    entity.setDynamicProperty('dorios:rateSpeed', energyCap / config.multiblock.transfer_rate_ratio);
    const state = getTurbineState(entity);
    state.enabled = false; state.speed = 0; state.rate = Math.min(state.rate, getTurbineMaxRate(stats.maxRate, gas.getType()));
    saveState(entity, state);
    InterfaceManager.ensureEntityInterfaces(entity);
    writeInput(entity, String(state.rate));
    if (ensureTurbineRotor(entity, stats) === null) return fail('Rotor properties are not loaded. Export the BP and reopen the world.');
    syncTurbineGas(entity, stats, gas.getType(), gas.get(), gas.getCap());
    player?.sendMessage('\u00a7a[Turbine] Formed. Gas: ' + GasStorage.formatGas(stats.gasCapacity) + ' | Max rate: ' + getTurbineMaxRate(stats.maxRate, gas.getType()).toFixed(2) + ' mB/t');
}

export function tickTurbine(block) {
    const turbine = new MultiblockGenerator(block, config);
    if (!turbine.valid) return;
    const { entity, energy, processingInterval: ticks } = turbine;
    const state = getTurbineState(entity), stats = state.stats;
    const gas = GasStorage.initializeSingle(entity);
    gas.shouldUpdateUI = turbine.shouldUpdateUI;
    if (entity.getDynamicProperty('dorios:state') !== 'on' || !entity.getDynamicProperty('dorios:bounds') || !stats) {
        removeTurbineVisuals(entity);
        if (turbine.shouldUpdateUI) writeLabel(entity, 1, '\u00a7r\u00a7eUnformed\n\n\u00a7r\u00a7fUse a wrench to scan.');
        return;
    }
    if (ensureTurbineRotor(entity, stats) === null) {
        Multiblock.DeactivationManager.deactivateEntity(entity);
        return;
    }
    turbine.processIO();
    energy.transferToNetwork((entity.getDynamicProperty('dorios:rateSpeed') ?? 0) * ticks);
    const fuelType = gas.getType(), fuel = TURBINE_GASES[fuelType];
    if (fuelType !== state.fuelType) { state.progress = 0; state.fuelType = fuelType; }
    const maxRate = getTurbineMaxRate(stats.maxRate, fuelType);
    state.rate = Math.max(0, Math.min(Number.isFinite(state.rate) ? state.rate : 0, maxRate));
    const amount = gas.get(), space = energy.getFreeSpace();
    const result = simulateGasTurbine({ ticks, enabled: state.enabled, rate: state.rate, maxRate: stats.maxRate,
        speed: state.speed, progress: state.progress, gas: amount, energySpace: space, energyPerMb: fuel?.energy ?? 0, impulse: fuel?.impulse ?? 1 });
    if (result.consumed > 0) { gas.consume(result.consumed); energy.add(result.energy); }
    state.speed = result.speed; state.progress = result.progress;
    saveState(entity, state);
    const rotorSpeed = result.speed;
    setTurbineRotorSpeed(entity, stats, rotorSpeed);
    syncTurbineGas(entity, stats, fuelType, amount - result.consumed, stats.gasCapacity, rotorSpeed);
    if (!turbine.shouldUpdateUI) return;
    const status = !state.enabled ? 'Stopped' : state.rate <= 0 ? 'Rate is zero' : amount <= 0 ? 'No Gas'
        : !fuel ? 'Unsupported Gas' : space < fuel.energy ? 'Energy Full' : result.speed < result.targetSpeed * 0.95 ? 'Starting' : result.speed > result.targetSpeed * 1.05 ? 'Slowing down' : 'Running';
    writeLabel(entity, 1, '\u00a7r\u00a7e' + status + '\n\n\u00a7r\u00a7aRate: \u00a7f' + state.rate.toFixed(2) + ' mB/t\n\u00a7r\u00a7aRotor: \u00a7f' + (rotorSpeed * GAS_TURBINE.rotorRpm).toFixed(0) + ' RPM\n\n\u00a7r\u00a7bProducing: \u00a7f' + EnergyStorage.formatEnergyToText(result.energy / ticks) + '/t\n\u00a7r\u00a7bStored: \u00a7f' + EnergyStorage.formatEnergyToText(energy.get()));
    writeLabel(entity, 22, '\u00a7r\u00a7eGas Information\n\u00a7r\u00a7aType: \u00a7f' + (fuel?.name ?? (amount ? 'Invalid' : 'Empty')) + '\n\u00a7r\u00a7aStored: \u00a7f' + GasStorage.formatGas(gas.get()) + '\n\u00a7r\u00a7aCapacity: \u00a7f' + GasStorage.formatGas(gas.getCap()) + '\n\n\u00a7r\u00a7aMax Rate: \u00a7f' + maxRate.toFixed(2) + ' mB/t\n\u00a7r\u00a7aAir Blocks: \u00a7f' + stats.air);
    writeLabel(entity, 23, '\u00a7r\u00a78Current Rate: ' + state.rate.toFixed(2) + ' mB/t');
    writeLabel(entity, 25, '\u00a7r\u00a78Maximum Rate:\n' + maxRate.toFixed(2) + ' mB/t');
    writeLabel(entity, 4, '\u00a7r\u00a78' + (rotorSpeed * GAS_TURBINE.rotorRpm).toFixed(0) + ' RPM');
    turbine.displayEnergy(); gas.display(2);
}

DoriosLib.registry.blockComponent('utilitycraft:gas_turbine', {
    onPlayerInteract(e) {
        const owner = Multiblock.EntityManager.getControllerEntityFromBlock(e.block);
        const held = DoriosLib.entity.getEquipment(e.player, 'Mainhand')?.typeId ?? '';
        if (held.includes('wrench')) removeTurbineVisuals(owner);
        return MultiblockGenerator.handlePlayerInteract(e, config, { onActivate: activateTurbine });
    },
    onPlayerBreak({ block, player, brokenBlockPermutation }) {
        const owner = Multiblock.EntityManager.getControllerEntityFromBlock(block, brokenBlockPermutation);
        removeTurbineVisuals(owner);
        Multiblock.DeactivationManager.handleBreakController(block, player, undefined, brokenBlockPermutation);
    },
    onTick({ block }) { tickTurbine(block); },
});

// Interior changes also invalidate capacity and rotor clearance. These listeners
// only act on Gas Turbine owners and leave the shared multiblock system untouched.
function invalidateTurbineInterior(block, player) {
    if (!block?.dimension) return;
    for (const owner of block.dimension.getEntities({ type: 'utilitycraft:gas_turbine' })) {
        if (owner.getDynamicProperty('dorios:state') !== 'on') continue;
        const bounds = getTurbineState(owner).stats?.bounds;
        if (!bounds || !['x', 'y', 'z'].every(axis => block.location[axis] >= bounds.min[axis] && block.location[axis] <= bounds.max[axis])) continue;
        removeTurbineVisuals(owner);
        const state = getTurbineState(owner); state.enabled = false; state.speed = 0; saveState(owner, state);
        Multiblock.DeactivationManager.deactivateEntity(owner, player);
    }
}

world.afterEvents.playerBreakBlock.subscribe(({ block, player }) => invalidateTurbineInterior(block, player));
world.afterEvents.playerPlaceBlock.subscribe(({ block, player }) => invalidateTurbineInterior(block, player));
world.afterEvents.blockExplode.subscribe(({ block }) => invalidateTurbineInterior(block));
