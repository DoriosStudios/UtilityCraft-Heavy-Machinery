import { ItemStack } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";
import { Machine, FluidStorage, registerIOInterface } from "DoriosCore/index.js";
import { reactionRecipes } from "config/recipes/reaction_chamber.js";

registerIOInterface("utilitycraft:reaction_chamber", {
    "items": {
        "buttonSlots": [
            9,
            14
        ],
        "anyInputSlots": [
            3
        ],
        "anyOutputSlots": [
            5
        ],
        "modes": [
            {
                "id": "default"
            },
            {
                "id": "input_1",
                "inputSlots": [
                    3
                ]
            },
            {
                "id": "output_1",
                "outputSlots": [
                    5
                ]
            },
            {
                "id": "disabled"
            }
        ]
    },
    "liquids": {
        "buttonSlots": [
            15,
            20
        ],
        "anyInputIndices": [
            0
        ],
        "anyOutputIndices": [
            1
        ],
        "modes": [
            {
                "id": "default"
            },
            {
                "id": "input_1",
                "inputIndices": [
                    0
                ]
            },
            {
                "id": "output_1",
                "outputIndices": [
                    1
                ]
            },
            {
                "id": "output_2",
                "outputIndices": [
                    0
                ]
            },
            {
                "id": "disabled"
            }
        ]
    }
});

DoriosLib.registry.blockComponent("utilitycraft:reaction_chamber", {
    beforeOnPlayerPlace(e, { params: settings }) {
        Machine.spawnEntity(e, settings, () => {
            const machine = new Machine(e.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            machine.setEnergyCost(settings.machine.energy_cost);
            machine.displayProgress();
            DoriosLib.entity.setNewItem(machine.entity, {
                slot: 1, typeId: "utilitycraft:arrow_right_0", nameTag: " ",
            });
        });
    },

    onTick({ block }, { params: settings }) {
        const machine = new Machine(block, settings);
        if (!machine.valid) return;
        const [liquid, outputLiquid] = FluidStorage.initializeMultiple(machine.entity, 2);
        machine.processIO();
        const inv = machine.container;
        const inputItem = inv.getItem(3);
        const recipeKey = `${inputItem?.typeId ?? "empty"}|${liquid.getType()}`;
        const recipe = reactionRecipes[recipeKey];
        const refresh = () => updateUI(machine, liquid, outputLiquid);
        if (!recipe) {
            machine.showWarning("No Recipe");
            refresh();
            return;
        }

        const cost = recipe.cost ?? settings.machine.energy_cost;
        if (machine.getEnergyCost() !== cost) machine.setProgress(0, { display: false });
        machine.setEnergyCost(cost);
        const requiredLiquid = recipe.required_liquid ?? 0;
        const requiredItems = recipe.required_items ?? 1;
        if (liquid.get() < requiredLiquid || (inputItem?.amount ?? 0) < requiredItems) {
            machine.showWarning("Not Enough Input");
            refresh();
            return;
        }

        const product = recipe.output_item ? new ItemStack(recipe.output_item.id, 1) : undefined;
        const outputItem = inv.getItem(5);
        const itemAmount = recipe.output_item?.amount ?? 1;
        if (product && outputItem && !outputItem.isStackableWith(product)) {
            machine.showWarning("Output Item Conflict");
            refresh();
            return;
        }
        const itemSpace = product ? (outputItem?.maxAmount ?? product.maxAmount) - (outputItem?.amount ?? 0) : Infinity;
        const liquidProduct = recipe.output_liquid;
        const liquidAmount = liquidProduct?.amount ?? 0;
        if (liquidProduct && outputLiquid.getType() !== "empty" && outputLiquid.getType() !== liquidProduct.type) {
            machine.showWarning("Output Liquid Conflict");
            refresh();
            return;
        }
        const maxAmountToCraft = Math.floor(Math.min(
            requiredLiquid > 0 ? liquid.get() / requiredLiquid : Infinity,
            requiredItems > 0 ? inputItem.amount / requiredItems : Infinity,
            product ? itemSpace / itemAmount : Infinity,
            liquidProduct ? outputLiquid.getFreeSpace() / liquidAmount : Infinity,
        ));
        if (maxAmountToCraft <= 0) {
            machine.showWarning("Output Full", { resetProgress: false });
            refresh();
            return;
        }
        if (machine.energy.get() <= 0) {
            machine.showWarning("No Energy", { resetProgress: false });
            refresh();
            return;
        }

        let progress = machine.getProgress();
        const consumption = machine.boosts.consumption;
        const progressCapacity = Math.max(0, maxAmountToCraft * cost - progress);
        const energyToConsume = Math.min(machine.energy.get(), machine.rate, progressCapacity * consumption);
        machine.energy.consume(energyToConsume);
        progress += energyToConsume / consumption;
        const processCount = Math.min(Math.floor(progress / cost), maxAmountToCraft);
        if (processCount > 0) {
            if (requiredItems > 0) DoriosLib.entity.changeItemAmount(machine.entity, { slot: 3, amount: -requiredItems * processCount });
            if (requiredLiquid > 0) liquid.consume(requiredLiquid * processCount);
            if (product) {
                const result = outputItem ?? product;
                result.amount = (outputItem?.amount ?? 0) + itemAmount * processCount;
                inv.setItem(5, result);
            }
            if (liquidProduct) {
                if (outputLiquid.getType() === "empty") outputLiquid.setType(liquidProduct.type);
                outputLiquid.add(liquidAmount * processCount);
            }
            progress -= cost * processCount;
        }
        machine.setProgress(progress, { display: false });
        machine.on();
        machine.showStatus("Running");
        refresh();
    },

    onPlayerBreak(e) {
        Machine.onDestroy(e);
    },
});

function updateUI(machine, liquid, outputLiquid) {
    liquid.display(4);
    outputLiquid.display(6);
    machine.displayProgress();
    machine.displayEnergy();
}
