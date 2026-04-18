import { EnergyStorage, FluidStorage, Multiblock, MultiblockGenerator, ButtonManager } from "DoriosCore/index.js"
import { ModalFormData } from '@minecraft/server-ui'
import { ItemStack } from '@minecraft/server'
import { coolants } from 'config/coolants.js'

// #region Config
/** @type ThermoReactorConfig */
const config = {
    // Settings / Limits
    maxCoreTemperatureK: 1200,       // K
    maxPressurePSI: 300,            // PSI

    // Component rates
    ventReleaseRate: 40,             // mB/tick per vent block
    conductorHeatDissipation: 0.05,     // K/tick per conductor block

    // Conversion factors
    coolantPerKelvin: 50,              // mB/K
    pressurePerSteam: 0.0001,            // PSI/mB
    heatPerLavaUnit: 0.008,              // K/mB
    energyPerLavaUnit: 2000,          // DE/mB

    // Capacities
    coolantCapacityPerEmptyBlock: 64_000, // mB
    steamCapacityPerEmptyBlock: 64_000, // mB
    lavaCapacityPerFluidCell: 256_000,   // mB

    initialReactorData: {
        state: 'off',
        rate: 100,
        pressure: 0,
        temperature: 300,
        efficiency: 0.1,
        time: 0,
        warning: ''
    }
}

/**
 * Core temperature constants.
 * - CORE_TMIN_K: logic floor (K)
 * - CORE_TCAP_K: absolute cap (K) — cannot exceed
 * - CORE_TIDEAL_FRAC: ideal temp as fraction of supported span (0..1)
 * - WARN_*: UI thresholds
 */
const CORE_TMIN_K = 300;
const CORE_TCAP_K = 1273.15;
const CORE_TIDEAL_FRAC = 0.5;
const WARN_OVERHEAT_K = 1000;
const WARN_DANGER_K = 1200;

/**
 * Efficiency shaping (temperature-only).
 * EFF_MIN..MAX ∈ [0,1]; GAMMA/ALPHA tune bowl sharpness and asymmetry.
 */
const EFF_MIN = 0.10;
const EFF_MAX = 0.80;
const EFF_GAMMA = 5.0;
const EFF_ALPHA_COLD = 1.6;
const EFF_ALPHA_HOT = 1.2;

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

// #endregion

// Power button - Turns on/off the Reactor
ButtonManager.registerMachineButton("thermo_reactor", 5, (({ entity }) => {
    if (!entity) return;

    const data = getReactorInfo(entity);
    data.state = String(data.state).toLowerCase() === "off" ? "on" : "off";
    entity.setDynamicProperty("reactorData", JSON.stringify(data));
}))

// Numpad
ButtonManager.registerMachineButton(
    "thermo_reactor",
    Object.keys(THERMO_REACTOR_KEYPAD_BY_SLOT).map(Number),
    ({ entity, slot }) => {
        appendThermoReactorInput(slot, entity);
    }
);

// Accept Button - Sets the current number as the burn rate
ButtonManager.registerMachineButton("thermo_reactor", THERMO_REACTOR_ACCEPT_SLOT, ({ entity }) => {
    applyThermoReactorBurnRate(entity);
});

// Cancel Button - Deletes all characters
ButtonManager.registerMachineButton("thermo_reactor", THERMO_REACTOR_CANCEL_SLOT, ({ entity }) => {
    resetThermoReactorInput(entity);
});

// Delete Button - Deletes 1 character
ButtonManager.registerMachineButton("thermo_reactor", THERMO_REACTOR_DELETE_SLOT, ({ entity }) => {
    deleteThermoReactorInput(entity);
});

DoriosAPI.register.blockComponent('thermo_reactor', {
    onPlayerInteract(e, { params: settings }) {
        return MultiblockGenerator.handlePlayerInteract(e, settings, {
            onInteractWithoutWrench({ entity, player }) {
                if (!entity) return

                const main = player.getEquipment('Mainhand')
                if (!FluidStorage.handleFluidItemInteraction(player, entity, main)) {
                    void showBurnRateConfigForm(entity, player)
                }
            },
            deactivateConfig: { blockId: 'minecraft:water' },
            fillBlocksConfig: { blockId: 'minecraft:water' },
            requirements: {
                thermo_core: {
                    amount: 1,
                    warning: '\u00A7c[Reactor] Missing Thermo Core - reactor cannot operate.',
                },
            },
            missingEnergyWarning: '\u00A7c[Reactor] At least 1 energy unit is required.',
            onActivate: ({ entity, components, energyCap, settings, structure }) => {
                entity.setDynamicProperty(
                    'dorios:rateSpeed',
                    energyCap / settings.multiblock.transfer_rate_ratio
                )
                entity.setItem(
                    THERMO_REACTOR_INPUT_SLOT,
                    THERMO_REACTOR_INPUT_ITEM,
                    1,
                    '\n\u00A7r\u00A7fSet the burn rate for\n the reactor!\n\n 0 mB/t'
                )
                const lavaCapacity =
                    (components['fluid_cell'] ?? 0) * config.lavaCapacityPerFluidCell
                const internalVolume = components['air'] ?? 0
                const coolantCapacity = internalVolume * config.coolantCapacityPerEmptyBlock
                const steamCapacity = internalVolume * config.steamCapacityPerEmptyBlock
                const heatDissipation =
                    (components['heat_conductor'] ?? 0) * config.conductorHeatDissipation
                const ventRate =
                    (components['vent'] ?? 0) * config.ventReleaseRate

                entity.setDynamicProperty('reactorStats', JSON.stringify({
                    lavaCapacity,
                    coolantCapacity,
                    steamCapacity,
                    heatDissipation,
                    ventRate,
                    energyCap,
                    bounds: structure.bounds
                }))

                const fluids = FluidStorage.initializeMultiple(entity, 2)
                fluids[0].setCap(1000)
                fluids[1].setCap(1000)
            },
            successMessages: ({ components, energyCap }) => {
                const lavaCapacity =
                    (components['fluid_cell'] ?? 0) * config.lavaCapacityPerFluidCell
                const internalVolume = components['air'] ?? 0
                const coolantCapacity = internalVolume * config.coolantCapacityPerEmptyBlock
                const steamCapacity = internalVolume * config.steamCapacityPerEmptyBlock
                const heatDissipation =
                    (components['heat_conductor'] ?? 0) * config.conductorHeatDissipation
                const ventRate =
                    (components['vent'] ?? 0) * config.ventReleaseRate

                return [
                    lavaCapacity <= 0 ? '\u00A7e[Warning] No Lava Cells detected.' : '',
                    coolantCapacity <= 0 ? '\u00A7e[Warning] No volume for coolant cooling.' : '',
                    steamCapacity <= 0 ? '\u00A7e[Warning] No internal steam volume.' : '',
                    heatDissipation <= 0 ? '\u00A7e[Warning] No Heat Conductors found.' : '',
                    ventRate <= 0 ? '\u00A7e[Warning] No vents detected - pressure cannot be released.' : '',
                    '\u00A7a[Reactor] Thermo Reactor structure validated.',
                    `\u00A77Energy Capacity: \u00A7b${EnergyStorage.formatEnergyToText(energyCap)}`,
                    `\u00A77Lava Capacity: \u00A7b${FluidStorage.formatFluid(lavaCapacity)}`,
                    `\u00A77Coolant Capacity: \u00A7b${FluidStorage.formatFluid(coolantCapacity)}`,
                    `\u00A77Steam Capacity: \u00A7b${FluidStorage.formatFluid(steamCapacity)}`,
                    `\u00A77Heat Dissipation: \u00A7b${heatDissipation.toFixed(2)} K\u00B0/t`,
                    `\u00A77Steam Venting: \u00A7b${FluidStorage.formatFluid(ventRate)}/t`,
                    `\u00A77Max Pressure: \u00A7b${config.maxPressurePSI} PSI`,
                    `\u00A77Max Heat: \u00A7b${config.maxCoreTemperatureK} K\u00B0`,
                ]
            },
        })
    },
    onPlayerBreak({ block, player }) {
        Multiblock.DeactivationManager.handleBreakController(block, player, { blockId: 'minecraft:water' })
    },
    onTick({ block }, { params: settings }) {
        if (!worldLoaded) return;
        const reactor = new MultiblockGenerator(block, settings);
        if (!reactor.valid) return;
        const { entity, energy } = reactor
        ButtonManager.ensureWatching(entity, "thermo_reactor")

        const newRate = entity.getDynamicProperty("dorios:rateSpeed");
        reactor.setRate(newRate);

        energy.transferToNetwork(reactor.rate);
        const data = getReactorInfo(entity);

        const fluids = FluidStorage.initializeMultiple(entity, 2);
        fluids.forEach(fluid => fluid.display(fluid.index + 2))

        let lava = null; let coolant = null; let coolantData = null;

        let coolantAmount = 0; let fuel = 0;
        fluids.forEach(f => {
            if (!f) return;

            if (f.type === "lava") {
                fuel = f.get();
                lava = f;
                f.setCap(data.lavaCapacity)
                return;
            }

            if (f.type in coolants && f.get() > 0) {
                coolant = f;
                coolantAmount = f.get()
                coolantData = coolants[f.type];
                f.setCap(data.coolantCapacity)
            }
        });

        const f = tickSpeed;
        let working = false;

        const tMin = CORE_TMIN_K;
        const tMax = CORE_TCAP_K;
        const tSpan = Math.max(1, tMax - tMin);

        data.temperature = Math.max(tMin, data.temperature ?? tMin);

        const tNorm = Math.min(1, Math.max(0, (data.temperature - tMin) / tSpan));
        const tIdeal = CORE_TIDEAL_FRAC;
        const tDist = Math.abs(tNorm - tIdeal) / tIdeal;

        const baseShape = Math.max(0, 1 - Math.pow(tDist, EFF_GAMMA));
        const shape = tNorm < tIdeal
            ? Math.pow(baseShape, EFF_ALPHA_COLD)
            : Math.pow(baseShape, EFF_ALPHA_HOT);

        data.efficiency = EFF_MIN + (EFF_MAX - EFF_MIN) * shape;

        if (fuel > 0 && data.state !== "off") {
            const rate = Math.min(fuel, data.rate * f);
            if (rate > 0) {
                lava.consume(rate)
                fireLoop(entity, f);
                const waste = 1 - data.efficiency;
                const energyProduced = rate * config.energyPerLavaUnit * data.efficiency;
                const rawHeat = rate * config.heatPerLavaUnit * (1 + waste);
                const tMin = CORE_TMIN_K;
                const tMax = CORE_TCAP_K;
                const span = Math.max(1e-6, tMax - tMin);
                const normT = Math.min(1, Math.max(0, (data.temperature - tMin) / span));
                const TEMP_SLOWDOWN_EXP = 2;
                const slowdown = 1 - Math.pow(normT, TEMP_SLOWDOWN_EXP);
                let heatProduced = rawHeat * slowdown;

                energy.add(energyProduced);
                data.producing = energyProduced / f;
                data.temperature += heatProduced;
                data.time += f;
                working = true;
                data.warning = undefined;
            }
        } else {
            if (data.state !== "off") data.warning = "§eMissing Fuel!";
            data.time = 0;
            data.producing = 0;
        }

        if (coolant && coolantData.tier >= COOLANT_TIER) {
            const maxByDiss = (data.heatDissipation ?? 0) * f;
            const maxByCoolant = coolantAmount / config.coolantPerKelvin;
            const maxByTMin = Math.max(0, data.temperature - tMin);

            const heatDissipated = Math.min(maxByDiss, maxByCoolant * coolantData.efficiency, maxByTMin);
            if (heatDissipated > 0) {
                if (data.state !== "off") {
                    spawnRandomVentSmoke(entity);
                }
                const coolantConsumed = heatDissipated * config.coolantPerKelvin;
                coolant.consume(coolantConsumed / coolantData.efficiency);
                data.temperature -= heatDissipated;
            }
        } else {
            data.temperature -= data.heatDissipation * ((data.temperature) ** 2) / 100_000_000
            data.temperature = Math.max(CORE_TMIN_K, data.temperature)
            if (working) data.warning = "§cMissing Coolant!";
        }

        data.temperature = Math.min(CORE_TCAP_K, Math.max(CORE_TMIN_K, data.temperature));

        if (data.temperature >= WARN_DANGER_K - 100) {
            data.warning = "§cCore overheating!";
            if (data.temperature >= WARN_DANGER_K) {
                data.state = "off"
                data.temperature = 1000
                Multiblock.DeactivationManager.deactivateMultiblock(block, undefined, { blockId: 'minecraft:water' })
                DoriosAPI.utils.waitSeconds(4, () => {
                    if (!entity) return
                    const bounds = data.bounds
                    if (bounds) {
                        const center = Multiblock.EntityManager.getCenter(bounds.min, bounds.max)
                        const radius = (Multiblock.EntityManager.getVolume(bounds) ** (1 / 3)) * 0.4
                        reactor.dimension.createExplosion({ x: center.x + 0.5, y: center.y + 0.5, z: center.z + 0.5 }, radius, { causesFire: true, breaksBlocks: true, allowUnderwater: true })
                    } else {
                        reactor.dimension.createExplosion(entity.location, 4, { causesFire: true, breaksBlocks: true, allowUnderwater: true })
                    }
                })
            }

        } else if (data.temperature >= WARN_OVERHEAT_K) {
            data.warning ??= "§6Overheating!";
        }

        if (working && (coolant?.get() ?? 0) > 0 && (data.warning ?? "") === "") {
            data.warning = "§2Active";
        }

        if (data.state === "off") data.warning = "§eStopped";

        updateReactorInfoItem(data, reactor);
        reactor.displayEnergy();
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

    entity.setItem(
        THERMO_REACTOR_INPUT_SLOT,
        THERMO_REACTOR_INPUT_ITEM,
        1,
        `\n\u00A7r\u00A7fSet the burn rate for \nthe reactor!\n\n ${text || '0'} mB/t`
    );
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
    entity.setDynamicProperty("reactorData", JSON.stringify(data));
    setThermoReactorInputText(entity, `${parsed}`);
}

/**
 * Updates the reactor status label and temperature bar.
 *
 * @param {Object} data 
 * @param {MultiblockGenerator} reactor 
 */
function formatReactorDuration(ticks = 0) {
    const totalSeconds = Math.max(0, Math.floor((ticks ?? 0) / 20));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(value => String(value).padStart(2, '0')).join(':');
}

function formatReactorEtaSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '--:--:--';

    const safeSeconds = Math.floor(seconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    return [hours, minutes, secs].map(value => String(value).padStart(2, '0')).join(':');
}

function updateReactorInfoItem(data, reactor) {
    const energy = reactor.energy;
    const tanks = [new FluidStorage(reactor.entity, 0), new FluidStorage(reactor.entity, 1)];

    const lavaTank = tanks.find(tank => tank.getType() === 'lava');
    const coolantTank = tanks.find(tank => tank.getType() !== 'lava' && tank.getType() !== 'empty' && tank.get() > 0)
        ?? tanks.find(tank => tank.getType() !== 'lava' && tank.getType() !== 'empty');

    const storedEnergy = energy.get();
    const energyCap = energy.getCap();
    const fuelStored = lavaTank?.get() ?? 0;
    const fuelName = lavaTank ? DoriosAPI.utils.formatIdToText(lavaTank.getType()) : 'None';
    const coolantStored = coolantTank?.get() ?? 0;
    const coolantName = coolantTank ? DoriosAPI.utils.formatIdToText(coolantTank.getType()) : 'None';
    const fuelPercent = (data.lavaCapacity ?? 0) > 0 ? ((fuelStored / (data.lavaCapacity ?? 0)) * 100).toFixed(2) : '0.00';
    const coolantPercent = (data.coolantCapacity ?? 0) > 0 ? ((coolantStored / (data.coolantCapacity ?? 0)) * 100).toFixed(2) : '0.00';
    const burnRate = data.rate ?? 0;
    const statusText = data.warning || (data.state === 'off' ? '§eStopped' : '§7Idle');

    reactor.setLabel([
        `§r§7Status: ${statusText}

§r§eReactor Information`,
        `
§r§cBurn Rate §f${burnRate.toFixed(2)} mB/t
§r§aTemperature §f${(data.temperature ?? 0).toFixed(2)} K
§r§aEfficiency §f${((data.efficiency ?? 0) * 100).toFixed(2)}%%
§r§aOn Time §f${formatReactorDuration(data.time)}`,
        `
§r§eEnergy Information

§r§bProducing §f${EnergyStorage.formatEnergyToText(data.producing ?? 0)}/t
§r§bCapacity §f${energy.getPercent().toFixed(2)}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(storedEnergy)} / ${EnergyStorage.formatEnergyToText(energyCap)}`,
        `
§r§eFuel Information

§r§aType §f${fuelName}
§r§aStored §f${FluidStorage.formatFluid(fuelStored)} / ${FluidStorage.formatFluid(data.lavaCapacity ?? 0)}
§r§aFuel §f${fuelPercent}%%`,
        `
§r§eCoolant Information

§r§aType §f${coolantName}
§r§aStored §f${FluidStorage.formatFluid(coolantStored)} / ${FluidStorage.formatFluid(data.coolantCapacity ?? 0)}
§r§aCoolant §f${coolantPercent}%%`
    ]);

    const container = reactor.container;
    if (container) {
        const temp = data.temperature ?? CORE_TMIN_K;
        const segment = Math.floor(
            (temp - CORE_TMIN_K) / (CORE_TCAP_K - CORE_TMIN_K) * 31
        );

        let name = "utilitycraft:temperature_";
        if (segment < 10) name += "0";
        name += segment;

        const bar = new ItemStack(name);
        bar.nameTag = `§r§f${temp.toFixed(2)} K`;

        container.setItem(4, bar);
    }

    reactor.entity.setDynamicProperty("reactorData", JSON.stringify(data));
}

/**
 * Reads persisted reactor data from dynamic properties and merges it with
 * derived structure stats required by the tick simulation.
 *
 * @param {Entity} entity Reactor controller entity.
 * @returns {Object} Current reactor runtime data.
 */
function getReactorInfo(entity) {
    try {
        const rawData = entity.getDynamicProperty('reactorData');
        const data = rawData ? JSON.parse(rawData) : config.initialReactorData;

        const rawStats = entity.getDynamicProperty('reactorStats')
        const stats = rawStats ? JSON.parse(rawStats) : {
            lavaCapacity: 0,
            coolantCapacity: 0,
            steamCapacity: 0,
            heatDissipation: 0,
            ventRate: 0,
            energyCap: 0
        };
        if (entity.getDynamicProperty('dorios:state') == 'off') data.state = 'off'
        return { ...data, ...stats };
    } catch {
        return { ...config.initialReactorData, lavaCapacity: 0, coolantCapacity: 0, steamCapacity: 0, heatDissipation: 0, ventRate: 0, energyCap: 0 };
    }
}


/**
 * Show a modal to configure reactor burn rate and on/off state.
 * Reads current values from the entity (data.rate, data.state) and writes them back.
 * @param {Entity} entity - Reactor entity that holds the data.
 * @param {Player} player - Player to show the form to.
 */
async function showBurnRateConfigForm(entity, player) {
    // Read current reactor data
    const data = (typeof getReactorInfo === "function" ? getReactorInfo(entity) : {}) || {};
    const currentRate = Number(data.rate) || 0.1;
    const currentEnabled =
        typeof data.state === "string" ? data.state.toLowerCase() !== "off" : !!data.state;

    // Build form
    const form = new ModalFormData()
        .title("Reactor Burn Rate")
        .textField(
            `Burn rate (mB/t)\nFaster burn = more power & heat.\nSet a rate your cooling can sustain. e.g. 10`,
            `Set a burn rate: 100`,
            { defaultValue: `${currentRate}` }
        )
        .toggle("Enabled (on/off)", { defaultValue: currentEnabled });

    // Show and handle response
    const res = await form.show(player);
    if (res.canceled) return;

    const [rateInput, enabledToggle] = res.formValues;

    // Parse and validate
    let parsed = parseFloat(String(rateInput).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        parsed = 0
    }

    // Write back
    data.rate = parsed;
    data.state = enabledToggle ? "on" : "off";

    if (typeof setReactorInfo === "function") {
        setReactorInfo(entity, data);
    } else if (typeof updateReactorInfo === "function") {
        updateReactorInfo(entity, data);
    } else if (entity.setDynamicProperty) {
        // Fallback if you store data as a dynamic property
        entity.setDynamicProperty("reactorData", JSON.stringify(data));
    }
}

/**
 * Spawns "campfire_tall_smoke_particle" on ~50% of vent blocks, chosen at random.
 * 8 -> 4, 7 -> 3, etc.
 * @param {import('@minecraft/server').Entity} entity
 * @param {number} [ratio=0.5] Fraction of vents to use (0..1)
 * @param {boolean} [center=true] If true, spawns at block centers (+0.5)
 */
function spawnRandomVentSmoke(entity, ratio = 0.1, center = true) {
    const dim = entity.dimension;

    let vents = [];
    const raw = entity.getDynamicProperty('ventBlocks');
    try { vents = raw ? JSON.parse(raw) : []; } catch { vents = []; }

    const n = vents.length;
    if (n < 2) return;

    const k = Math.max(1, Math.floor(n * ratio)); // 8->4
    // Partial Fisher–Yates to sample k unique vents without replacement
    for (let i = n - 1; i > n - 1 - k; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [vents[i], vents[j]] = [vents[j], vents[i]];
    }

    // Spawn particle on the sampled vents
    for (let i = n - k; i < n; i++) {
        const v = vents[i];
        const pos = center ? { x: v.x + 0.5, y: v.y + 0.5, z: v.z + 0.5 } : v;
        try {
            dim.spawnParticle("minecraft:campfire_tall_smoke_particle", pos);
        } catch { }
    }
}

const PERIOD = 30; // 2 s

/**
 * Plays the reactor burn loop sound at a fixed interval while fuel is burning.
 *
 * @param {Entity} e Reactor controller entity.
 * @param {number} f Tick delta used by the simulation.
 */
function fireLoop(e, f) {
    let t = (Number(e.getDynamicProperty('fs_t')) || 0) + f;
    if (t >= PERIOD) { e.dimension.playSound('block.campfire.crackle', e.location); t %= PERIOD; }
    e.setDynamicProperty('fs_t', t);
}

/**
 * Thermo Reactor configuration.
 *
 * Conventions:
 * - Simulation runs per game tick.
 * - mB = milliBuckets (volume), PSI = pressure, K = kelvin (temperature).
 * - Units are documented in JSDoc rather than in property names.
 *
 * @typedef {Object} ThermoReactorConfig
 *
 * @property {number} baseLavaBurnRate  Base lava consumption per tick when Speed=1. Units: mB/tick.
 * @property {number} maxCoreTemperatureK  Maximum supported core temperature before meltdown. Units: K.
 * @property {number} maxPressurePSI  Maximum supported pressure before explosion. Units: PSI.
 *
 * @property {number} ventReleaseRate  Steam/pressure vented by a single vent block per tick. Units: mB/tick.
 * @property {number} conductorHeatDissipation  Heat dissipated by a single heat conductor per tick. Units: K/tick.
 *
 * @property {number} coolantPerKelvin  Coolant required to dissipate 1 K of heat. Units: mB/K.
 * @property {number} pressurePerSteam  Pressure generated by steam. Units: PSI/mB.
 * @property {number} heatPerLavaUnit  Heat generated by burning 1 mB of lava. Units: K/mB.
 * @property {number} energyPerLavaUnit  Energy generated from burning 1 mB of lava. Units: DE/mB.
 *
 * @property {number} coolantCapacityPerEmptyBlock  Coolant storage capacity added per empty block. Units: mB.
 * @property {number} steamCapacityPerEmptyBlock  Steam storage capacity added per empty block. Units: mB.
 * @property {number} lavaCapacityPerFluidCell  Lava storage capacity per fluid cell. Units: mB.
 * 
 * @property {Object} initialReactorData  Initial values for each stat.
 */
