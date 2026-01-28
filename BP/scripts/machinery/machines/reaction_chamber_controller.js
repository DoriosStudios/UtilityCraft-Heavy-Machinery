import { Multiblock, Energy, Machine, FluidManager } from '../DoriosMachinery/main.js'
import { reactionRecipes } from 'config/recipes/reaction_chamber.js'

const INPUT_LIQUID_SLOT = 4
const OUTPUT_LIQUID_SLOT = 5
const INPUT_SLOTS = [6, 7, 8, 9]
const OUTPUT_SLOTS = [10, 11, 12, 13]
const DEFAULT_COST = 12800
const BASE_RATE = 1600

const FLUID_CAPACITY_CELL = 256_000

// slots energy, label, label, progress, 9 input 9 output
DoriosAPI.register.blockComponent('reaction_chamber_controller', {
    async onPlayerInteract(e, { params: settings }) {
        const { block, player } = e
        let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

        if (!player.getEquipment('Mainhand')?.typeId.includes('wrench')) {
            return
        }

        if (!entity) {
            entity = Machine.spawn(block, settings, block.permutation)
            entity.setItem(1, 'utilitycraft:arrow_right_0', 1, " ")
            entity.setItem(2, 'utilitycraft:arrow_right_0', 1, " ")
            entity.setItem(3, 'utilitycraft:arrow_right_0', 1, "")
            Energy.initialize(entity)
        }

        const [inputFluid, outputFluid] =
            FluidManager.initializeMultiple(entity, 2);

        Multiblock.deactivateMultiblock(entity, player)

        const structure = await Multiblock.detectFromController(e, settings.required_case)
        if (!structure) return

        const energyCap = Multiblock.activateMultiblock(entity, structure)
        if (energyCap <= 0) {
            player.sendMessage("§c[Controller] At least 1 energy container its required to operate.");
            Multiblock.deactivateMultiblock(entity, player)
            return
        }

        const processing = structure.components["processing_module"] ?? 0
        if (processing == 0) {
            player.sendMessage("§c[Controller] At least 1 processing module its required to operate.");
            Multiblock.deactivateMultiblock(entity, player)
            return
        }

        const fluidCapacity = (structure.components["fluid_cell"] ?? 0) * FLUID_CAPACITY_CELL;
        if (fluidCapacity == 0) {
            player.sendMessage("§c[Controller] At least 1 fluid cell its required to operate.");
            Multiblock.deactivateMultiblock(entity, player)
            return
        }
        inputFluid.setCap(fluidCapacity / 2)
        outputFluid.setCap(fluidCapacity / 2)

        const factoryData = Multiblock.computeMachineStats(structure.components)
        entity.setDynamicProperty('components', JSON.stringify(factoryData))

        player.sendMessage("§a[Controller] Crusher Factory created successfully.");
        player.sendMessage(`§7[Controller] Energy Capacity: §b${Energy.formatEnergyToText(energyCap)}`);
    },
    onPlayerBreak({ block, player }) {
        const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
        if (!entity) return
        Multiblock.deactivateMultiblock(entity, player)
        entity.remove()
    },
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;

        const controller = new Machine(e.block, settings);
        if (!controller.valid) return;

        const state = controller.entity.getDynamicProperty("dorios:state");
        if (!state || state === "off") return;

        const raw = controller.entity.getDynamicProperty("components");
        /** @type {MachineStats} */
        const data = raw ? JSON.parse(raw) : {};

        controller.setRate(BASE_RATE * data.speed.multiplier);

        const inv = controller.inv;
        const recipes = reactionRecipes;

        // ──────────────────────────────
        // Fluids
        // [0] input / [1] output
        // ──────────────────────────────
        const [inputFluid, outputFluid] =
            FluidManager.initializeMultiple(controller.entity, 2);

        let inputItemId = "empty";
        let totalItems = 0;

        // ──────────────────────────────
        // Detect input item
        // ──────────────────────────────
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
            controller.setProgress(0, 3);
            return;
        }

        // ──────────────────────────────
        // Resolve requirements
        // ──────────────────────────────
        const reqItems = recipe.required_items ?? 1;
        const reqFluid = recipe.required_liquid ?? 0;

        if (inputItemId !== "empty" && totalItems < reqItems) {
            updateUI(controller, [inputFluid, outputFluid], data, "§eNot Enough Items", recipe);
            controller.setProgress(0, 3);
            return;
        }

        if (inputFluidType !== "empty" && inputFluid.get() < reqFluid) {
            updateUI(controller, [inputFluid, outputFluid], data, "§eNot Enough Fluid", recipe);
            controller.setProgress(0, 3);
            return;
        }

        // ──────────────────────────────
        // Output space checks
        // ──────────────────────────────
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
                controller.setProgress(0, 3);
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
            controller.setProgress(0, 3);
            return;
        }

        // ──────────────────────────────
        // Energy
        // ──────────────────────────────
        const cost = recipe.cost ?? DEFAULT_COST;
        data.cost = cost;
        controller.setEnergyCost(cost);

        const progress = controller.getProgress();

        if (controller.energy.get() <= 0) {
            updateUI(controller, [inputFluid, outputFluid], data, "§eNo Energy", recipe);
            controller.displayProgress(3);
            return;
        }

        // ──────────────────────────────
        // Process
        // ──────────────────────────────
        if (progress >= cost) {
            const craftCount = maxProcess;

            // OUTPUT ITEM
            if (recipe.output_item) {
                distributeOutput(
                    controller,
                    recipe.output_item.id,
                    craftCount * outItemAmt
                );
            }

            // OUTPUT FLUID
            if (recipe.output_liquid) {
                if (outputFluid.getType() === "empty") {
                    outputFluid.setType(recipe.output_liquid.type);
                }
                outputFluid.add(craftCount * outFluidAmt);
            }

            // INPUT ITEM
            if (inputItemId !== "empty") {
                controller.entity.removeItem(
                    inputItemId,
                    craftCount * reqItems
                );
            }

            // INPUT FLUID
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

        controller.displayProgress(3);
        updateUI(controller, [inputFluid, outputFluid], data, "§aRunning", recipe);
    }
})

function distributeOutput(controller, itemId, amount) {
    let remaining = amount;
    const entity = controller.entity
    for (const slot of OUTPUT_SLOTS) {
        if (remaining <= 0) break;

        const out = controller.inv.getItem(slot);

        if (!out) {
            const add = Math.min(64, remaining);
            entity.setItem(slot, itemId, add);
            remaining -= add;
        } else if (out.typeId === itemId && out.amount < out.maxAmount) {
            const add = Math.min(out.maxAmount - out.amount, remaining);
            entity.changeItemAmount(slot, add);
            remaining -= add;
        }
    }
}

function updateUI(controller, [inputFluid, outputFluid], data, status = '§aRunning', recipe) {
    inputFluid.display(INPUT_LIQUID_SLOT)
    outputFluid.display(OUTPUT_LIQUID_SLOT)
    controller.displayEnergy()
    const offsetLines = Multiblock.setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

}

function setEnergyAndRecipeLabel(controller, offsetLines, recipe) {
    const energy = controller.energy;
    const rate = controller.baseRate;

    const hasRecipe = !!recipe;

    const outItem = hasRecipe && recipe.output_item
        ? DoriosAPI.utils.formatIdToText(recipe.output_item.id)
        : "None";

    const outItemAmt = hasRecipe && recipe.output_item
        ? (recipe.output_item.amount ?? 1)
        : "-";

    const outFluid = hasRecipe && recipe.output_liquid
        ? DoriosAPI.utils.formatIdToText(recipe.output_liquid.type)
        : "None";

    const outFluidAmt = hasRecipe && recipe.output_liquid
        ? FluidManager.formatFluid(recipe.output_liquid.amount)
        : "-";

    const text = `${offsetLines}
§r§eEnergy

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${Energy.formatEnergyToText(energy.get())} / ${Energy.formatEnergyToText(energy.cap)}
§r§bRate §f${Energy.formatEnergyToText(rate)}/t

§r§eRecipe

§r§aOutput Item §f${outItem}
§r§aYield §f${outItemAmt}

§r§aOutput Fluid §f${outFluid}
§r§aYield §f${outFluidAmt}
`;

    controller.setLabel(text, 2);
}
