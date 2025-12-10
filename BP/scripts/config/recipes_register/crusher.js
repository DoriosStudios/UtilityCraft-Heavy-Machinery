import { system, world } from "@minecraft/server";

const newRecipes = {
    // Tin
    "utilitycraft:deepslate_tin_chunk": { output: "utilitycraft:raw_tin", amount: 1 },
    "utilitycraft:tin_chunk": { output: "utilitycraft:raw_tin", amount: 1 },
    "utilitycraft:raw_tin": { output: "utilitycraft:tin_dust", amount: 2 },
    "utilitycraft:tin_ingot": { output: "utilitycraft:tin_dust", amount: 1 },
    "utilitycraft:tin_plate": { output: "utilitycraft:tin_dust", amount: 1 },
    "utilitycraft:raw_tin_block": { output: "utilitycraft:tin_dust", amount: 12 },
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_crusher_recipe", JSON.stringify(newRecipes));
});