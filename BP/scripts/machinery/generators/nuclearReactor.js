import { ItemStack, system, world } from '@minecraft/server'
import {
    EnergyStorage,
    FluidStorage,
    GasStorage,
    TemperatureStorage,
    InterfaceManager,
    Multiblock,
    MultiblockGenerator,
    registerLinkNodeIO,
} from 'DoriosCore/index.js'
import { ensureFluidIOConfig } from 'DoriosCore/interfaces/fluidIO.js'
import { ensureGasIOConfig } from 'DoriosCore/interfaces/gasIO.js'
import { ensureItemIOConfig } from 'DoriosCore/interfaces/itemIO.js'
import * as DoriosLib from 'DoriosLib/index.js'
import { coolants } from 'config/coolants.js'
import { NUCLEAR_THERMAL, getNuclearHeatCapacity, getNuclearEfficiency, simulateNuclearReactor } from './nuclearSimulation.js'
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
    wasteMbPerFuelUnit: 1,
    wasteCapacityPerGasCell: 256_000,

    coolantCapacityPerEmptyBlock: 64_000,
    minimumCoolantTier: 2,

    initialData: {
        state: 'off',
        rate: 1,
        fuelStored: 0,
        fuelType: 'empty',
        temperature: 300,
        producing: 0,
        activeRate: 0,
        controlEfficiency: 0,
        efficiency: 0.10,
        startedAtMs: 0,
        warning: '',
        wasteRemainder: 0,
        coolantCreditMb: 0,
        coolantCreditType: 'empty',
    },
}

const runtimeCache = new WeakMap()
const statsCache = new WeakMap()

const FUEL_INPUT_SLOT = 21
const RATE_INPUT_SLOT = 6
const RATE_INPUT_ITEM = 'utilitycraft:arrow_right_0'
const RATE_KEYPAD_BY_SLOT = {
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
const RATE_ACCEPT_SLOT = 18
const RATE_CANCEL_SLOT = 19
const RATE_DELETE_SLOT = 20

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
        gas_cell: {
            amount: 1,
            warning: '\u00A7c[Reactor] At least 1 Gas Cell is required for waste storage.',
        },
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

const FUEL_PROFILES = {
    uranium: { label: 'Uranium', burnRateMultiplier: 0.35, efficiencyMultiplier: 0.60 },
    enriched_uranium: { label: 'Enriched Uranium', burnRateMultiplier: 1, efficiencyMultiplier: 1 },
}

const NUCLEAR_FUELS = {
    'utilitycraft:uranium_rod': { fuelType: 'uranium', fuelUnits: 250 },
    'utilitycraft:enriched_uranium_rod': { fuelType: 'enriched_uranium', fuelUnits: config.fuelUnitsPerRod },
}

registerLinkNodeIO('utilitycraft:nuclear_reactor_controller', {
    gases: {
        anyInputIndices: [],
        anyOutputIndices: [0],
        inputs: [],
        outputs: [{ id: 'waste', label: 'Waste', color: '\u00A76', indices: [0] }],
    },
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
            if (data.meltdownPending) return
            setReactorRunning(data, data.state === 'off')
            saveReactorData(entity, data)
        },
    },
    accept: {
        slot: RATE_ACCEPT_SLOT,
        onPress: ({ entity }) => applyBurnRate(entity),
    },
    cancel: {
        slot: RATE_CANCEL_SLOT,
        onPress: ({ entity }) => resetRateInput(entity),
    },
    delete: {
        slot: RATE_DELETE_SLOT,
        onPress: ({ entity }) => deleteRateInput(entity),
    },
}

for (const slot of Object.keys(RATE_KEYPAD_BY_SLOT).map(Number)) {
    nuclearReactorButtons[`keypad_${slot}`] = {
        slot,
        onPress: ({ entity }) => appendRateInput(slot, entity),
    }
}

InterfaceManager.registerInterface(NUCLEAR_REACTOR_INTERFACE_ID, { buttons: nuclearReactorButtons })
InterfaceManager.linkBlockInterface('utilitycraft:nuclear_reactor_controller', NUCLEAR_REACTOR_INTERFACE_ID)
InterfaceManager.linkEntityInterface('utilitycraft:nuclear_reactor', NUCLEAR_REACTOR_INTERFACE_ID)

// Migrate legacy entry labels on UI-open, not by polling the keypad every tick.
world.afterEvents.entityContainerOpened.subscribe(({ entity }) => {
    if (entity?.typeId !== 'utilitycraft:nuclear_reactor') return
    const container = entity.getComponent('minecraft:inventory')?.container
    if (!(container?.getItem(RATE_INPUT_SLOT)?.nameTag ?? '').includes('FU/t')) {
        setRateInputText(entity, String(getReactorData(entity).rate))
    }
})

DoriosLib.registry.blockComponent('utilitycraft:nuclear_reactor', {
    onPlayerInteract(e) {
        return MultiblockGenerator.handlePlayerInteract(e, GENERATOR_CONFIG, {
            initializeEntity(entity) {
                setRateInputText(entity, `${config.initialData.rate}`)
                GasStorage.initializeMultiple(entity, 1)
                FluidStorage.initializeMultiple(entity, 1)
                InterfaceManager.ensureEntityInterfaces(entity)
            },
            onActivate: ({ entity, components, energyCap, settings, structure }) => {
                const transferRate = energyCap / settings.multiblock.transfer_rate_ratio
                const fuelAssemblies = components.fuel_assemblies ?? 0
                const rodControls = components.rod_control ?? 0
                const heatConductors = components.heat_conductor ?? 0
                const emptyBlocks = components.air ?? 0
                const gasCells = components.gas_cell ?? 0
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
                    gasCells,
                    fuelCapacity,
                    coolantCapacity,
                    controlEfficiency,
                    maximumBurnRate,
                    energyCap,
                    bounds: structure.bounds,
                    heatCapacity: getNuclearHeatCapacity(structure.bounds, components),
                }))

                runtimeCache.delete(entity)
                const data = getReactorData(entity)
                setReactorRunning(data, false)
                data.meltdownPending = false
                data.controlEfficiency = controlEfficiency
                data.warning = '\u00A7eStopped'
                saveReactorData(entity, data)
                setRateInputText(entity, `${data.rate ?? config.initialData.rate}`)

                const [coolant] = FluidStorage.initializeMultiple(entity, 1)
                coolant.setCap(coolantCapacity)
                const [waste] = GasStorage.initializeMultiple(entity, 1)
                waste.setCap(gasCells * config.wasteCapacityPerGasCell)

                ensureItemIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                ensureFluidIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                ensureGasIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                system.run(() => {
                    if (!entity.isValid) return
                    ensureItemIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                    ensureFluidIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                    ensureGasIOConfig(entity, 'utilitycraft:nuclear_reactor_controller')
                    InterfaceManager.ensureEntityInterfaces(entity)
                })
            },
            successMessages: ({ components, energyCap, settings }) => {
                const fuelAssemblies = components.fuel_assemblies ?? 0
                const rodControls = components.rod_control ?? 0
                const emptyBlocks = components.air ?? 0
                const gasCells = components.gas_cell ?? 0
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
                    `\u00A77Waste Capacity: \u00A76${GasStorage.formatGas(gasCells * config.wasteCapacityPerGasCell)} (${gasCells} Gas Cells)`,
                    `\u00A77Coolant Capacity: \u00A7b${FluidStorage.formatFluid(emptyBlocks * config.coolantCapacityPerEmptyBlock)}`,
                    `\u00A77Thermal Conductance: \u00A7b${(heatConductors * NUCLEAR_THERMAL.conductorConductance).toFixed(3)} HU/(t K)`,
                    `\u00A77Nominal Production: \u00A7b${EnergyStorage.formatEnergyToText(maximumProduction)}/t`,
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
        const runtime = getReactorRuntime(entity, data)
        const { coolant, waste, temperature } = runtime
        const tickDelta = Math.max(1, reactor.processingInterval ?? 1)
        synchronizeReactorTimer(data)
        const fuelInputWarning = loadFuelFromInput(reactor.container, data)
        const fuelProfile = FUEL_PROFILES[data.fuelType]
        const currentTemperature = temperature.get()
        // Settle only floating-point cooling residue; hot stopped reactors still cool normally.
        if (data.state === 'off' && !data.meltdownPending
            && Math.abs(currentTemperature - config.ambientTemperatureK) <= 1e-6) {
            if (currentTemperature !== config.ambientTemperatureK) temperature.set(config.ambientTemperatureK)
            data.temperature = config.ambientTemperatureK
            data.producing = 0
            data.activeRate = 0
            data.efficiency = config.minimumEfficiency * (fuelProfile?.efficiencyMultiplier ?? 0)
            data.warning = '\u00A7eStopped'
            displayNuclearReactor(data, reactor, runtime)
            saveReactorData(entity, data)
            return
        }
        const wasteType = waste.getType()
        const wasteCompatible = wasteType === 'empty' || wasteType === 'nuclear_waste_gas'
        const pendingWaste = Math.max(0, data.wasteRemainder ?? 0)
        const wasteFreeSpace = wasteCompatible ? Math.max(0, waste.getFreeSpace() - pendingWaste) : 0
        const coolantAmount = coolant.get()
        const storedCoolantType = coolant.getType()
        // Credit is prepaid fractional mB. Switching fluid discards unused credit.
        if (storedCoolantType !== 'empty' && storedCoolantType !== data.coolantCreditType) data.coolantCreditMb = 0
        const coolantType = storedCoolantType === 'empty' && data.coolantCreditMb > 0
            ? data.coolantCreditType : storedCoolantType
        const coolantData = coolants[coolantType]
        const validCoolant = coolantData?.tier >= config.minimumCoolantTier
            && Number.isFinite(coolantData.efficiency) && coolantData.efficiency > 0
        const heatPerMb = validCoolant ? NUCLEAR_THERMAL.coolantHeatPerMb * coolantData.efficiency : 0
        const energyFreeSpace = energy.getFreeSpace()
        const result = simulateNuclearReactor({
            temperature: currentTemperature,
            heatCapacity: data.heatCapacity,
            ticks: tickDelta,
            running: data.state !== 'off' && !data.meltdownPending,
            rate: data.rate,
            nominalRate: data.maximumBurnRate * (fuelProfile?.burnRateMultiplier ?? 0),
            fuelEfficiency: fuelProfile?.efficiencyMultiplier ?? 0,
            fuel: Math.max(0, data.fuelStored),
            energySpace: energyFreeSpace,
            wasteSpace: wasteFreeSpace,
            conductance: data.heatConductors * NUCLEAR_THERMAL.conductorConductance,
            coolantHeatBudget: (coolantAmount + (data.coolantCreditMb ?? 0)) * heatPerMb,
        }, config)

        if (result.consumedFuel > 0) {
            data.fuelStored = Math.max(0, data.fuelStored - result.consumedFuel)
            energy.add(result.producedEnergy)
            const totalWaste = pendingWaste + result.consumedFuel * config.wasteMbPerFuelUnit
            const wholeWaste = Math.floor(totalWaste + 1e-9)
            if (wholeWaste > 0) {
                if (wasteType !== 'nuclear_waste_gas') waste.setType('nuclear_waste_gas')
                data.wasteRemainder = Math.max(0, totalWaste - waste.add(wholeWaste))
            } else data.wasteRemainder = totalWaste
        }
        if (result.coolantHeatRemoved > 0) {
            const usedMb = result.coolantHeatRemoved / heatPerMb
            const paidMb = Math.min(coolantAmount, Math.ceil(Math.max(0, usedMb - (data.coolantCreditMb ?? 0)) - 1e-9))
            if (paidMb > 0) coolant.consume(paidMb)
            data.coolantCreditMb = Math.max(0, (data.coolantCreditMb ?? 0) + paidMb - usedMb)
            data.coolantCreditType = coolantType
            if (data.state !== 'off' && system.currentTick >= runtime.nextSmokeTick) {
                spawnReactorVentSmoke(entity)
                runtime.nextSmokeTick = system.currentTick + 20
            }
        }
        data.temperature = result.temperature
        temperature.set(result.temperature)
        data.producing = result.producedEnergy / tickDelta
        data.activeRate = result.consumedFuel / tickDelta
        data.efficiency = getTemperatureEfficiency(result.temperature) * (fuelProfile?.efficiencyMultiplier ?? 0)
        if (data.fuelStored <= 0) data.fuelType = 'empty'
        data.warning = getOperatingStatus({
            data, working: result.consumedFuel > 0, fuelInputWarning, coolantType, coolantData,
            coolantAmount: coolant.get() + (data.coolantCreditMb ?? 0), energyFreeSpace,
            wasteFull: !wasteCompatible || waste.getFreeSpace() - (data.wasteRemainder ?? 0) <= 1e-9,
        })
        if (result.meltdown) {
            triggerMeltdown(reactor, data)
            return
        }
        if (data.temperature >= config.overheatWarningK) data.warning = '\u00A76Overheating!'

        // No string formatting, display-slot reads/writes or UI items when closed.
        displayNuclearReactor(data, reactor, runtime)
        saveReactorData(entity, data)
    },
})

function loadFuelFromInput(container, data) {
    if (data.fuelStored <= 0) data.fuelType = 'empty'
    const input = container?.getItem(FUEL_INPUT_SLOT)
    if (!input) return ''

    const fuel = NUCLEAR_FUELS[input.typeId]
    if (!fuel) return '\u00A7cInvalid Nuclear Fuel'
    if (data.fuelStored > 0 && data.fuelType !== fuel.fuelType) {
        return '\u00A7eWaiting for Current Fuel'
    }

    const freeSpace = Math.max(0, (data.fuelCapacity ?? 0) - (data.fuelStored ?? 0))
    const rodsToLoad = Math.min(input.amount, Math.floor(freeSpace / fuel.fuelUnits))
    if (rodsToLoad <= 0) return ''

    data.fuelType = fuel.fuelType
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

function getOperatingStatus({ data, working, fuelInputWarning, coolantType, coolantData, coolantAmount, energyFreeSpace, wasteFull }) {
    if (data.state === 'off') return '\u00A7eStopped'
    if (wasteFull) return '\u00A7eWaste Full'
    if (fuelInputWarning) return fuelInputWarning
    if (data.rate <= 0) return '\u00A7eRate Setpoint 0 FU/t'
    if ((data.fuelStored ?? 0) <= 0) return '\u00A7eMissing Fuel'
    if (energyFreeSpace <= 0) return '\u00A7eEnergy Full'
    if (coolantType !== 'empty' && !coolantData) return '\u00A7cInvalid Coolant'
    if (coolantType !== 'empty' && coolantData?.tier < config.minimumCoolantTier) {
        return '\u00A7cRequires Tier 2+ Coolant'
    }
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
    return getNuclearEfficiency(temperature, config)
}

function setLabelIfChanged(reactor, text, slot) {
    if (reactor.container.getItem(slot)?.nameTag !== text) reactor.setLabel(text, slot)
}

function updateReactorUI(data, reactor, coolant, waste) {
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

    setLabelIfChanged(reactor, [
        '\u00A7r' + (data.warning || '\u00A7eIdle'),
        '',
        '\u00A7r\u00A7cRate: \u00A7f' + formatFuel(data.rate) + '/t',
        '\u00A7r\u00A7aTemperature: \u00A7f' + (data.temperature ?? 0).toFixed(0) + 'K',
        '\u00A7r\u00A7aEfficiency: \u00A7f' + ((data.efficiency ?? 0) * 100).toFixed(1) + '%%',
        '',
        '\u00A7r\u00A7bProducing: \u00A7f' + EnergyStorage.formatEnergyToText(data.producing ?? 0) + '/t',
        '\u00A7r\u00A7bCapacity: \u00A7f' + reactor.energy.getPercent().toFixed(1) + '%%',
        '\u00A7r\u00A7bStored: \u00A7f' + EnergyStorage.formatEnergyToText(storedEnergy),
        '',
        '\u00A7r\u00A7aOn time: \u00A7f' + formatReactorOnTime(data),
    ].join('\n'), 1)
    // Extra display slots are never exposed as interactive inventory cells.
    if (reactor.container.size > 23) {
        setLabelIfChanged(reactor, [
            '\u00A7r\u00A7eFuel Information',
            '\u00A7r\u00A7aType: \u00A7f' + (FUEL_PROFILES[data.fuelType]?.label ?? 'Empty'),
            '\u00A7r\u00A7aReserve: \u00A7f' + fuelPercent.toFixed(0) + '%%',
            '',
            '\u00A7r\u00A7eCoolant Information',
            '\u00A7r\u00A7aType: \u00A7f' + coolantName,
            '\u00A7r\u00A7aReserve: \u00A7f' + coolantPercent.toFixed(0) + '%%',
            '',
            '\u00A7r\u00A7eWaste Information',
            '\u00A7r\u00A7aStored: \u00A7f' + GasStorage.formatGas(waste.get()),
            '\u00A7r\u00A7aFilled: \u00A7f' + (waste.getCap() > 0 ? waste.get() / waste.getCap() * 100 : 0).toFixed(0) + '%%',
        ].join('\n'), 22)
        setLabelIfChanged(reactor, '\u00A7r\u00A78Current Rate: ' + formatFuel(data.rate) + '/t', 23)
    }

    if (reactor.container.size > 25) {
        setLabelIfChanged(reactor, '\u00A7r\u00A78Recommended Rate:\n'
            + formatFuel(getRecommendedRate(data, coolant)) + '/t', 25)
    }
    updateFuelBar(reactor.container, data)
}

function updateFuelBar(container, data) {
    if (!container) return

    const fuelStored = data.fuelStored ?? 0
    const fuelCapacity = data.fuelCapacity ?? 0
    const profile = FUEL_PROFILES[data.fuelType]
    const maximumEfficiency = config.maximumEfficiency * (profile?.efficiencyMultiplier ?? 0)
    const fraction = fuelCapacity > 0 ? clamp(fuelStored / fuelCapacity, 0, 1) : 0
    const frame = Math.floor(fraction * 42)
    const typeId = `utilitycraft:uranium_bar_${String(frame).padStart(2, '0')}`
    const nameTag = [
        '\u00A7rNuclear Fuel',
        `\u00A7r\u00A77  Type: ${profile?.label ?? 'Empty'}`,
        `\u00A7r\u00A77  Stored: ${formatFuel(fuelStored)} / ${formatFuel(fuelCapacity)}`,
        `\u00A7r\u00A77  Max Efficiency: ${(maximumEfficiency * 100).toFixed(2)}%`,
    ].join('\n')
    const previous = container.getItem(3)
    if (previous?.typeId === typeId && previous.nameTag === nameTag) return
    const item = new ItemStack(typeId, 1)
    item.nameTag = nameTag
    container.setItem(3, item)
}

function appendRateInput(slot, entity) {
    if (!entity) return

    const pressedValue = RATE_KEYPAD_BY_SLOT[slot]
    if (pressedValue === undefined) return
    const currentText = getRateInputText(entity)
    if (pressedValue === '.' && currentText.includes('.')) return

    const nextText = currentText === '0' && pressedValue !== '.'
        ? pressedValue
        : `${currentText}${pressedValue}`
    setRateInputText(entity, nextText || '0')
}

function getRateInputText(entity) {
    const container = entity?.getComponent('inventory')?.container
    if (!container) return '0'

    const label = container.getItem(RATE_INPUT_SLOT)?.nameTag ?? ''
    const cleanLabel = label.replace(/\u00A7./g, '')
    return cleanLabel.match(/([\d.eE+-]+)\s*FU\/t/)?.[1] || '0'
}

function setRateInputText(entity, text = '0') {
    if (!entity) return

    DoriosLib.entity.setNewItem(entity, {
        slot: RATE_INPUT_SLOT,
        typeId: RATE_INPUT_ITEM,
        nameTag: `\u00A7r\u00A7f${text || '0'} FU/t`,
    })
}

function deleteRateInput(entity) {
    const currentText = getRateInputText(entity)
    setRateInputText(entity, currentText.length > 1 ? currentText.slice(0, -1) : '0')
}

function resetRateInput(entity) {
    setRateInputText(entity, '0')
}

function applyBurnRate(entity) {
    if (!entity) return

    const parsed = Number.parseFloat(getRateInputText(entity))
    const rate = Number.isFinite(parsed) ? Math.max(0, parsed) : 0
    const data = getReactorData(entity)
    data.rate = rate
    saveReactorData(entity, data)
    setRateInputText(entity, `${rate}`)
    DoriosLib.entity.setNewItem(entity, {
        slot: 23, typeId: 'utilitycraft:arrow_indicator_90',
        nameTag: '\u00A7r\u00A78Current Rate: ' + formatFuel(rate) + '/t',
    })
}

function getReactorData(entity) {
    let persisted = {}
    const stats = getReactorStats(entity)

    try {
        const rawData = entity.getDynamicProperty('nuclearData')
        if (rawData) persisted = JSON.parse(rawData)
    } catch { }

    const data = {
        ...config.initialData,
        ...persisted,
        fuelAssemblies: 0,
        rodControls: 0,
        heatConductors: 0,
        emptyBlocks: 0,
        gasCells: 0,
        fuelCapacity: 0,
        coolantCapacity: 0,
        maximumBurnRate: 0,
        energyCap: 0,
        ...stats,
    }

    // Convert older percentage-based saves to their equivalent FU/t once.
    if (!Number.isFinite(persisted.rate) && Number.isFinite(persisted.power)) {
        data.rate = getMaximumBurnRate(data.fuelAssemblies, data.rodControls)
            * (FUEL_PROFILES[data.fuelType]?.burnRateMultiplier ?? 1)
            * clamp(persisted.power / 100, 0, 1)
    }
    data.rate = Number.isFinite(data.rate) ? Math.max(0, data.rate) : config.initialData.rate
    delete data.power
    if (data.fuelStored <= 0) data.fuelType = 'empty'
    if (entity.getDynamicProperty('dorios:state') === 'off') data.state = 'off'
    return data
}

function saveReactorData(entity, data) {
    const state = { ...data }
    for (const key of Object.keys(getReactorStats(entity))) delete state[key]
    const serialized = JSON.stringify(state)
    if (entity.getDynamicProperty('nuclearData') !== serialized) entity.setDynamicProperty('nuclearData', serialized)
}

function formatFuel(amount = 0) {
    return `${Math.max(0, amount).toFixed(2)} FU`
}

function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0))
}

/** Reference equilibrium near ideal temperature; assumes continued coolant supply. */
function getRecommendedRate(data, coolant) {
    const nominal = data.maximumBurnRate * (FUEL_PROFILES[data.fuelType]?.burnRateMultiplier ?? 1)
    const fluid = coolants[coolant.getType()]
    const delta = (config.maximumTemperatureK - config.ambientTemperatureK) * config.idealTemperatureFraction
    const conductance = data.heatConductors * NUCLEAR_THERMAL.conductorConductance
    const passive = conductance * NUCLEAR_THERMAL.passiveCoolingFraction * delta
    const active = fluid?.tier >= config.minimumCoolantTier && coolant.get() > 0
        ? Math.min(conductance * delta, coolant.get() * NUCLEAR_THERMAL.coolantHeatPerMb * fluid.efficiency) : 0
    return Math.max(0, Math.min(nominal, (passive + active) / NUCLEAR_THERMAL.heatPerFuelUnit))
}

function getReactorStats(entity) {
    const raw = entity.getDynamicProperty('nuclearStats')
    const cached = statsCache.get(entity)
    if (cached && cached.raw === raw) return cached.value
    let value = {}
    try { if (raw) value = JSON.parse(raw) } catch { }
    value.maximumBurnRate = getMaximumBurnRate(value.fuelAssemblies ?? 0, value.rodControls ?? 0)
    if (!(value.heatCapacity > 0)) {
        value.heatCapacity = getNuclearHeatCapacity(value.bounds, {
            fuel_assemblies: value.fuelAssemblies ?? 0,
            rod_control: value.rodControls ?? 0,
            heat_conductor: value.heatConductors ?? 0,
            gas_cell: value.gasCells ?? 0,
        })
    }
    statsCache.set(entity, { raw, value })
    return value
}

function getReactorRuntime(entity, data) {
    let runtime = runtimeCache.get(entity)
    if (!runtime) {
        const [coolant] = FluidStorage.initializeMultiple(entity, 1)
        const [waste] = GasStorage.initializeMultiple(entity, 1)
        const temperature = new TemperatureStorage(entity, 0, {
            initialTemperature: data.temperature,
            heatCapacity: data.heatCapacity,
        })
        runtime = { coolant, waste, temperature, stats: null, nextSmokeTick: 0 }
        runtimeCache.set(entity, runtime)
        const type = waste.getType()
        if (type === 'uranium_waste_gas' || type === 'nuclear_waste') waste.setType('nuclear_waste_gas')
    }
    const stats = getReactorStats(entity)
    if (runtime.stats !== stats) {
        runtime.coolant.setCap(data.coolantCapacity)
        runtime.waste.setCap(data.gasCells * config.wasteCapacityPerGasCell)
        if (runtime.temperature.getHeatCapacity() !== data.heatCapacity) runtime.temperature.setHeatCapacity(data.heatCapacity)
        runtime.stats = stats
    }
    return runtime
}

function displayNuclearReactor(data, reactor, runtime) {
    const { coolant, waste, temperature } = runtime
    if (reactor.shouldUpdateUI) {
        coolant.shouldUpdateUI = true
        waste.shouldUpdateUI = true
        coolant.display(2)
        waste.display(24)
        temperature.display(4, { minimum: config.ambientTemperatureK, maximum: config.maximumTemperatureK, force: true })
        updateReactorUI(data, reactor, coolant, waste)
        reactor.displayEnergy()
    }
}
