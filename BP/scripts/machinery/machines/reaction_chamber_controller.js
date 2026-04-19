import { EnergyStorage, FluidStorage, Multiblock, MultiblockMachine } from "DoriosCore/index.js"
import { reactionRecipes } from 'config/recipes/reaction_chamber.js'

const INPUT_LIQUID_SLOT = 4
const OUTPUT_LIQUID_SLOT = 5
const INPUT_SLOTS = [6, 7, 8, 9]
const OUTPUT_SLOTS = [10, 11, 12, 13]
const DEFAULT_COST = 12800
const BASE_RATE = 1600

const FLUID_CAPACITY_CELL = 256_000
const CONTROLLER_REQUIREMENTS = {
    energy_cell: {
        amount: 1,
        warning: '§c[Controller] At least 1 energy container its required to operate.',
    },
    processing_module: {
        amount: 1,
        warning: '§c[Controller] At least 1 processing module its required to operate.',
    },
    fluid_cell: {
        amount: 1,
        warning: '§c[Controller] At least 1 fluid cell its required to operate.',
    },
}
const MULTIBLOCK_CONFIG = {
    required_case: 'dorios:multiblock.case.steel',
    entity: {
        type: 'complex_machine_fluid',
        input_range: [6, 9],
        output_range: [10, 13],
        inventory_size: 14,
        identifier: 'utilitycraft:multiblock_machine',
    },
    machine: {
        rate_speed_base: BASE_RATE,
        energy_cap: 0,
    },
    requirements: CONTROLLER_REQUIREMENTS,
}

DoriosAPI.register.blockComponent('reaction_chamber_controller', {
    onPlayerInteract(e) {
        return MultiblockMachine.handlePlayerInteract(e, MULTIBLOCK_CONFIG, {
            initializeEntity(entity) {
                entity.setItem(1, 'utilitycraft:arrow_right_0', 1, ' ')
                entity.setItem(2, 'utilitycraft:arrow_right_0', 1, ' ')
                entity.setItem(3, 'utilitycraft:arrow_right_0', 1, '')
                FluidStorage.initializeMultiple(entity, 2)
            },
            onActivate: ({ entity, structure }) => {
                const [inputFluid, outputFluid] = FluidStorage.initializeMultiple(entity, 2)
                const fluidCapacity = (structure.components.fluid_cell ?? 0) * FLUID_CAPACITY_CELL
                inputFluid.setCap(fluidCapacity / 2)
                outputFluid.setCap(fluidCapacity / 2)
            },
            successMessages: ({ energyCap }) => [
                '\u00A7a[Controller] Reaction Chamber Factory created successfully.',
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

        const raw = controller.entity.getDynamicProperty("components");
        /** @type {MachineStats} */
        const data = raw ? JSON.parse(raw) : {};

        controller.setRate(BASE_RATE * data.speed.multiplier);

        const inv = controller.container;
        const recipes = reactionRecipes;

        const [inputFluid, outputFluid] =
            FluidStorage.initializeMultiple(controller.entity, 2);

        let inputItemId = "empty";
        let totalItems = 0;

        for (const slot of INPUT_SLOTS) {
            const item = inv.getItem(slot);
            if (!item) continue;

            if (inputItemId === "empty") {
                inputItemId = item.typeId;
            }

            if (item.typeId === inputItemId) {
                totalItems += item.amount;
            }
        }

        const inputFluidType = inputFluid.getType() ?? "empty";

        const recipeKey = `${inputItemId}|${inputFluidType}`;
        const recipe = recipes[recipeKey];

        if (!recipe) {
            updateUI(controller, [inputFluid, outputFluid], data, "§eNo Recipe");
            controller.setProgress(0, { slot: 3 });
            return;
        }

        const reqItems = recipe.required_items ?? 1;
        const reqFluid = recipe.required_liquid ?? 0;

        if (inputItemId !== "empty" && totalItems < reqItems) {
            updateUI(controller, [inputFluid, outputFluid], data, "§eNot Enough Items", recipe);
            controller.setProgress(0, { slot: 3 });
            return;
        }

        if (inputFluidType !== "empty" && inputFluid.get() < reqFluid) {
            updateUI(controller, [inputFluid, outputFluid], data, "§eNot Enough Fluid", recipe);
            controller.setProgress(0, { slot: 3 });
            return;
        }

        let itemSpace = Infinity;
        let fluidSpace = Infinity;

        if (recipe.output_item) {
            itemSpace = 0;
            const outId = recipe.output_item.id;
            for (const slot of OUTPUT_SLOTS) {
                const out = inv.getItem(slot);
                if (!out) {
                    itemSpace += 64;
                } else if (out.typeId === outId) {
                    itemSpace += out.maxAmount - out.amount;
                }
            }
        }

        if (recipe.output_liquid) {
            const outType = recipe.output_liquid.type;
            if (
                outputFluid.getType() !== "empty" &&
                outputFluid.getType() !== outType
            ) {
                updateUI(controller, [inputFluid, outputFluid], data, "§eWrong Output Fluid", recipe);
                controller.setProgress(0, { slot: 3 });
                return;
            }
            fluidSpace = outputFluid.getFreeSpace();
        }

        const outItemAmt = recipe.output_item?.amount ?? 1;
        const outFluidAmt = recipe.output_liquid?.amount ?? 0;

        const maxProcess = Math.min(
            data.processing.amount,
            inputItemId !== "empty"
                ? Math.floor(totalItems / reqItems)
                : Infinity,
            recipe.output_item
                ? Math.floor(itemSpace / outItemAmt)
                : Infinity,
            recipe.output_liquid
                ? Math.floor(fluidSpace / outFluidAmt)
                : Infinity
        );

        if (maxProcess <= 0) {
            updateUI(controller, [inputFluid, outputFluid], data, "§eOutput Full", recipe);
            controller.setProgress(0, { slot: 3 });
            return;
        }

        const cost = recipe.cost ?? DEFAULT_COST;
        data.cost = cost;
        controller.setEnergyCost(cost);

        const progress = controller.getProgress();

        if (controller.energy.get() <= 0) {
            updateUI(controller, [inputFluid, outputFluid], data, "§eNo Energy", recipe);
            controller.displayProgress({ slot: 3 });
            return;
        }

        if (progress >= cost) {
            const craftCount = maxProcess;

            if (recipe.output_item) {
                MultiblockMachine.distributeOutput(
                    controller,
                    OUTPUT_SLOTS,
                    recipe.output_item.id,
                    craftCount * outItemAmt
                );
            }

            if (recipe.output_liquid) {
                if (outputFluid.getType() === "empty") {
                    outputFluid.setType(recipe.output_liquid.type);
                }
                outputFluid.add(craftCount * outFluidAmt);
            }

            if (inputItemId !== "empty") {
                controller.entity.removeItem(
                    inputItemId,
                    craftCount * reqItems
                );
            }

            if (reqFluid > 0) {
                inputFluid.consume(craftCount * reqFluid);
            }

            controller.addProgress(-cost);
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
        updateUI(controller, [inputFluid, outputFluid], data, "§aRunning", recipe);
    }
})

/**
 * Refreshes the reaction chamber controller UI for the current machine state.
 *
 * @param {MultiblockMachine} controller Active reaction chamber controller runtime.
 * @param {[FluidStorage, FluidStorage]} storages Input and output fluid storages.
 * @param {MachineStats & { cost?: number }} data Computed multiblock machine stats.
 * @param {string} [status='§aRunning'] Status text shown in the machine label.
 * @param {{
 *   output_item?: { id: string, amount?: number },
 *   output_liquid?: { type: string, amount?: number }
 * }} [recipe] Current reaction recipe, if one is active.
 */
function updateUI(controller, [inputFluid, outputFluid], data, status = '§aRunning', recipe) {
    inputFluid.display(INPUT_LIQUID_SLOT)
    outputFluid.display(OUTPUT_LIQUID_SLOT)
    controller.displayEnergy()
    const offsetLines = MultiblockMachine.setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

}

/**
 * Writes the reaction chamber-specific energy and output information section.
 *
 * @param {MultiblockMachine} controller Active reaction chamber controller runtime.
 * @param {string} offsetLines Padding returned by `setMachineInfoLabel`.
 * @param {{
 *   output_item?: { id: string, amount?: number },
 *   output_liquid?: { type: string, amount?: number }
 * }} [recipe] Current reaction recipe, if one is active.
 */
function setEnergyAndRecipeLabel(controller, offsetLines, recipe) {
    const energy = controller.energy;
    const rate = controller.baseRate;

    const hasRecipe = !!recipe;

    const outItem = hasRecipe && recipe.output_item
        ? DoriosAPI.utils.formatIdToText(recipe.output_item.id)
        : 'None';

    const outItemAmt = hasRecipe && recipe.output_item
        ? (recipe.output_item.amount ?? 1)
        : '-';

    const outFluid = hasRecipe && recipe.output_liquid
        ? DoriosAPI.utils.formatIdToText(recipe.output_liquid.type)
        : 'None';

    const outFluidAmt = hasRecipe && recipe.output_liquid
        ? FluidStorage.formatFluid(recipe.output_liquid.amount)
        : '-';

    const text = `${offsetLines}
§r§eEnergy

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}
§r§bRate §f${EnergyStorage.formatEnergyToText(rate)}/t

§r§eRecipe

§r§aOutput Item §f${outItem}
§r§aYield §f${outItemAmt}

§r§aOutput Fluid §f${outFluid}
§r§aYield §f${outFluidAmt}
`;

    controller.setLabel(text, 2);
}
