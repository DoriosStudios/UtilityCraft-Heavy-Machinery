import { system, world } from "@minecraft/server";

const newRecipes = {
    "utilitycraft:tin_dust": { output: "utilitycraft:tin_ingot" },
    "utilitycraft:raw_tin": { output: "utilitycraft:tin_ingot" },
    "utilitycraft:raw_tin_block": { output: "utilitycraft:tin_block" },
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_furnace_recipe", JSON.stringify(newRecipes));
});