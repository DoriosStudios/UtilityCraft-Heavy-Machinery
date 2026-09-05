import { ItemStack, system } from '@minecraft/server'
import {
    EnergyStorage,
    FluidStorage,
    InterfaceManager,
    Multiblock,
    MultiblockGenerator,
    registerLinkNodeIO,
} from 'DoriosCore/index.js'
import { ensureFluidIOConfig } from 'DoriosCore/interfaces/fluidIO.js'
import { ensureItemIOConfig } from 'DoriosCore/interfaces/itemIO.js'
import * as DoriosLib from 'DoriosLib/index.js'
import { coolants } from 'config/coolants.js'
import { advanceReactorTemperature } from './reactorThermalModel.js'
import {
    formatReactorOnTime,
    setReactorRunning,
    spawnReactorVentSmoke,
    synchronizeReactorTimer,
} from './reactorRuntime.js'

const config = {
    ambientTemperatureK: 300,
    maximumTemperatureK: 3273.15,
    overheatWarningK: 2800,
    meltdownTemperatureK: 3000,

    minimumEfficiency: 0.10,
    maximumEfficiency: 0.95,
    idealTemperatureFraction: 0.5,
    efficiencyGamma: 5,
    coldEfficiencyAlpha: 1.6,
    hotEfficiencyAlpha: 1.2,

    fuelUnitsPerRod: 1000,
    fuelCapacityPerAssembly: 4000,
    burnRatePerAssembly: 2,
    assembliesPerRodControl: 4,
    energyPerFuelUnit: 200_000,
    heatPerFuelUnit: 0.05,

    coolantCapacityPerEmptyBlock: 64_000,
    coolantPerKelvin: 10,
    conductorHeatDissipation: 0.05,
    thermalResponseTimeSeconds: 60,

    initialData: {
        state: 'off',
        power: 25,
        fuelStored: 0,
        temperature: 300,
        producing: 0,
        activeRate: 0,
        controlEfficiency: 0,
        efficiency: 0.10,
        startedAtMs: 0,
        warning: '',
    },
}

const FUEL_INPUT_SLOT = 21
const FUEL_ITEM = 'utilitycraft:enriched_uranium_rod'
const POWER_INPUT_SLOT = 6
const POWER_INPUT_ITEM = 'utilitycraft:arrow_right_0'
const POWER_INPUT_MAX_LENGTH = 5
const POWER_KEYPAD_BY_SLOT = {
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
}
const POWER_ACCEPT_SLOT = 18
const POWER_CANCEL_SLOT = 19
const POWER_DELETE_SLOT = 20

const GENERATOR_CONFIG = {
    entity: {
        identifier: 'utilitycraft:nuclear_reactor',
        name: 'nuclear_reactor',
    },
    generator: {
        energy_cap: 1,
        rate_speed_base: 0,
    },
    multiblock: {
        transfer_rate_ratio: 20,
    },
    required_case: 'dorios:multiblock.case.netherite',
    requirements: {
        air: {
            amount: 1,
            warning: '\u00A7c[Reactor] At least 1 empty internal block is required for coolant storage.',
        },
        fuel_assemblies: {
            amount: 1,
            warning: '\u00A7c[Reactor] At least 1 Fuel Assembly is required.',
        },
        rod_control: {
            amount: 1,
            warning: '\u00A7c[Reactor] At least 1 Rod Control is required.',
        },
        heat_conductor: {
            amount: 1,
            warning: '\u00A7c[Reactor] At least 1 Heat Conductor is required.',
        },
    },
    deactivateConfig: { blockId: 'minecraft:water' },
    fillBlocksConfig: { blockId: 'minecraft:water' },
    missingEnergyWarning: '\u00A7c[Reactor] At least 1 Energy Cell is required.',
}

const NUCLEAR_FUELS = {
    [FUEL_ITEM]: {
        fuelUnits: config.fuelUnitsPerRod,
        label: 'Enriched Uranium',
    },
}

registerLinkNodeIO('utilitycraft:nuclear_reactor_controller', {
    items: {
        anyInputSlots: [FUEL_INPUT_SLOT],
        anyOutputSlots: [],
        inputs: [{ id: 'fuel', label: 'Nuclear Fuel Input', color: '\u00A7a', slots: [FUEL_INPUT_SLOT] }],
        outputs: [],
    },
    liquids: {
        anyInputIndices: [0],
        anyOutputIndices: [],
        inputs: [{ id: 'coolant', label: 'Coolant Tank', color: '\u00A7b', indices: [0] }],
        outputs: [],
    },
})

const NUCLEAR_REACTOR_INTERFACE_ID = 'uc_heavy_machinery:nuclear_reactor_controls'
const nuclearReactorButtons = {
    power: {
        slot: 5,
        onPress: ({ entity }) => {
            if (!entity) return
            const data = getReactorData(entity)
            setReactorRunning(data, data.state === 'off')
            saveReactorData(entity, data)
        },
    },
    accept: {
        slot: POWER_ACCEPT_SLOT,
        onPress: ({ entity }) => applyPowerSetpoint(entity),
    },
    cancel: {
        slot: POWER_CANCEL_SLOT,
        onPress: ({ entity }) => resetPowerInput(entity),
    },
    delete: {
        slot: POWER_DELETE_SLOT,
        onPress: ({ entity }) => deletePowerInput(entity),
    },
}

for (const slot of Object.keys(POWER_KEYPAD_BY_SLOT).map(Number)) {
    nuclearReactorButtons[`keypad_${slot}`] = {
        slot,
        onPress: ({ entity }) => appendPowerInput(slot, entity),
    }
}

InterfaceManager.registerInterface(NUCLEAR_REACTOR_INTERFACE_ID, { buttons: nuclearReactorButtons })
InterfaceManager.linkBlockInterface('utilitycraft:nuclear_reactor_controller', NUCLEAR_REACTOR_INTERFACE_ID)

DoriosLib.registry.blockComponent('utilitycraft:nuclear_reactor', {
    onPlayerInteract(e) {
        return MultiblockGenerator.handlePlayerInteract(e, GENERATOR_CONFIG, {
            initializeEntity(entity) {
                setPowerInputText(entity, `${config.initialData.power}`)
                FluidStorage.initializeMultiple(entity, 1)
                InterfaceManager.ensureEntityInterfaces(entity)
            },
            onActivate: ({ entity, components, energyCap, settings, structure }) => {
                const transferRate = energyCap / settings.multiblock.transfer_rate_ratio
                const fuelAssemblies = components.fuel_assemblies ?? 0
                const rodControls = components.rod_control ?? 0
                const heatConductors = components.heat_conductor ?? 0
                const emptyBlocks = components.air ?? 0
                const fuelCapacity = fuelAssemblies * config.fuelCapacityPerAssembly
                const coolantCapacity = emptyBlocks * config.coolantCapacityPerEmptyBlock
                const controlEfficiency = getControlEfficiency(fuelAssemblies, rodControls)
                const maximumBurnRate = getMaximumBurnRate(fuelAssemblies, rodControls)

                entity.setDynamicProperty('dorios:rateSpeed', transferRate)
                entity.setDynamicProperty('nuclearStats', JSON.stringify({
                    fuelAssemblies,
                    rodControls,
                    heatConductors,
                    emptyBlocks,
                    fuelCapacity,
                    coolantCapacity,
                    controlEfficiency,
                    maximumBurnRate,
                    energyCap,
                    bounds: structure.bounds,
                }))

                const data = getReactorData(entity)
                setReactorRunning(data, false)
                data.meltdownPending = false
                data.controlEfficiency = controlEfficiency
                data.warning = '\u00A7eStopped'
                saveReactorData(entity, data)
                setPowerInputText(entity, `${data.power ?? config.initialData.power}`)

                const [coolant] = FluidStorage.initializeMultiple(entity, 1)
                coolant.setCap(coolantCapacity)

                ensureItemIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                ensureFluidIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                system.run(() => {
                    if (!entity.isValid) return
                    ensureItemIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                    ensureFluidIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                    InterfaceManager.ensureEntityInterfaces(entity)
                })
            },
            successMessages: ({ components, energyCap, settings }) => {
                const fuelAssemblies = components.fuel_assemblies ?? 0
                const rodControls = components.rod_control ?? 0
                const emptyBlocks = components.air ?? 0
                const heatConductors = components.heat_conductor ?? 0
                const controlEfficiency = getControlEfficiency(fuelAssemblies, rodControls)
                const maximumBurnRate = getMaximumBurnRate(fuelAssemblies, rodControls)
                const maximumProduction = maximumBurnRate
                    * config.energyPerFuelUnit
                    * config.maximumEfficiency

                return [
                    controlEfficiency < 1
                        ? `\u00A7e[Warning] ${fuelAssemblies - rodControls * config.assembliesPerRodControl} Fuel Assemblies exceed Rod Control capacity.`
                        : '',
                    '\u00A7a[Reactor] Nuclear Reactor structure validated.',
                    `\u00A77Energy Capacity: \u00A7b${EnergyStorage.formatEnergyToText(energyCap)}`,
                    `\u00A77Transfer Rate: \u00A7b${EnergyStorage.formatEnergyToText(energyCap / settings.multiblock.transfer_rate_ratio)}/t`,
                    `\u00A77Fuel Assemblies: \u00A7a${fuelAssemblies}`,
                    `\u00A77Rod Controls: \u00A7a${rodControls}`,
                    `\u00A77Control Efficiency: \u00A7a${(controlEfficiency * 100).toFixed(2)}%`,
                    `\u00A77Fuel Capacity: \u00A7a${formatFuel(fuelAssemblies * config.fuelCapacityPerAssembly)}`,
                    `\u00A77Coolant Capacity: \u00A7b${FluidStorage.formatFluid(emptyBlocks * config.coolantCapacityPerEmptyBlock)}`,
                    `\u00A77Heat Dissipation: \u00A7b${(heatConductors * config.conductorHeatDissipation).toFixed(2)} K/t`,
                    `\u00A77Maximum Production: \u00A7b${EnergyStorage.formatEnergyToText(maximumProduction)}/t`,
                ]
            },
        })
    },
    onPlayerBreak({ block, brokenBlockPermutation, player }) {
        Multiblock.DeactivationManager.handleBreakController(
            block,
            player,
            GENERATOR_CONFIG.deactivateConfig,
            brokenBlockPermutation,
        )
    },
    onTick({ block }) {
        if (!worldLoaded) return

        const reactor = new MultiblockGenerator(block, GENERATOR_CONFIG)
        if (!reactor.valid) return

        const { entity, energy } = reactor
        reactor.setRate(entity.getDynamicProperty('dorios:rateSpeed') ?? 0)
        energy.transferToNetwork(reactor.rate)

        const data = getReactorData(entity)
        synchronizeReactorTimer(data)
        const container = reactor.container
        const fuelInputWarning = loadFuelFromInput(container, data)

        const [coolant] = FluidStorage.initializeMultiple(entity, 1)
        coolant.setCap(data.coolantCapacity ?? 0)
        coolant.display(2)

        const coolantType = coolant.getType()
        const coolantData = coolantType in coolants ? coolants[coolantType] : undefined
        const coolantAmount = coolant.get()
        const powerFraction = clamp((data.power ?? 0) / 100, 0, 1)
        const tickDelta = Math.max(1, reactor.processingInterval ?? 1)
        const maximumBurnRate = getMaximumBurnRate(data.fuelAssemblies, data.rodControls)
        const requestedBurn = maximumBurnRate * powerFraction * tickDelta
        const energyFreeSpace = energy.getFreeSpace()
        const operatingEfficiency = getTemperatureEfficiency(data.temperature)

        data.controlEfficiency = getControlEfficiency(data.fuelAssemblies, data.rodControls)
        data.efficiency = operatingEfficiency
        data.activeRate = 0
        data.producing = 0
        let working = false
        let generatedHeat = 0

        if (data.state !== 'off' && requestedBurn > 0 && data.fuelStored > 0 && energyFreeSpace > 0) {
            const maximumFuelByEnergy = energyFreeSpace
                / (config.energyPerFuelUnit * operatingEfficiency)
            const consumedFuel = Math.min(data.fuelStored, requestedBurn, maximumFuelByEnergy)

            if (consumedFuel > 0) {
                data.fuelStored = Math.max(0, data.fuelStored - consumedFuel)
                const producedEnergy = consumedFuel
                    * config.energyPerFuelUnit
                    * operatingEfficiency
                energy.add(producedEnergy)
                generatedHeat = consumedFuel * config.heatPerFuelUnit
                data.activeRate = consumedFuel / tickDelta
                data.producing = producedEnergy / tickDelta
                working = true
            }
        }

        const heatDissipation = (data.heatConductors ?? 0) * config.conductorHeatDissipation
        const hasCoolant = Boolean(coolantData && coolantAmount > 0)
        const maximumCoolantHeat = hasCoolant
            ? coolantAmount / config.coolantPerKelvin * coolantData.efficiency
            : 0
        const thermalStep = advanceReactorTemperature({
            temperature: data.temperature,
            ambientTemperature: config.ambientTemperatureK,
            maximumTemperature: config.maximumTemperatureK,
            idealTemperatureFraction: config.idealTemperatureFraction,
            generatedHeat,
            conductorCoolingAtIdeal: heatDissipation * tickDelta,
            tickDelta,
            hasCoolant,
            maximumCoolantHeat,
            responseTimeSeconds: config.thermalResponseTimeSeconds,
        })
        data.temperature = thermalStep.temperature

        if (thermalStep.coolantHeatRemoved > 0) {
            if (data.state !== 'off') spawnReactorVentSmoke(entity)
            coolant.consume(
                thermalStep.coolantHeatRemoved
                    * config.coolantPerKelvin
                    / coolantData.efficiency,
            )
        }

        data.temperature = clamp(
            data.temperature,
            config.ambientTemperatureK,
            config.maximumTemperatureK,
        )
        data.efficiency = getTemperatureEfficiency(data.temperature)

        data.warning = getOperatingStatus({
            data,
            working,
            fuelInputWarning,
            coolantType,
            coolantData,
            coolantAmount,
            energyFreeSpace,
        })

        if (data.temperature >= config.meltdownTemperatureK) {
            triggerMeltdown(reactor, data)
        } else if (data.temperature >= config.overheatWarningK) {
            data.warning = '\u00A76Overheating!'
        }

        updateReactorUI(data, reactor, coolant)
        reactor.displayEnergy()
        saveReactorData(entity, data)
    },
})

function loadFuelFromInput(container, data) {
    const input = container?.getItem(FUEL_INPUT_SLOT)
    if (!input) return ''

    const fuel = NUCLEAR_FUELS[input.typeId]
    if (!fuel) return '\u00A7cInvalid Nuclear Fuel'

    const freeSpace = Math.max(0, (data.fuelCapacity ?? 0) - (data.fuelStored ?? 0))
    const rodsToLoad = Math.min(input.amount, Math.floor(freeSpace / fuel.fuelUnits))
    if (rodsToLoad <= 0) return ''

    data.fuelStored += rodsToLoad * fuel.fuelUnits
    const remaining = input.amount - rodsToLoad
    if (remaining <= 0) {
        container.setItem(FUEL_INPUT_SLOT)
    } else {
        input.amount = remaining
        container.setItem(FUEL_INPUT_SLOT, input)
    }

    return ''
}

function getOperatingStatus({ data, working, fuelInputWarning, coolantType, coolantData, coolantAmount, energyFreeSpace }) {
    if (data.state === 'off') return '\u00A7eStopped'
    if (fuelInputWarning) return fuelInputWarning
    if ((data.power ?? 0) <= 0) return '\u00A7ePower Setpoint 0%'
    if ((data.fuelStored ?? 0) <= 0) return '\u00A7eMissing Fuel'
    if (energyFreeSpace <= 0) return '\u00A7eEnergy Full'
    if (coolantType !== 'empty' && !coolantData) return '\u00A7cInvalid Coolant'
    if (working && coolantAmount <= 0) return '\u00A7cMissing Coolant'
    if (working) return '\u00A72Active'
    return '\u00A77Idle'
}

function triggerMeltdown(reactor, data) {
    if (data.meltdownPending) return

    data.meltdownPending = true
    setReactorRunning(data, false)
    data.warning = '\u00A7cCore meltdown!'
    saveReactorData(reactor.entity, data)
    Multiblock.DeactivationManager.deactivateMultiblock(
        reactor.block,
        undefined,
        GENERATOR_CONFIG.deactivateConfig,
    )

    DoriosLib.time.runAfterSeconds(4, () => {
        const bounds = data.bounds
        if (bounds) {
            const center = Multiblock.EntityManager.getCenter(bounds.min, bounds.max)
            const radius = Math.max(4, Multiblock.EntityManager.getVolume(bounds) ** (1 / 3) * 0.4)
            reactor.dimension.createExplosion(
                { x: center.x + 0.5, y: center.y + 0.5, z: center.z + 0.5 },
                radius,
                { causesFire: true, breaksBlocks: true, allowUnderwater: true },
            )
            return
        }

        reactor.dimension.createExplosion(
            reactor.entity.location,
            4,
            { causesFire: true, breaksBlocks: true, allowUnderwater: true },
        )
    })
}

function getControlEfficiency(fuelAssemblies = 0, rodControls = 0) {
    if (fuelAssemblies <= 0) return 0
    return clamp(
        rodControls * config.assembliesPerRodControl / fuelAssemblies,
        0,
        1,
    )
}

function getMaximumBurnRate(fuelAssemblies = 0, rodControls = 0) {
    return fuelAssemblies
        * config.burnRatePerAssembly
        * getControlEfficiency(fuelAssemblies, rodControls)
}

function getTemperatureEfficiency(temperature = config.ambientTemperatureK) {
    const temperatureSpan = Math.max(
        1,
        config.maximumTemperatureK - config.ambientTemperatureK,
    )
    const normalizedTemperature = clamp(
        (temperature - config.ambientTemperatureK) / temperatureSpan,
        0,
        1,
    )
    const ideal = config.idealTemperatureFraction
    const distance = Math.abs(normalizedTemperature - ideal) / ideal
    const baseShape = Math.max(0, 1 - distance ** config.efficiencyGamma)
    const shape = normalizedTemperature < ideal
        ? baseShape ** config.coldEfficiencyAlpha
        : baseShape ** config.hotEfficiencyAlpha

    return config.minimumEfficiency
        + (config.maximumEfficiency - config.minimumEfficiency) * shape
}

function updateReactorUI(data, reactor, coolant) {
    const storedEnergy = reactor.energy.get()
    const fuelCapacity = data.fuelCapacity ?? 0
    const fuelStored = data.fuelStored ?? 0
    const fuelPercent = fuelCapacity > 0 ? fuelStored / fuelCapacity * 100 : 0
    const coolantType = coolant.getType()
    const coolantName = coolantType === 'empty'
        ? 'None'
        : DoriosLib.text.formatIdentifier(coolantType)
    const coolantStored = coolant.get()
    const coolantCapacity = coolant.getCap()
    const coolantPercent = coolantCapacity > 0
        ? coolantStored / coolantCapacity * 100
        : 0

    reactor.setLabel([
        `\u00A7r\u00A77Status: ${data.warning || '\u00A77Idle'}\n\n\u00A7r\u00A7eReactor Information`,
        `\n\u00A7r\u00A7aPower \u00A7f${(data.power ?? 0).toFixed(2)}%%\n\u00A7r\u00A7aTemperature \u00A7f${(data.temperature ?? 0).toFixed(2)} K\n\u00A7r\u00A7aEfficiency \u00A7f${((data.efficiency ?? 0) * 100).toFixed(2)}%%\n\u00A7r\u00A7aOn Time \u00A7f${formatReactorOnTime(data)}`,
        `\n\u00A7r\u00A7eEnergy Information\n\n\u00A7r\u00A7bProducing \u00A7f${EnergyStorage.formatEnergyToText(data.producing ?? 0)}/t\n\u00A7r\u00A7bCapacity \u00A7f${reactor.energy.getPercent().toFixed(2)}%%\n\u00A7r\u00A7bStored \u00A7f${EnergyStorage.formatEnergyToText(storedEnergy)}`,
        `\n\u00A7r\u00A7eFuel Information\n\n\u00A7r\u00A7aStored \u00A7f${formatFuel(fuelStored)}\n\u00A7r\u00A7aCapacity \u00A7f${formatFuel(fuelCapacity)}\n\u00A7r\u00A7aFuel \u00A7f${fuelPercent.toFixed(2)}%%`,
        `\n\u00A7r\u00A7eCoolant Information\n\n\u00A7r\u00A7aType \u00A7f${coolantName}\n\u00A7r\u00A7aStored \u00A7f${FluidStorage.formatFluid(coolantStored)} / ${FluidStorage.formatFluid(coolantCapacity)}\n\u00A7r\u00A7aCoolant \u00A7f${coolantPercent.toFixed(2)}%%`,
    ])

    updateFuelBar(reactor.container, fuelStored, fuelCapacity)
    updateTemperatureBar(reactor.container, data.temperature)
}

function updateFuelBar(container, fuelStored, fuelCapacity) {
    if (!container) return

    const fraction = fuelCapacity > 0 ? clamp(fuelStored / fuelCapacity, 0, 1) : 0
    const frame = Math.floor(fraction * 42)
    const item = new ItemStack(`utilitycraft:uranium_bar_${String(frame).padStart(2, '0')}`, 1)
    item.nameTag = `\u00A7rNuclear Fuel\n\u00A7r\u00A77  Stored: ${formatFuel(fuelStored)} / ${formatFuel(fuelCapacity)}\n\u00A7r\u00A77  Percentage: ${(fraction * 100).toFixed(2)}%`
    container.setItem(3, item)
}

function updateTemperatureBar(container, temperature) {
    if (!container) return

    const fraction = clamp(
        (temperature - config.ambientTemperatureK)
            / (config.maximumTemperatureK - config.ambientTemperatureK),
        0,
        1,
    )
    const frame = Math.floor(fraction * 31)
    const item = new ItemStack(`utilitycraft:temperature_${String(frame).padStart(2, '0')}`, 1)
    item.nameTag = `\u00A7r\u00A7f${temperature.toFixed(2)} K`
    container.setItem(4, item)
}

function appendPowerInput(slot, entity) {
    if (!entity) return

    const pressedValue = POWER_KEYPAD_BY_SLOT[slot]
    if (pressedValue === undefined) return
    const currentText = getPowerInputText(entity)
    if (pressedValue === '.' && currentText.includes('.')) return
    if (currentText.length >= POWER_INPUT_MAX_LENGTH) return

    const nextText = currentText === '0' && pressedValue !== '.'
        ? pressedValue
        : `${currentText}${pressedValue}`
    setPowerInputText(entity, nextText || '0')
}

function getPowerInputText(entity) {
    const container = entity?.getComponent('inventory')?.container
    if (!container) return '0'

    const label = container.getItem(POWER_INPUT_SLOT)?.nameTag ?? ''
    const cleanLabel = label.replace(/\u00A7./g, '')
    return cleanLabel.match(/([\d.]+)\s*%/)?.[1] || '0'
}

function setPowerInputText(entity, text = '0') {
    if (!entity) return

    DoriosLib.entity.setNewItem(entity, {
        slot: POWER_INPUT_SLOT,
        typeId: POWER_INPUT_ITEM,
        nameTag: `\n\u00A7r\u00A7fSet the burn rate for \nthe reactor!\n\n ${text || '0'}%%`,
    })
}

function deletePowerInput(entity) {
    const currentText = getPowerInputText(entity)
    setPowerInputText(entity, currentText.length > 1 ? currentText.slice(0, -1) : '0')
}

function resetPowerInput(entity) {
    setPowerInputText(entity, '0')
}

function applyPowerSetpoint(entity) {
    if (!entity) return

    const parsed = Number.parseFloat(getPowerInputText(entity))
    const power = Number.isFinite(parsed) ? clamp(parsed, 0, 100) : 0
    const data = getReactorData(entity)
    data.power = power
    saveReactorData(entity, data)
    setPowerInputText(entity, `${power}`)
}

function getReactorData(entity) {
    let persisted = {}
    let stats = {}

    try {
        const rawData = entity.getDynamicProperty('nuclearData')
        if (rawData) persisted = JSON.parse(rawData)
    } catch { }

    try {
        const rawStats = entity.getDynamicProperty('nuclearStats')
        if (rawStats) stats = JSON.parse(rawStats)
    } catch { }

    const data = {
        ...config.initialData,
        ...persisted,
        fuelAssemblies: 0,
        rodControls: 0,
        heatConductors: 0,
        emptyBlocks: 0,
        fuelCapacity: 0,
        coolantCapacity: 0,
        maximumBurnRate: 0,
        energyCap: 0,
        ...stats,
    }

    if (entity.getDynamicProperty('dorios:state') === 'off') data.state = 'off'
    return data
}

function saveReactorData(entity, data) {
    entity.setDynamicProperty('nuclearData', JSON.stringify(data))
}

function formatFuel(amount = 0) {
    return `${Math.max(0, amount).toFixed(2)} FU`
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0))
}
