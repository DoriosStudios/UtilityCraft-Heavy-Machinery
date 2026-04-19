import { EnergyStorage, Multiblock, MultiblockMachine } from "DoriosCore/index.js"
import { infuserRecipes } from 'config/recipes/infuser.js'

const CATALYST_SLOTS = [5, 6, 7, 8]
const INPUT_SLOTS = [9, 10, 11, 12, 13, 14, 15, 16, 17]
const OUTPUT_SLOTS = [18, 19, 20, 21, 22, 23, 24, 25, 26]
const DEFAULT_COST = 1600
const MULTI_PENALTY = 4
const BASE_RATE = 400
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
        inventory_size: 27,
        identifier: 'utilitycraft:multiblock_machine',
        input_range: [5, 17],
        output_range: [18, 26],
    },
    machine: {
        rate_speed_base: BASE_RATE,
        energy_cap: 0,
    },
    requirements: CONTROLLER_REQUIREMENTS,
}

DoriosAPI.register.blockComponent('infuser_controller', {
    onPlayerInteract(e) {
        return MultiblockMachine.handlePlayerInteract(e, MULTIBLOCK_CONFIG, {
            initializeEntity(entity) {
                entity.setItem(1, 'utilitycraft:arrow_right_0', 1, ' ')
                entity.setItem(2, 'utilitycraft:arrow_right_0', 1, ' ')
                entity.setItem(3, 'utilitycraft:arrow_right_0', 1, '')
                entity.setItem(4, 'utilitycraft:arrow_indicator_90', 1, '')
            },
            successMessages: ({ energyCap }) => [
                '\u00A7a[Controller] Infuser Factory created successfully.',
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
        const recipes = infuserRecipes;

        let recipe = null;

        let inputType = null;
        let catalystType = null;

        let totalInput = 0;
        let totalCatalyst = 0;

        for (const slot of INPUT_SLOTS) {
            const item = inv.getItem(slot);
            if (!item) continue;

            if (!inputType) inputType = item.typeId;

            if (item.typeId === inputType) {
                totalInput += item.amount;
            }
        }

        for (const slot of CATALYST_SLOTS) {
            const item = inv.getItem(slot);
            if (!item) continue;

            if (!catalystType) catalystType = item.typeId;

            if (item.typeId === catalystType) {
                totalCatalyst += item.amount;
            }
        }

        if (!inputType || !catalystType) {
            updateUI(controller, data, '§eEmpty');
            controller.setProgress(0, { slot: 3 });
            return;
        }

        recipe = recipes[catalystType + '|' + inputType];
        if (!recipe) {
            updateUI(controller, data, '§eInvalid Recipe');
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

        const requiredInput = recipe.input_required ?? 1;
        const requiredCatalyst = recipe.required ?? 1;
        const recipeAmount = recipe.amount ?? 1;

        if (requiredInput > totalInput) {
            updateUI(controller, data, '§eMissing Input', recipe);
            controller.setProgress(0, { slot: 3 });
            return;
        }
        if (requiredCatalyst > totalCatalyst) {
            updateUI(controller, data, '§eMissing Catalyst', recipe);
            controller.setProgress(0, { slot: 3 });
            return;
        }


        const maxProcess = Math.min(
            data.processing.amount,
            Math.floor(totalInput / requiredInput),
            Math.floor(totalCatalyst / requiredCatalyst),
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
                    craftCount * requiredInput
                );

                controller.entity.removeItem(
                    catalystType,
                    craftCount * requiredCatalyst
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
 * Refreshes the infuser controller UI for the current machine state.
 *
 * @param {MultiblockMachine} controller Active infuser controller runtime.
 * @param {MachineStats & { cost?: number }} data Computed multiblock machine stats.
 * @param {string} [status='§aRunning'] Status text shown in the machine label.
 * @param {{ output?: string, amount?: number, required?: number, input_required?: number }} [recipe]
 * Current infuser recipe, if one is active.
 */
function updateUI(controller, data, status = '§aRunning', recipe) {
    controller.displayEnergy()
    const offsetLines = MultiblockMachine.setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

}

/**
 * Writes the infuser-specific energy and recipe information section.
 *
 * @param {MultiblockMachine} controller Active infuser controller runtime.
 * @param {string} offsetLines Padding returned by `setMachineInfoLabel`.
 * @param {{ output?: string, amount?: number, required?: number, input_required?: number }} [recipe]
 * Current infuser recipe, if one is active.
 */
function setEnergyAndRecipeLabel(controller, offsetLines, recipe) {
    const energy = controller.energy;
    const rate = controller.baseRate;

    const hasRecipe = !!recipe;

    const output = hasRecipe ? DoriosAPI.utils.formatIdToText(recipe.output) ?? '---' : '---';
    const yieldAmt = hasRecipe ? (recipe.amount ?? 1) : '---';
    const catalystReq = hasRecipe ? (recipe.required ?? 1) : '---';
    const inputReq = hasRecipe ? (recipe.input_required ?? 1) : '---';

    const text = `${offsetLines}
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}
§r§bRate §f${EnergyStorage.formatEnergyToText(rate)}/t

§r§eRecipe Information

§r§aOutput §f${output}
§r§aYield §f${yieldAmt}
§r§aCatalyst Required §f${catalystReq}
§r§aInput Required §f${inputReq}
`;

    controller.setLabel(text, 2);
}
