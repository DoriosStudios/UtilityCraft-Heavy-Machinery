import { EnergyStorage, Multiblock, MultiblockMachine } from "DoriosCore/index.js"
import { pressRecipes } from 'config/recipes/press.js'

const INPUT_SLOTS = [3, 4, 5, 6, 7, 8, 9, 10, 11]
const OUTPUT_SLOTS = [12, 13, 14, 15, 16, 17, 18, 19, 20]
const DEFAULT_COST = 800
const MULTI_PENALTY = 4
const BASE_RATE = 100
const CONTROLLER_REQUIREMENTS = {
    energy_cell: {
        amount: 1,
        warning: '\u00A7c[Controller] At least 1 energy container its required to operate.',
    },
    processing_module: {
        amount: 1,
        warning: '\u00A7c[Controller] At least 1 processing module its required to operate.',
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

DoriosAPI.register.blockComponent('electro_press_controller', {
    onPlayerInteract(e) {
        return MultiblockMachine.handlePlayerInteract(e, MULTIBLOCK_CONFIG, {
            initializeEntity(entity) {
                entity.setItem(2, 'utilitycraft:arrow_right_0', 1, ' ')
            },
            successMessages: ({ energyCap }) => [
                '\u00A7a[Controller] Electro Press Factory created successfully.',
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
        const recipes = pressRecipes;
        const plan = planRecipeBatches(inv, recipes, data.processing.amount);

        if (!plan.foundValidRecipe) {
            updateUI(controller, data, '\u00A7eNo Input');
            controller.setProgress(0, { slot: 2 });
            return;
        }

        if (plan.totalCrafts <= 0) {
            updateUI(controller, data, '\u00A7eOutput Full', plan.displayRecipe);
            controller.setProgress(0, { slot: 2 });
            return;
        }

        const cost = plan.totalCost;
        data.cost = cost;
        controller.setEnergyCost(cost);

        const progress = controller.getProgress();

        if (controller.energy.get() <= 0) {
            updateUI(controller, data, '\u00A7eNo Energy', plan.displayRecipe);
            controller.displayProgress({ slot: 2 });
            return;
        }

        if (progress >= cost) {
            if (plan.batches.length > 0) {
                for (const batch of plan.batches) {
                    const recipe = batch.recipe;
                    MultiblockMachine.distributeOutput(
                        controller,
                        OUTPUT_SLOTS,
                        recipe.output,
                        batch.craftCount * (recipe.amount ?? 1)
                    );

                    controller.entity.removeItem(
                        batch.inputType,
                        batch.craftCount * (recipe.required ?? 1)
                    );
                }

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
        updateUI(controller, data, '\u00A7aRunning', plan.displayRecipe);
    }
})

/**
 * Refreshes the electro press controller UI for the current machine state.
 *
 * @param {MultiblockMachine} controller Active electro press controller runtime.
 * @param {MachineStats & { cost?: number }} data Computed multiblock machine stats.
 * @param {string} [status='\u00A7aRunning'] Status text shown in the machine label.
 * @param {{ output?: string, amount?: number, required?: number }} [recipe]
 * Current press recipe, if one is active.
 */
function updateUI(controller, data, status = '\u00A7aRunning', recipe) {
    controller.displayEnergy()
    controller.setLabel([
        getElectroPressInfoLabel(data, status),
        MultiblockMachine.getEnergyInfoLabel(controller),
        getRecipeLabel(recipe),
    ]);
}

/**
 * Builds the electro press-specific recipe information section.
 *
 * @param {{ output?: string, amount?: number, required?: number }} [recipe]
 * Current press recipe, if one is active.
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

function getElectroPressInfoLabel(data, status = "\u00A7aRunning") {
    return `\u00A7r\u00A77Status: ${status}

\u00A7r\u00A7eMachine Information

\u00A7r\u00A7aInput Capacity \u00A7fx${data.processing.amount}
\u00A7r\u00A7aCost \u00A7f${data.cost ? EnergyStorage.formatEnergyToText(data.cost) : "---"}
\u00A7r\u00A7aSpeed \u00A7fx${data.speed.multiplier.toFixed(2)}
\u00A7r\u00A7aEfficiency \u00A7f${((data.processing.amount / data.energyMultiplier) * 100).toFixed(2)}%%
`;
}

function planRecipeBatches(inv, recipes, maxCrafts) {
    const inputTotals = new Map();
    const inputOrder = [];

    for (const slot of INPUT_SLOTS) {
        const item = inv.getItem(slot);
        if (!item) continue;

        if (!inputTotals.has(item.typeId)) {
            inputTotals.set(item.typeId, 0);
            inputOrder.push(item.typeId);
        }

        inputTotals.set(item.typeId, inputTotals.get(item.typeId) + item.amount);
    }

    const outputState = OUTPUT_SLOTS.map(slot => {
        const item = inv.getItem(slot);
        return item ? {
            typeId: item.typeId,
            amount: item.amount,
            maxAmount: item.maxAmount,
        } : null;
    });

    const batches = [];
    let totalCrafts = 0;
    let totalCost = 0;
    let foundValidRecipe = false;
    let displayRecipe = null;
    let fallbackRecipe = null;

    for (const inputType of inputOrder) {
        if (totalCrafts >= maxCrafts) break;

        const recipe = recipes[inputType];
        if (!recipe) continue;

        foundValidRecipe = true;
        if (!fallbackRecipe) fallbackRecipe = recipe;

        const required = recipe.required ?? 1;
        const recipeAmount = recipe.amount ?? 1;
        const totalInput = inputTotals.get(inputType) ?? 0;
        const remainingCrafts = maxCrafts - totalCrafts;
        const availableCrafts = Math.min(
            remainingCrafts,
            Math.floor(totalInput / required)
        );

        if (availableCrafts <= 0) continue;

        const craftCount = reserveCraftsInOutput(outputState, recipe.output, recipeAmount, availableCrafts);
        if (craftCount <= 0) continue;

        if (!displayRecipe) displayRecipe = recipe;

        batches.push({
            inputType,
            recipe,
            craftCount,
        });

        totalCrafts += craftCount;
        totalCost = Math.max(
            totalCost,
            (recipe.cost ?? DEFAULT_COST) * MULTI_PENALTY
        );
    }

    return {
        batches,
        totalCrafts,
        totalCost,
        foundValidRecipe,
        displayRecipe: displayRecipe ?? fallbackRecipe,
    };
}

function reserveCraftsInOutput(outputState, itemId, amountPerCraft, maxCrafts) {
    let craftCount = 0;

    for (let i = 0; i < maxCrafts; i++) {
        const nextState = cloneOutputState(outputState);
        if (!reserveOutputAmount(nextState, itemId, amountPerCraft)) {
            break;
        }

        outputState.splice(0, outputState.length, ...nextState);
        craftCount++;
    }

    return craftCount;
}

function cloneOutputState(outputState) {
    return outputState.map(slot => slot ? { ...slot } : null);
}

function reserveOutputAmount(outputState, itemId, amount) {
    let remaining = amount;

    for (const slot of outputState) {
        if (!slot || slot.typeId !== itemId || slot.amount >= slot.maxAmount) continue;

        const add = Math.min(slot.maxAmount - slot.amount, remaining);
        slot.amount += add;
        remaining -= add;

        if (remaining <= 0) return true;
    }

    for (let i = 0; i < outputState.length; i++) {
        if (outputState[i]) continue;

        const add = Math.min(64, remaining);
        outputState[i] = {
            typeId: itemId,
            amount: add,
            maxAmount: 64,
        };
        remaining -= add;

        if (remaining <= 0) return true;
    }

    return remaining <= 0;
}
