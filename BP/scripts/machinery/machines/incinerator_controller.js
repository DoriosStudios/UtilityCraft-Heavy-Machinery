import { EnergyStorage, Multiblock, MultiblockMachine } from "DoriosCore/index.js"
import { furnaceRecipes } from 'config/recipes/furnace.js'

const INPUT_SLOTS = [3, 4, 5, 6, 7, 8, 9, 10, 11]
const OUTPUT_SLOTS = [12, 13, 14, 15, 16, 17, 18, 19, 20]
const DEFAULT_COST = 800
const MULTI_PENALTY = 4
const BASE_RATE = 100
const CONTROLLER_REQUIREMENTS = {
    energy_cell: {
        amount: 1,
        warning: '§c[Controller] At least 1 energy container its required to operate.',
    },
    processing_module: {
        amount: 1,
        warning: '§c[Controller] At least 1 processing module its required to operate.',
    },
}
const MULTIBLOCK_CONFIG = {
    required_case: 'dorios:multiblock.case.steel',
    entity: {
        type: 'complex_machine',
        inventory_size: 21,
        identifier: 'utilitycraft:multiblock_machine',
        input_range: [3, 11],
        output_range: [12, 20],
    },
    machine: {
        rate_speed_base: BASE_RATE,
        energy_cap: 0,
    },
    requirements: CONTROLLER_REQUIREMENTS,
}

DoriosAPI.register.blockComponent('incinerator_controller', {
    onPlayerInteract(e) {
        return MultiblockMachine.handlePlayerInteract(e, MULTIBLOCK_CONFIG, {
            initializeEntity(entity) {

                entity.setItem(2, 'utilitycraft:arrow_right_0', 1, ' ')

            },
            successMessages: ({ energyCap }) => [
                '\u00A7a[Controller] Incinerator Factory created successfully.',
                `\u00A77[Controller] Energy Capacity: \u00A7b${EnergyStorage.formatEnergyToText(energyCap)}`,
            ],
        })
    },
    onPlayerBreak({ block, player }) {
        Multiblock.DeactivationManager.handleBreakController(block, player)
    },
    onTick(e) {
        if (!worldLoaded) return;

        const controller = new MultiblockMachine(e.block, MULTIBLOCK_CONFIG);
        if (!controller.valid) return;

        const raw = controller.entity.getDynamicProperty('components');
        /** @type {MachineStats} */
        const data = raw ? JSON.parse(raw) : {};

        controller.setRate(BASE_RATE * data.speed.multiplier);

        const inv = controller.container;
        const recipes = furnaceRecipes;

        let recipe = null;
        let inputType = null;
        let totalInput = 0;

        for (const slot of INPUT_SLOTS) {
            const item = inv.getItem(slot);
            if (!item) continue;

            const r = recipes[item.typeId];
            if (!r) continue;

            if (!recipe) {
                recipe = r;
                inputType = item.typeId;
            }

            if (item.typeId === inputType) {
                totalInput += item.amount;
            }
        }

        if (!recipe) {
            updateUI(controller, data, '§eNo Input');
            controller.setProgress(0, { slot: 2 });
            return;
        }

        let availableSpace = 0;
        for (const slot of OUTPUT_SLOTS) {
            const out = inv.getItem(slot);
            if (!out) {
                availableSpace += 64;
            } else if (out.typeId === recipe.output) {
                availableSpace += out.maxAmount - out.amount;
            }
        }

        const required = recipe.required ?? 1;
        const recipeAmount = recipe.amount ?? 1;

        const maxProcess = Math.min(
            data.processing.amount,
            Math.floor(totalInput / required),
            Math.floor(availableSpace / recipeAmount)
        );

        if (maxProcess <= 0) {
            updateUI(controller, data, '§eOutput Full', recipe);
            controller.setProgress(0, { slot: 2 });
            return;
        }

        const cost = (recipe.cost ?? DEFAULT_COST) * MULTI_PENALTY;
        data.cost = cost;
        controller.setEnergyCost(cost);

        const progress = controller.getProgress();

        if (controller.energy.get() <= 0) {
            updateUI(controller, data, '§eNo Energy', recipe);
            controller.displayProgress({ slot: 2 });
            return;
        }

        if (progress >= cost) {
            const craftCount = maxProcess;

            if (craftCount > 0) {
                MultiblockMachine.distributeOutput(
                    controller,
                    OUTPUT_SLOTS,
                    recipe.output,
                    craftCount * recipeAmount
                );

                controller.entity.removeItem(
                    inputType,
                    craftCount * required
                );

                controller.addProgress(-cost);
            }
        } else {
            const energyToConsume = Math.min(
                controller.energy.get(),
                controller.rate,
                cost * data.energyMultiplier
            );

            controller.energy.consume(energyToConsume);
            controller.addProgress(
                energyToConsume / data.energyMultiplier
            );
        }

        controller.displayProgress({ slot: 2 });
        updateUI(controller, data, '§aRunning', recipe);
    }
})

/**
 * Refreshes the incinerator controller UI for the current machine state.
 *
 * @param {MultiblockMachine} controller Active incinerator controller runtime.
 * @param {MachineStats & { cost?: number }} data Computed multiblock machine stats.
 * @param {string} [status='§aRunning'] Status text shown in the machine label.
 * @param {{ output?: string, amount?: number, required?: number }} [recipe]
 * Current furnace recipe, if one is active.
 */
function updateUI(controller, data, status = '§aRunning', recipe) {
    controller.displayEnergy()
    controller.setLabel([
        MultiblockMachine.getMachineInfoLabel(data, status),
        MultiblockMachine.getEnergyInfoLabel(controller),
        getRecipeLabel(recipe),
    ]);


}

/**
 * Builds the incinerator-specific recipe information section.
 *
 * @param {{ output?: string, amount?: number, required?: number }} [recipe]
 * Current furnace recipe, if one is active.
 */
function getRecipeLabel(recipe) {
    const hasRecipe = !!recipe;
    const output = hasRecipe ? DoriosAPI.utils.formatIdToText(recipe.output) ?? '---' : '---';
    const yieldAmt = hasRecipe ? (recipe.amount ?? 1) : '---';
    const inputReq = hasRecipe ? (recipe.required ?? 1) : '---';

    return `\u00A7r\u00A7eRecipe Information

\u00A7r\u00A7aOutput \u00A7f${output}
\u00A7r\u00A7aYield \u00A7f${yieldAmt}
\u00A7r\u00A7aInput Required \u00A7f${inputReq}
`;
}
