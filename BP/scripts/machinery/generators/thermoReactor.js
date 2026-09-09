import { EnergyStorage, FluidStorage, GasStorage, TemperatureStorage, InterfaceManager, Multiblock, MultiblockGenerator, registerLinkNodeIO } from "DoriosCore/index.js"
import { ensureGasIOConfig } from 'DoriosCore/interfaces/gasIO.js'
import * as DoriosLib from "DoriosLib/index.js";
import { system, world } from '@minecraft/server'
import { coolants } from 'config/coolants.js'
import { THERMO_THERMAL, THERMO_COOLANT_OUTPUTS, THERMO_OUTPUT_HEAT, getThermoHeatCapacity, getThermoEfficiency, simulateThermoReactor } from './thermoSimulation.js'
import {
    formatReactorOnTime,
    setReactorRunning,
    spawnReactorVentSmoke,
    synchronizeReactorTimer,
} from './reactorRuntime.js'

// #region Config
const config = {
    ambientTemperatureK: 300,
    maximumTemperatureK: 1273.15, // efficiency/display scale, not a temperature clamp
    meltdownTemperatureK: 1200,
    idealTemperatureFraction: 0.5,
    minimumEfficiency: 0.10,
    maximumEfficiency: 0.80,
    efficiencyGamma: 5,
    coldEfficiencyAlpha: 1.6,
    hotEfficiencyAlpha: 1.2,

    // Settings / Limits
    maxCoreTemperatureK: 1200,       // K

    // Conversion factors
    energyPerLavaUnit: 1500,          // DE/mB

    // Capacities
    coolantCapacityPerEmptyBlock: 64_000, // mB
    exhaustCapacityPerGasCell: 256_000, // mB
    lavaCapacityPerFluidCell: 256_000,   // mB

    initialReactorData: {
        state: 'off',
        rate: 100,
        temperature: 300,
        efficiency: 0.1,
        startedAtMs: 0,
        warning: '',
        lavaCreditMb: 0,
        coolantCreditMb: 0,
        coolantCreditType: 'empty',
        exhaustCreditMb: 0,
        exhaustCreditType: 'empty',
        meltdownPending: false
    }
}

// The scale is visual; safety decisions belong to this reactor.
const CORE_TMIN_K = config.ambientTemperatureK;
const CORE_TCAP_K = config.maximumTemperatureK;
const WARN_OVERHEAT_K = 1000;
const WARN_DANGER_K = config.meltdownTemperatureK;
const runtimeCache = new WeakMap();
const statsCache = new WeakMap();

const COOLANT_TIER = 0
const THERMO_REACTOR_INPUT_SLOT = 6;
const THERMO_REACTOR_INPUT_ITEM = 'utilitycraft:arrow_right_0';
const THERMO_REACTOR_INPUT_MAX_LENGTH = 6;
const THERMO_REACTOR_KEYPAD_BY_SLOT = {
    7: '7',
    8: '8',
    9: '9',
    10: '4',
    11: '5',
    12: '6',
    13: '1',
    14: '2',
    15: '3',
    16: '.',
    17: '0',
};
const THERMO_REACTOR_ACCEPT_SLOT = 18;
const THERMO_REACTOR_CANCEL_SLOT = 19;
const THERMO_REACTOR_DELETE_SLOT = 20;
const GENERATOR_CONFIG = {
    entity: {
        identifier: 'utilitycraft:thermo_reactor',
        name: 'thermo_reactor',
        fixed_fluid_types: true
    },
    generator: {
        energy_cap: 1,
        rate_speed_base: 0,
    },
    multiblock: {
        transfer_rate_ratio: 20,
    },
    required_case: 'dorios:multiblock.case.bronze',
    requirements: {
        gas_cell: { amount: 1, warning: '\u00A7c[Reactor] At least 1 Gas Cell is required.' },
        thermo_core: {
            amount: 1,
            warning: '\u00A7c[Reactor] Missing Thermo Core - reactor cannot operate.',
        },
    },
    deactivateConfig: { blockId: 'minecraft:water' },
    fillBlocksConfig: { blockId: 'minecraft:water' },
    missingEnergyWarning: '\u00A7c[Reactor] At least 1 energy unit is required.',
};

registerLinkNodeIO('utilitycraft:thermo_reactor_controller', {
    gases: {
        anyInputIndices: [], anyOutputIndices: [0], inputs: [],
        outputs: [{ id: 'exhaust', label: 'Heated Gas', color: '\u00A76', indices: [0] }],
    },
    liquids: {
        anyInputIndices: [0, 1],
        anyOutputIndices: [],
        inputs: [
            { id: 'coolant', label: 'Coolant Tank', color: '§b', indices: [0] },
            { id: 'fuel', label: 'Lava Fuel Tank', color: '§v', indices: [1] },
        ],
        outputs: [],
    },
})

// #endregion

const THERMO_REACTOR_INTERFACE_ID = "uc_heavy_machinery:thermo_reactor_controls";
const thermoReactorButtons = {
    power: {
        slot: 5,
        onPress: ({ entity }) => {
            if (!entity) return;
            const data = getReactorInfo(entity);
            if (data.meltdownPending) return;
            setReactorRunning(data, String(data.state).toLowerCase() === "off");
            saveReactorInfo(entity, data);
        },
    },
    accept: {
        slot: THERMO_REACTOR_ACCEPT_SLOT,
        onPress: ({ entity }) => applyThermoReactorBurnRate(entity),
    },
    cancel: {
        slot: THERMO_REACTOR_CANCEL_SLOT,
        onPress: ({ entity }) => resetThermoReactorInput(entity),
    },
    delete: {
        slot: THERMO_REACTOR_DELETE_SLOT,
        onPress: ({ entity }) => deleteThermoReactorInput(entity),
    },
};

for (const slot of Object.keys(THERMO_REACTOR_KEYPAD_BY_SLOT).map(Number)) {
    thermoReactorButtons[`keypad_${slot}`] = {
        slot,
        onPress: ({ entity }) => appendThermoReactorInput(slot, entity),
    };
}

InterfaceManager.registerInterface(THERMO_REACTOR_INTERFACE_ID, { buttons: thermoReactorButtons });
InterfaceManager.linkBlockInterface("utilitycraft:thermo_reactor_controller", THERMO_REACTOR_INTERFACE_ID);
InterfaceManager.linkEntityInterface("utilitycraft:thermo_reactor", THERMO_REACTOR_INTERFACE_ID);
world.afterEvents.entityContainerOpened.subscribe(({ entity }) => {
    if (entity?.typeId !== 'utilitycraft:thermo_reactor') return;
    const item = entity.getComponent('minecraft:inventory')?.container?.getItem(THERMO_REACTOR_INPUT_SLOT);
    if (!(item?.nameTag ?? '').includes('mB/t')) setThermoReactorInputText(entity, String(getReactorInfo(entity).rate));
    else if (item.nameTag.includes('\n')) setThermoReactorInputText(entity, getThermoReactorInputText(entity));
});

DoriosLib.registry.blockComponent('utilitycraft:thermo_reactor', {
    onPlayerInteract(e) {
        return MultiblockGenerator.handlePlayerInteract(e, GENERATOR_CONFIG, {
            initializeEntity(entity) { GasStorage.initializeMultiple(entity, 1) },
            onActivate: ({ entity, components, energyCap, settings, structure, player }) => {
                const [storedGas] = GasStorage.initializeMultiple(entity, 1)
                const gasCells = components.gas_cell ?? 0
                const exhaustCapacity = gasCells * config.exhaustCapacityPerGasCell
                if (storedGas.get() + getReactorInfo(entity).exhaustCreditMb > exhaustCapacity) {
                    player?.sendMessage('\u00A7c[Reactor] Drain the gas tank before reducing its capacity.')
                    return false
                }
                entity.setDynamicProperty(
                    'dorios:rateSpeed',
                    energyCap / settings.multiblock.transfer_rate_ratio
                )
                InterfaceManager.ensureEntityInterfaces(entity)
                const lavaCapacity =
                    (components['fluid_cell'] ?? 0) * config.lavaCapacityPerFluidCell
                const internalVolume = components['air'] ?? 0
                const coolantCapacity = internalVolume * config.coolantCapacityPerEmptyBlock
                const heatDissipation =
                    (components['heat_conductor'] ?? 0) * THERMO_THERMAL.conductorConductance

                entity.setDynamicProperty('reactorStats', JSON.stringify({
                    lavaCapacity,
                    coolantCapacity,
                    exhaustCapacity,
                    gasCells,
                    heatConductors: components.heat_conductor ?? 0,
                    conductance: heatDissipation,
                    heatCapacity: getThermoHeatCapacity(structure.bounds, components),
                    energyCap,
                    bounds: structure.bounds
                }))

                runtimeCache.delete(entity)
                const data = getReactorInfo(entity)
                setReactorRunning(data, false)
                data.meltdownPending = false
                saveReactorInfo(entity, data)
                setThermoReactorInputText(entity, String(data.rate))
                const runtime = getThermoRuntime(entity, data)
                if (runtime.coolant.get() === 0) runtime.coolant.setType('empty')
                if (runtime.lava.getType() === 'empty') runtime.lava.setType('lava')
                ensureGasIOConfig(entity, 'utilitycraft:thermo_reactor_controller')
            },
            successMessages: ({ components, energyCap }) => {
                const lavaCapacity =
                    (components['fluid_cell'] ?? 0) * config.lavaCapacityPerFluidCell
                const internalVolume = components['air'] ?? 0
                const coolantCapacity = internalVolume * config.coolantCapacityPerEmptyBlock
                const heatDissipation =
                    (components['heat_conductor'] ?? 0) * THERMO_THERMAL.conductorConductance

                return [
                    lavaCapacity <= 0 ? '\u00A7e[Warning] No Lava Cells detected.' : '',
                    coolantCapacity <= 0 ? '\u00A7e[Warning] No volume for coolant cooling.' : '',
                    heatDissipation <= 0 ? '\u00A7e[Warning] No Heat Conductors found.' : '',
                    '\u00A7a[Reactor] Thermo Reactor structure validated.',
                    `\u00A77Energy Capacity: \u00A7b${EnergyStorage.formatEnergyToText(energyCap)}`,
                    `\u00A77Lava Capacity: \u00A7b${FluidStorage.formatFluid(lavaCapacity)}`,
                    `\u00A77Coolant Capacity: \u00A7b${FluidStorage.formatFluid(coolantCapacity)}`,
                    `\u00A77Heated Gas Capacity: \u00A7b${GasStorage.formatGas((components.gas_cell ?? 0) * config.exhaustCapacityPerGasCell)}`,
                    `\u00A77Thermal Conductance: \u00A7b${heatDissipation.toFixed(3)} HU/(t K)`,
                    `\u00A77Max Heat: \u00A7b${config.maxCoreTemperatureK} K\u00B0`,
                ]
            },
        })
    },
    onPlayerBreak({ block, brokenBlockPermutation, player }) {
        Multiblock.DeactivationManager.handleBreakController(block, player, GENERATOR_CONFIG.deactivateConfig, brokenBlockPermutation)
    },
    onTick({ block }) {
        if (!worldLoaded) return;
        const reactor = new MultiblockGenerator(block, GENERATOR_CONFIG);
        if (!reactor.valid) return;
        const { entity, energy } = reactor
        reactor.setRate(entity.getDynamicProperty('dorios:rateSpeed') ?? 0)
        energy.transferToNetwork(reactor.rate)
        const data = getReactorInfo(entity)
        const runtime = getThermoRuntime(entity, data)
        const { lava, coolant, exhaust, temperature } = runtime
        synchronizeReactorTimer(data)
        const currentTemperature = temperature.get()
        // Settle only floating-point cooling residue; hot stopped reactors still cool normally.
        if (data.state === 'off' && !data.meltdownPending
            && Math.abs(currentTemperature - config.ambientTemperatureK) <= 1e-6) {
            if (currentTemperature !== config.ambientTemperatureK) temperature.set(config.ambientTemperatureK)
            data.temperature = config.ambientTemperatureK
            data.producing = 0
            data.activeRate = 0
            data.efficiency = config.minimumEfficiency
            const coolantType = coolant.getType() === 'empty' ? data.coolantCreditType : coolant.getType()
            const outputType = THERMO_COOLANT_OUTPUTS[coolantType]
            data.warning = getThermoStatus(data, {}, 0, 0, false, 0,
                exhaust.get() > 0 && exhaust.getType() !== outputType,
                exhaust.getFreeSpace() - data.exhaustCreditMb <= 1e-9)
            displayThermoReactor(data, reactor, runtime)
            saveReactorInfo(entity, data)
            return
        }
        const ticks = Math.max(1, reactor.processingInterval ?? 1)
        const lavaType = lava.getType()
        const lavaAmount = lavaType === 'lava' ? lava.get() : 0
        if (lavaType !== 'empty' && lavaType !== 'lava') data.lavaCreditMb = 0
        const coolantAmount = coolant.get()
        const storedType = coolant.getType()
        if (storedType !== 'empty' && storedType !== data.coolantCreditType) data.coolantCreditMb = 0
        const coolantType = storedType === 'empty' && data.coolantCreditMb > 0 ? data.coolantCreditType : storedType
        const fluid = coolants[coolantType]
        const outputType = THERMO_COOLANT_OUTPUTS[coolantType]
        const validCoolant = !!outputType && fluid?.tier >= COOLANT_TIER && Number.isFinite(fluid.efficiency) && fluid.efficiency > 0
        const heatPerMb = validCoolant ? THERMO_THERMAL.coolantHeatPerMb * fluid.efficiency : 0
        const outputHeat = THERMO_OUTPUT_HEAT[outputType] ?? 0
        const outputCompatible = exhaust.get() === 0 || exhaust.getType() === outputType
        if (outputCompatible && outputType && data.exhaustCreditType !== outputType) {
            // Discard at most a fractional mB when switching an empty output tank.
            data.exhaustCreditMb = 0
            data.exhaustCreditType = outputType
        }
        const outputSpace = Math.max(0, exhaust.getFreeSpace() - data.exhaustCreditMb)
        const coolingBudget = outputCompatible ? Math.min(
            (coolantAmount + data.coolantCreditMb) * heatPerMb, outputSpace * outputHeat) : 0
        const availableFuel = lavaAmount + data.lavaCreditMb
        const energyFreeSpace = energy.getFreeSpace()
        const result = simulateThermoReactor({
            temperature: currentTemperature, heatCapacity: data.heatCapacity, ticks,
            running: data.state !== 'off' && !data.meltdownPending && data.exhaustCapacity > 0, rate: data.rate,
            fuel: availableFuel, energySpace: energyFreeSpace,
            conductance: data.conductance,
            coolantHeatBudget: coolingBudget,
        }, config)
        if (result.consumedLava > 0) {
            const paid = Math.min(lavaAmount, Math.ceil(Math.max(0, result.consumedLava - data.lavaCreditMb) - 1e-9))
            if (paid > 0) lava.consume(paid)
            data.lavaCreditMb = Math.max(0, data.lavaCreditMb + paid - result.consumedLava)
            energy.add(result.producedEnergy)
            if (system.currentTick >= runtime.nextSoundTick) {
                entity.dimension.playSound('block.campfire.crackle', entity.location)
                runtime.nextSoundTick = system.currentTick + 30
            }
        }
        if (result.coolantHeatRemoved > 0) {
            const generated = data.exhaustCreditMb + result.coolantHeatRemoved / outputHeat
            const whole = Math.min(exhaust.getFreeSpace(), Math.floor(generated + 1e-9))
            if (whole > 0) {
                if (exhaust.getType() !== outputType) exhaust.setType(outputType)
                exhaust.add(whole)
            }
            data.exhaustCreditMb = Math.max(0, generated - whole)
            data.exhaustCreditType = outputType
            const used = result.coolantHeatRemoved / heatPerMb
            const paid = Math.min(coolantAmount, Math.ceil(Math.max(0, used - data.coolantCreditMb) - 1e-9))
            if (paid > 0) coolant.consume(paid)
            if (coolant.get() === 0) coolant.setType('empty')
            data.coolantCreditMb = Math.max(0, data.coolantCreditMb + paid - used)
            data.coolantCreditType = coolantType
            if (data.state !== 'off' && system.currentTick >= runtime.nextSmokeTick) {
                spawnReactorVentSmoke(entity)
                runtime.nextSmokeTick = system.currentTick + 20
            }
        }
        temperature.set(result.temperature)
        data.temperature = result.temperature
        data.efficiency = getThermoEfficiency(result.temperature, config)
        data.producing = result.producedEnergy / ticks
        data.activeRate = result.consumedLava / ticks
        if (result.meltdown) { triggerThermoMeltdown(reactor, data); return }
        data.warning = getThermoStatus(data, result, availableFuel, energyFreeSpace,
            validCoolant, coolant.get() + data.coolantCreditMb,
            !outputCompatible, exhaust.getFreeSpace() - data.exhaustCreditMb <= 1e-9)
        displayThermoReactor(data, reactor, runtime)
        saveReactorInfo(entity, data)
    }
})

function appendThermoReactorInput(index, entity) {
    if (!entity) return;

    const pressedValue = THERMO_REACTOR_KEYPAD_BY_SLOT[index];
    if (pressedValue === undefined) return;
    const currentText = getThermoReactorInputText(entity);
    if (pressedValue === '.' && currentText.includes('.')) return;
    if (currentText.length >= THERMO_REACTOR_INPUT_MAX_LENGTH) return;
    const nextText =
        currentText === '0' && pressedValue !== '.'
            ? pressedValue
            : `${currentText}${pressedValue}`;

    setThermoReactorInputText(entity, nextText || '0');
}

function getThermoReactorInputText(entity) {
    const container = entity?.getComponent('inventory')?.container;
    if (!container) return '0';

    const currentLabel = container.getItem(THERMO_REACTOR_INPUT_SLOT)?.nameTag ?? '';
    const cleanLabel = currentLabel.replace(/\u00A7./g, '');
    const match = cleanLabel.match(/([\d.]+)\s*mB\/t/);
    return match?.[1] || '0';
}

function setThermoReactorInputText(entity, text = '0') {
    if (!entity) return;

    DoriosLib.entity.setNewItem(entity, {
        slot: THERMO_REACTOR_INPUT_SLOT,
        typeId: THERMO_REACTOR_INPUT_ITEM,
        nameTag: `\u00A7r\u00A7f${text || '0'} mB/t`,
    });
}

function deleteThermoReactorInput(entity) {
    const currentText = getThermoReactorInputText(entity);
    const nextText = currentText.length > 1 ? currentText.slice(0, -1) : '0';
    setThermoReactorInputText(entity, nextText || '0');
}

function resetThermoReactorInput(entity) {
    setThermoReactorInputText(entity, '0');
}

function applyThermoReactorBurnRate(entity) {
    if (!entity) return;

    const inputText = getThermoReactorInputText(entity);
    let parsed = parseFloat(String(inputText).replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        parsed = 0;
    }

    const data = getReactorInfo(entity);
    data.rate = parsed;
    saveReactorInfo(entity, data);
    setThermoReactorInputText(entity, `${parsed}`);
    DoriosLib.entity.setNewItem(entity, { slot: 23, typeId: 'utilitycraft:arrow_indicator_90', nameTag: '\u00A7r\u00A78Current Rate: ' + parsed.toFixed(2) + ' mB/t' });
}

/**
 * Updates the reactor status label and temperature bar.
 *
 * @param {Object} data 
 * @param {MultiblockGenerator} reactor 
 */
function updateReactorInfoItem(data, reactor, lavaTank, coolantTank, exhaustTank) {
    const energy = reactor.energy
    const label = (slot, lines) => {
        const text = Array.isArray(lines) ? lines.join('\n') : lines
        if (reactor.container.getItem(slot)?.nameTag !== text) reactor.setLabel(text, slot)
    }
    label(1, [
        '\u00A7r' + (data.warning || '\u00A7eIdle'), '',
        '\u00A7r\u00A7cRate: \u00A7f' + data.rate.toFixed(2) + ' mB/t',
        '\u00A7r\u00A7aTemperature: \u00A7f' + data.temperature.toFixed(0) + 'K',
        '\u00A7r\u00A7aEfficiency: \u00A7f' + (data.efficiency * 100).toFixed(1) + '%%', '',
        '\u00A7r\u00A7bProducing: \u00A7f' + EnergyStorage.formatEnergyToText(data.producing ?? 0) + '/t',
        '\u00A7r\u00A7bCapacity: \u00A7f' + energy.getPercent().toFixed(1) + '%%',
        '\u00A7r\u00A7bStored: \u00A7f' + EnergyStorage.formatEnergyToText(energy.get()), '',
        '\u00A7r\u00A7aOn time: \u00A7f' + formatReactorOnTime(data),
    ])
    const name = tank => tank.getType() === 'empty' ? 'None' : DoriosLib.text.formatIdentifier(tank.getType())
    const percent = (amount, capacity) => capacity > 0 ? (amount / capacity * 100).toFixed(0) : '0'
    label(22, [
        '\u00A7r\u00A7eFuel Information',
        '\u00A7r\u00A7aType: \u00A7f' + name(lavaTank),
        '\u00A7r\u00A7aReserve: \u00A7f' + percent(lavaTank.get(), data.lavaCapacity) + '%%', '',
        '\u00A7r\u00A7eCoolant Information',
        '\u00A7r\u00A7aType: \u00A7f' + name(coolantTank),
        '\u00A7r\u00A7aReserve: \u00A7f' + percent(coolantTank.get(), data.coolantCapacity) + '%%', '',
        '\u00A7r\u00A7eGas Information',
        '\u00A7r\u00A7aStored: \u00A7f' + GasStorage.formatGas(exhaustTank.get()),
        '\u00A7r\u00A7aFilled: \u00A7f' + percent(exhaustTank.get(), data.exhaustCapacity) + '%%',
    ])
    label(23, '\u00A7r\u00A78Current Rate: ' + data.rate.toFixed(2) + ' mB/t')
    label(25, '\u00A7r\u00A78Recommended Rate:\n' + getThermoRecommendedRate(data, coolantTank, exhaustTank).toFixed(2) + ' mB/t')
}

/** Reference at ideal temperature; assumes a continuous coolant supply. */
function getThermoRecommendedRate(data, coolant, exhaust) {
    const delta = (CORE_TCAP_K - CORE_TMIN_K) * config.idealTemperatureFraction
    const passive = data.conductance * THERMO_THERMAL.passiveCoolingFraction * delta
    const fluid = coolants[coolant.getType()]
    const type = THERMO_COOLANT_OUTPUTS[coolant.getType()]
    const outputBudget = exhaust.get() === 0 || exhaust.getType() === type
        ? Math.max(0, exhaust.getFreeSpace() - data.exhaustCreditMb) * (THERMO_OUTPUT_HEAT[type] ?? 0) : 0
    const active = fluid?.tier >= COOLANT_TIER && Number.isFinite(fluid.efficiency) && fluid.efficiency > 0 && coolant.get() > 0
        ? Math.min(outputBudget, data.conductance * delta, coolant.get() * THERMO_THERMAL.coolantHeatPerMb * fluid.efficiency) : 0
    return (passive + active) / (THERMO_THERMAL.heatPerLavaUnit * (2 - config.maximumEfficiency))
}

/**
 * Reads persisted reactor data from dynamic properties and merges it with
 * derived structure stats required by the tick simulation.
 *
 * @param {Entity} entity Reactor controller entity.
 * @returns {Object} Current reactor runtime data.
 */
function getReactorInfo(entity) {
    let saved = {}
    try { saved = JSON.parse(entity.getDynamicProperty('reactorData') || '{}') } catch { }
    const data = { ...config.initialReactorData, ...saved, ...getThermoStats(entity) }
    data.rate = Number.isFinite(data.rate) ? Math.max(0, data.rate) : config.initialReactorData.rate
    if (entity.getDynamicProperty('dorios:state') === 'off') data.state = 'off'
    return data
}

function saveReactorInfo(entity, data) {
    const state = { ...data }
    for (const key of Object.keys(getThermoStats(entity))) delete state[key]
    delete state.fs_t
    const serialized = JSON.stringify(state)
    if (entity.getDynamicProperty('reactorData') !== serialized) entity.setDynamicProperty('reactorData', serialized)
}

function getThermoStats(entity) {
    const raw = entity.getDynamicProperty('reactorStats')
    const cached = statsCache.get(entity)
    if (cached && cached.raw === raw) return cached.value
    let saved = {}
    try { if (raw) saved = JSON.parse(raw) } catch { }
    const value = { lavaCapacity: 0, coolantCapacity: 0, exhaustCapacity: 0, gasCells: 0, energyCap: 0, ...saved }
    // Legacy conductors were stored as 0.05 K/t per block.
    value.heatConductors ??= Math.max(0, (value.heatDissipation ?? 0) / 0.05)
    value.conductance = value.heatConductors * THERMO_THERMAL.conductorConductance
    if (!(value.heatCapacity > 0)) value.heatCapacity = getThermoHeatCapacity(value.bounds, {
        thermo_core: 1, heat_conductor: value.heatConductors,
        gas_cell: value.gasCells,
        fluid_cell: value.lavaCapacity / config.lavaCapacityPerFluidCell,
    })
    statsCache.set(entity, { raw, value })
    return value
}

function getThermoRuntime(entity, data) {
    let runtime = runtimeCache.get(entity)
    if (!runtime) {
        const [coolant, lava] = FluidStorage.initializeMultiple(entity, 2)
        if (coolant.get() === 0) coolant.setType('empty')
        if (lava.getType() === 'empty') lava.setType('lava')
        const [exhaust] = GasStorage.initializeMultiple(entity, 1)
        ensureGasIOConfig(entity, 'utilitycraft:thermo_reactor_controller')
        const temperature = new TemperatureStorage(entity, 0, { initialTemperature: data.temperature, heatCapacity: data.heatCapacity })
        runtime = { coolant, lava, exhaust, temperature, stats: null, nextSmokeTick: 0, nextSoundTick: 0 }
        runtimeCache.set(entity, runtime)
    }
    const stats = getThermoStats(entity)
    if (runtime.stats !== stats) {
        runtime.exhaust.setCap(data.exhaustCapacity)
        runtime.coolant.setCap(data.coolantCapacity)
        runtime.lava.setCap(data.lavaCapacity)
        if (runtime.temperature.getHeatCapacity() !== data.heatCapacity) runtime.temperature.setHeatCapacity(data.heatCapacity)
        runtime.stats = stats
    }
    return runtime
}

function getThermoStatus(data, result, fuel, energySpace, validCoolant, coolantAmount, incompatibleOutput, outputFull) {
    if (data.temperature >= WARN_DANGER_K - 100) return '\u00A7cCore overheating!'
    if (data.temperature >= WARN_OVERHEAT_K) return '\u00A76Overheating!'
    if (data.exhaustCapacity <= 0) return '\u00A7cAdd Gas Cells; rescan'
    if (incompatibleOutput) return '\u00A7cDrain Output Gas!'
    if (outputFull) return '\u00A7cGas Tank Full!'
    if (data.state === 'off') return '\u00A7eStopped'
    if (data.rate <= 0) return '\u00A7eRate Setpoint 0 mB/t'
    if (fuel <= 0) return '\u00A7eMissing Fuel!'
    if (energySpace <= 0) return '\u00A7eEnergy Full'
    if (!validCoolant || coolantAmount <= 0) return '\u00A7cMissing Coolant!'
    return result.consumedLava > 0 ? '\u00A72Active' : '\u00A77Idle'
}

function triggerThermoMeltdown(reactor, data) {
    if (data.meltdownPending) return
    data.meltdownPending = true
    setReactorRunning(data, false)
    data.warning = '\u00A7cCore meltdown!'
    saveReactorInfo(reactor.entity, data)
    Multiblock.DeactivationManager.deactivateMultiblock(reactor.block, undefined, GENERATOR_CONFIG.deactivateConfig)
    const location = reactor.entity.location
    const bounds = data.bounds
    DoriosLib.time.runAfterSeconds(4, () => {
        const center = bounds ? Multiblock.EntityManager.getCenter(bounds.min, bounds.max) : location
        const radius = bounds ? Multiblock.EntityManager.getVolume(bounds) ** (1 / 3) * 0.4 : 4
        reactor.dimension.createExplosion({ x: center.x + 0.5, y: center.y + 0.5, z: center.z + 0.5 }, radius,
            { causesFire: true, breaksBlocks: true, allowUnderwater: true })
    })
}

function displayThermoReactor(data, reactor, runtime) {
    const { lava, coolant, exhaust, temperature } = runtime
    if (reactor.shouldUpdateUI) {
        coolant.shouldUpdateUI = true
        lava.shouldUpdateUI = true
        exhaust.shouldUpdateUI = true
        exhaust.display(24)
        coolant.display(2)
        lava.display(3)
        temperature.display(4, { minimum: CORE_TMIN_K, maximum: CORE_TCAP_K, force: true })
        updateReactorInfoItem(data, reactor, lava, coolant, exhaust)
        reactor.displayEnergy()
    }
}
