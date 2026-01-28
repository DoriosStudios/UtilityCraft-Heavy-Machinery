import { Multiblock, Energy, Machine } from '../DoriosMachinery/main.js'
import { infuserRecipes } from 'config/recipes/infuser.js'

const CATALYST_SLOTS = [5, 6, 7, 8]
const INPUT_SLOTS = [9, 10, 11, 12, 13, 14, 15, 16, 17]
const OUTPUT_SLOTS = [18, 19, 20, 21, 22, 23, 24, 25, 26]
const DEFAULT_COST = 1600
const MULTI_PENALTY = 4
const BASE_RATE = 400

// slots energy, label, label, progress, 9 input 9 output
DoriosAPI.register.blockComponent('infuser_controller', {
    async onPlayerInteract(e, { params: settings }) {
        const { block, player } = e
        let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

        if (!player.getEquipment('Mainhand')?.typeId.includes('wrench')) {
            return
        }

        if (!entity) {
            entity = Machine.spawn(block, settings, block.permutation)
            DoriosAPI.utils.waitTicks(1, () => {
                entity.setItem(1, 'utilitycraft:arrow_right_0', 1, " ")
                entity.setItem(2, 'utilitycraft:arrow_right_0', 1, " ")
                entity.setItem(3, 'utilitycraft:arrow_right_0', 1, "")
                entity.setItem(4, 'utilitycraft:arrow_indicator_90', 1, "")
                Energy.initialize(entity)
            })
        }
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

        const state = controller.entity.getDynamicProperty('dorios:state');
        if (!state || state === 'off') return;

        const raw = controller.entity.getDynamicProperty('components');
        /** @type {MachineStats} */
        const data = raw ? JSON.parse(raw) : {};

        controller.setRate(BASE_RATE * data.speed.multiplier);

        const inv = controller.inv;
        const recipes = infuserRecipes;

        // ─────────────────────────────────────────────
        // INPUT + CATALYST GLOBAL SCAN
        // ─────────────────────────────────────────────
        let recipe = null;

        let inputType = null;
        let catalystType = null;

        let totalInput = 0;
        let totalCatalyst = 0;

        // Scan INPUT
        for (const slot of INPUT_SLOTS) {
            const item = inv.getItem(slot);
            if (!item) continue;

            if (!inputType) inputType = item.typeId;

            if (item.typeId === inputType) {
                totalInput += item.amount;
            }
        }

        // Scan CATALYST
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
            controller.setProgress(0, 3);
            return;
        }

        recipe = recipes[catalystType + '|' + inputType];
        if (!recipe) {
            updateUI(controller, data, '§eInvalid Recipe');
            controller.setProgress(0, 3);
            return;
        }

        // ─────────────────────────────────────────────
        // OUTPUT SPACE
        // ─────────────────────────────────────────────
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
            controller.setProgress(0, 3);
            return;
        }
        if (requiredCatalyst > totalCatalyst) {
            updateUI(controller, data, '§eMissing Catalyst', recipe);
            controller.setProgress(0, 3);
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
            controller.setProgress(0, 3);
            return;
        }

        // ─────────────────────────────────────────────
        // ENERGY & PROGRESS
        // ─────────────────────────────────────────────
        const cost = (recipe.cost ?? DEFAULT_COST) * MULTI_PENALTY;
        data.cost = cost;
        controller.setEnergyCost(cost);

        const progress = controller.getProgress();

        if (controller.energy.get() <= 0) {
            updateUI(controller, data, '§eNo Energy', recipe);
            controller.displayProgress(3);
            return;
        }

        if (progress >= cost) {
            const craftCount = maxProcess;

            if (craftCount > 0) {
                // OUTPUT
                distributeOutput(
                    controller,
                    recipe.output,
                    craftCount * recipeAmount
                );

                // INPUTS (GLOBAL REMOVAL)
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

        controller.displayProgress(3);
        updateUI(controller, data, '§aRunning', recipe);
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

function updateUI(controller, data, status = '§aRunning', recipe) {
    controller.displayEnergy()
    const offsetLines = Multiblock.setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

}

function setEnergyAndRecipeLabel(controller, offsetLines, recipe) {
    const energy = controller.energy
    const rate = controller.baseRate

    const hasRecipe = !!recipe;

    const output = hasRecipe ? DoriosAPI.utils.formatIdToText(recipe.output) ?? "---" : "---";
    const yieldAmt = hasRecipe ? (recipe.amount ?? 1) : "---";
    const inputReq = hasRecipe ? (recipe.input_required ?? 1) : "---";
    const catReq = hasRecipe ? (recipe.required ?? 1) : "---";

    const text = `${offsetLines}
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${Energy.formatEnergyToText(energy.get())} / ${Energy.formatEnergyToText(energy.cap)}
§r§bRate §f${Energy.formatEnergyToText(rate)}/t

§r§eRecipe Information

§r§aCatalyst Required §f${catReq}
§r§aInput Required §f${inputReq}
§r§aOutput §f${output}
§r§aYield §f${yieldAmt}
`;

    controller.setLabel(text, 2);
}

