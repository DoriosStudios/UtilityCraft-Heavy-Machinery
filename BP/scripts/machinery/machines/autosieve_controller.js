import { EnergyStorage, Multiblock, MultiblockMachine } from "DoriosCore/index.js"
import { sieveRecipes } from 'config/recipes/sieve.js'

const MESH_SLOT = 4
const INPUT_SLOTS = [5, 6, 7, 8, 9, 10, 11, 12, 13]
const OUTPUT_SLOTS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]

const DEFAULT_COST = 6400
const MULTI_PENALTY = 4
const BASE_RATE = 800
const CONTROLLER_REQUIREMENTS = {
    energy_cell: {
        amount: 1,
        warning: '§c[Controller] At least 1 energy container is required.',
    },
    processing_module: {
        amount: 1,
        warning: '§c[Controller] At least 1 processing module is required.',
    },
}
const MULTIBLOCK_CONFIG = {
    required_case: 'dorios:multiblock.case.steel',
    entity: {
        type: 'complex_machine',
        input_range: [5, 13],
        output_range: [14, 28],
        inventory_size: 29,
        identifier: 'utilitycraft:multiblock_machine',
    },
    machine: {
        rate_speed_base: BASE_RATE,
        energy_cap: 0,
    },
    requirements: CONTROLLER_REQUIREMENTS,
}

DoriosAPI.register.blockComponent('autosieve_controller', {

    onPlayerInteract(e) {
        return MultiblockMachine.handlePlayerInteract(e, MULTIBLOCK_CONFIG, {
            initializeEntity(entity) {
                entity.setItem(1, 'utilitycraft:arrow_right_0', 1, '')
                entity.setItem(2, 'utilitycraft:arrow_right_0', 1, '')
            },
            successMessages: ({ energyCap }) => [
                '\u00A7a[Controller] Autosieve Factory created successfully.',
                `\u00A77Energy Capacity: \u00A7b${EnergyStorage.formatEnergyToText(energyCap)}`,
            ],
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

        const meshSlot = inv.getItem(MESH_SLOT)
        if (!meshSlot) {
            updateUI(controller, data, '§eNo Mesh')
            controller.setProgress(0, { slot: 3 })
            return
        }

        const meshComp = meshSlot.getComponent('utilitycraft:mesh')
        if (!meshComp) {
            updateUI(controller, data, '§eInvalid Mesh')
            controller.setProgress(0, { slot: 3 })
            return
        }

        const meshData = meshComp.customComponentParameters.params
        const meshCapacity = meshSlot.amount * 9

        const tier = meshData.tier
        const multi = meshData.multiplier
        const amountMultiplier = meshData.amount_multiplier

        let inputType = null
        let totalInput = 0

        for (const slot of INPUT_SLOTS) {
            const item = inv.getItem(slot)
            if (!item) continue

            if (!inputType) inputType = item.typeId
            if (item.typeId === inputType) {
                totalInput += item.amount
            }
        }

        if (!inputType || totalInput <= 0) {
            updateUI(controller, data, '§eNo Input')
            controller.setProgress(0, { slot: 3 })
            return
        }

        const recipe = sieveRecipes[inputType]
        if (!recipe) {
            updateUI(controller, data, '§eInvalid Input')
            controller.setProgress(0, { slot: 3 })
            return
        }

        const processCount = Math.min(
            data.processing.amount,
            meshCapacity,
            totalInput
        )

        if (processCount <= 0) {
            updateUI(controller, data, '§eCapacity Limit')
            controller.setProgress(0, { slot: 3 })
            return
        }

        const cost = (recipe.cost ?? DEFAULT_COST) * MULTI_PENALTY
        data.cost = cost;
        controller.setEnergyCost(cost)

        const progress = controller.getProgress()

        if (controller.energy.get() <= 0) {
            updateUI(controller, data, '§eNo Energy')
            controller.displayProgress({ slot: 3 })
            return
        }

        if (progress >= cost) {
            processAutosieveDrops(
                controller,
                recipe,
                processCount,
                tier,
                multi,
                amountMultiplier
            )

            controller.entity.removeItem(inputType, processCount)
            controller.addProgress(-cost)
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
        updateUI(controller, data, '§aRunning')
    }
})

/**
 * Rolls and distributes autosieve drops for the current mesh and recipe setup.
 *
 * @param {MultiblockMachine} controller Active autosieve controller runtime.
 * @param {Array<{ item: string, chance: number, amount: number | [number, number], tier?: number }>} recipe
 * Loot table entries for the current autosieve input.
 * @param {number} processCount Amount of parallel input items being processed.
 * @param {number} tier Current mesh tier.
 * @param {number} multi Drop chance multiplier provided by the mesh.
 * @param {number} amountMultiplier Output amount multiplier provided by the mesh.
 */
function processAutosieveDrops(
    controller,
    recipe,
    processCount,
    tier,
    multi,
    amountMultiplier
) {
    recipe.forEach(loot => {
        if (tier < (loot.tier ?? 0)) return
        if (loot.item === 'minecraft:flint' && tier >= 7) return

        if (Math.random() <= loot.chance * multi) {
            let qty = Array.isArray(loot.amount)
                ? DoriosAPI.math.randomInterval(loot.amount[0], loot.amount[1])
                : loot.amount

            if (amountMultiplier) qty *= amountMultiplier

            const total = processCount * Math.ceil(Math.random() * qty)
            MultiblockMachine.distributeOutput(controller, OUTPUT_SLOTS, loot.item, total, {
                suppressErrors: true,
            })
        }
    })
}

/**
 * Refreshes the autosieve controller UI for the current machine state.
 *
 * @param {MultiblockMachine} controller Active autosieve controller runtime.
 * @param {MachineStats & { cost?: number }} data Computed multiblock machine stats.
 * @param {string} [status='§aRunning'] Status text shown in the machine label.
 * @param {object} [recipe] Optional recipe data used for display.
 */
function updateUI(controller, data, status = '§aRunning', recipe) {
    controller.displayEnergy()
    const offsetLines = MultiblockMachine.setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

}

/**
 * Writes the autosieve-specific energy and recipe information section.
 *
 * @param {MultiblockMachine} controller Active autosieve controller runtime.
 * @param {string} offsetLines Padding returned by `setMachineInfoLabel`.
 * @param {object} [recipe] Optional recipe data used for display.
 */
function setEnergyAndRecipeLabel(controller, offsetLines, recipe) {
    const energy = controller.energy
    const rate = controller.baseRate

    const hasRecipe = !!recipe;

    const output = hasRecipe ? DoriosAPI.utils.formatIdToText(recipe.output) ?? '---' : '---';
    const yieldAmt = hasRecipe ? (recipe.amount ?? 1) : '---';
    const inputReq = hasRecipe ? (recipe.required ?? 1) : '---';

    const text = `${offsetLines}
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}
§r§bRate §f${EnergyStorage.formatEnergyToText(rate)}/t

§r§eRecipe Information

§r§aOutput §f${output}
§r§aYield §f${yieldAmt}
§r§aInput Required §f${inputReq}
`;

    controller.setLabel(text, 2);
}
