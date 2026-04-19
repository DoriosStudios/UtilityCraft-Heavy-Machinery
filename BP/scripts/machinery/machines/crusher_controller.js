import { EnergyStorage, Multiblock, MultiblockMachine } from "DoriosCore/index.js"
import { crusherRecipes } from 'config/recipes/crusher.js'

const INPUT_SLOTS = [4, 5, 6, 7, 8, 9, 10, 11, 12]
const OUTPUT_SLOTS = [13, 14, 15, 16, 17, 18, 19, 20, 21]
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
        inventory_size: 22,
        identifier: 'utilitycraft:multiblock_machine',
        input_range: [4, 12],
        output_range: [13, 21],
    },
    machine: {
        rate_speed_base: BASE_RATE,
        energy_cap: 0,
    },
    requirements: CONTROLLER_REQUIREMENTS,
}

DoriosAPI.register.blockComponent('crusher_controller', {
    onPlayerInteract(e) {
        return MultiblockMachine.handlePlayerInteract(e, MULTIBLOCK_CONFIG, {
            initializeEntity(entity) {
                entity.setItem(1, 'utilitycraft:arrow_right_0', 1, ' ')
                entity.setItem(2, 'utilitycraft:arrow_right_0', 1, ' ')
                entity.setItem(3, 'utilitycraft:arrow_right_0', 1, '')
            },
            successMessages: ({ energyCap }) => [
                '\u00A7a[Controller] Crusher Factory created successfully.',
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
        const recipes = crusherRecipes;

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
            controller.setProgress(0, { slot: 3 });
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
            controller.setProgress(0, { slot: 3 });
            return;
        }

        const cost = (recipe.cost ?? DEFAULT_COST) * MULTI_PENALTY;
        data.cost = cost;
        controller.setEnergyCost(cost);

        const progress = controller.getProgress();

        if (controller.energy.get() <= 0) {
            updateUI(controller, data, '§eNo Energy', recipe);
            controller.displayProgress({ slot: 3 });
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

        controller.displayProgress({ slot: 3 });
        updateUI(controller, data, '§aRunning', recipe);
    }
})

/**
 * Refreshes the crusher controller UI for the current machine state.
 *
 * @param {MultiblockMachine} controller Active crusher controller runtime.
 * @param {MachineStats & { cost?: number }} data Computed multiblock machine stats.
 * @param {string} [status='§aRunning'] Status text shown in the machine label.
 * @param {{ output?: string, amount?: number, required?: number }} [recipe]
 * Current crusher recipe, if one is active.
 */
function updateUI(controller, data, status = '§aRunning', recipe) {
    controller.displayEnergy()
    const offsetLines = MultiblockMachine.setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

}

/**
 * Writes the crusher-specific energy and recipe information section.
 *
 * @param {MultiblockMachine} controller Active crusher controller runtime.
 * @param {string} offsetLines Padding returned by `setMachineInfoLabel`.
 * @param {{ output?: string, amount?: number, required?: number }} [recipe]
 * Current crusher recipe, if one is active.
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
