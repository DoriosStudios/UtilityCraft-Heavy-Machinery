import { EnergyStorage, FluidStorage, Multiblock, MultiblockMachine } from "DoriosCore/index.js"
import { melterRecipes } from 'config/recipes/melter.js'

const OUTPUT_LIQUID_SLOT = 4
const INPUT_SLOTS = [5, 6, 7, 8, 9, 10, 11, 12, 13]
const DEFAULT_COST = 6400
const MULTI_PENALTY = 4
const BASE_RATE = 1600
const FLUID_CAPACITY_CELL = 256_000

const CONTROLLER_REQUIREMENTS = {
    energy_cell: {
        amount: 1,
        warning: '\u00A7c[Controller] At least 1 energy container is required to operate.',
    },
    processing_module: {
        amount: 1,
        warning: '\u00A7c[Controller] At least 1 processing module is required to operate.',
    },
    fluid_cell: {
        amount: 1,
        warning: '\u00A7c[Controller] At least 1 fluid cell is required to operate.',
    },
}

const MULTIBLOCK_CONFIG = {
    required_case: 'dorios:multiblock.case.bronze',
    entity: {
        type: 'complex_machine_fluid',
        inventory_size: 14,
        identifier: 'utilitycraft:multiblock_machine',
        input_range: [5, 13],
    },
    machine: {
        rate_speed_base: BASE_RATE,
        energy_cap: 0,
    },
    requirements: CONTROLLER_REQUIREMENTS,
}

DoriosAPI.register.blockComponent('magmatic_chamber_controller', {
    onPlayerInteract(e) {
        return MultiblockMachine.handlePlayerInteract(e, MULTIBLOCK_CONFIG, {
            initializeEntity(entity) {
                entity.setItem(1, 'utilitycraft:arrow_right_0', 1, ' ')
                entity.setItem(2, 'utilitycraft:arrow_right_0', 1, ' ')
                entity.setItem(3, 'utilitycraft:arrow_right_0', 1, ' ')
                FluidStorage.initializeSingle(entity)
            },
            onActivate: ({ entity, structure }) => {
                const outputFluid = FluidStorage.initializeSingle(entity)
                const fluidCapacity = (structure.components.fluid_cell ?? 0) * FLUID_CAPACITY_CELL
                outputFluid.setCap(fluidCapacity)
            },
            successMessages: ({ energyCap, structure }) => {
                const fluidCapacity = (structure.components.fluid_cell ?? 0) * FLUID_CAPACITY_CELL
                return [
                    '\u00A7a[Controller] Magmatic Chamber created successfully.',
                    `\u00A77[Controller] Energy Capacity: \u00A7b${EnergyStorage.formatEnergyToText(energyCap)}`,
                    `\u00A77[Controller] Fluid Capacity: \u00A7b${FluidStorage.formatFluid(fluidCapacity)}`,
                ]
            },
        })
    },
    onPlayerBreak({ block, player }) {
        Multiblock.DeactivationManager.handleBreakController(block, player)
    },
    onTick(e) {
        if (!worldLoaded) return

        const controller = new MultiblockMachine(e.block, MULTIBLOCK_CONFIG)
        if (!controller.valid) return

        const raw = controller.entity.getDynamicProperty('components')
        const data = raw ? JSON.parse(raw) : {}

        controller.setRate(BASE_RATE * data.speed.multiplier)

        const inv = controller.container
        const outputFluid = FluidStorage.initializeSingle(controller.entity)

        let recipe = null
        let inputType = null
        let totalInput = 0

        for (const slot of INPUT_SLOTS) {
            const item = inv.getItem(slot)
            if (!item) continue

            const candidate = melterRecipes[item.typeId]
            if (!candidate) continue

            if (!recipe) {
                recipe = candidate
                inputType = item.typeId
            }

            if (item.typeId === inputType) {
                totalInput += item.amount
            }
        }

        if (!recipe || !inputType) {
            updateUI(controller, outputFluid, data, '\u00A7eNo Input')
            controller.setProgress(0, { slot: 3 })
            return
        }

        if (outputFluid.getType() !== 'empty' && outputFluid.getType() !== recipe.liquid) {
            updateUI(controller, outputFluid, data, '\u00A7eWrong Output Fluid', recipe)
            controller.setProgress(0, { slot: 3 })
            return
        }

        const required = recipe.required ?? 1
        const outputAmount = recipe.amount ?? 1
        const availableFluidSpace = outputFluid.getFreeSpace()

        const maxProcess = Math.min(
            data.processing.amount,
            Math.floor(totalInput / required),
            Math.floor(availableFluidSpace / outputAmount)
        )

        if (maxProcess <= 0) {
            updateUI(controller, outputFluid, data, '\u00A7eOutput Full', recipe)
            controller.setProgress(0, { slot: 3 })
            return
        }

        const cost = (recipe.cost ?? DEFAULT_COST) * MULTI_PENALTY
        data.cost = cost
        controller.setEnergyCost(cost)

        const progress = controller.getProgress()

        if (controller.energy.get() <= 0) {
            updateUI(controller, outputFluid, data, '\u00A7eNo Energy', recipe)
            controller.displayProgress({ slot: 3 })
            return
        }

        if (progress >= cost) {
            const craftCount = maxProcess

            if (craftCount > 0) {
                if (outputFluid.getType() === 'empty') {
                    outputFluid.setType(recipe.liquid)
                }

                outputFluid.add(craftCount * outputAmount)
                controller.entity.removeItem(inputType, craftCount * required)
                controller.addProgress(-cost)
            }
        } else {
            const energyToConsume = Math.min(
                controller.energy.get(),
                controller.rate,
                cost * data.energyMultiplier
            )

            controller.energy.consume(energyToConsume)
            controller.addProgress(
                energyToConsume / data.energyMultiplier
            )
        }

        controller.displayProgress({ slot: 3 })
        updateUI(controller, outputFluid, data, '\u00A7aRunning', recipe)
    }
})

function updateUI(controller, outputFluid, data, status = '\u00A7aRunning', recipe) {
    outputFluid.display(OUTPUT_LIQUID_SLOT)
    controller.displayEnergy()
    const offsetLines = MultiblockMachine.setMachineInfoLabel(controller, data, status)
    setEnergyAndRecipeLabel(controller, offsetLines, recipe)
}

function setEnergyAndRecipeLabel(controller, offsetLines, recipe) {
    const energy = controller.energy
    const rate = controller.baseRate
    const hasRecipe = !!recipe

    const outputFluid = hasRecipe
        ? DoriosAPI.utils.formatIdToText(recipe.liquid)
        : 'None'
    const yieldAmt = hasRecipe
        ? FluidStorage.formatFluid(recipe.amount ?? 1)
        : '-'
    const inputReq = hasRecipe
        ? (recipe.required ?? 1)
        : '-'

    const text = `${offsetLines}
\u00A7r\u00A7eEnergy

\u00A7r\u00A7bCapacity \u00A7f${Math.floor(energy.getPercent())}%%
\u00A7r\u00A7bStored \u00A7f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}
\u00A7r\u00A7bRate \u00A7f${EnergyStorage.formatEnergyToText(rate)}/t

\u00A7r\u00A7eRecipe

\u00A7r\u00A7aOutput Fluid \u00A7f${outputFluid}
\u00A7r\u00A7aYield \u00A7f${yieldAmt}
\u00A7r\u00A7aInput Required \u00A7f${inputReq}
`

    controller.setLabel(text, 2)
}
