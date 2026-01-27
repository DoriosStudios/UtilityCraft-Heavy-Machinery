import { system, world } from "@minecraft/server";

const newRecipes = {
    // Tin
    "utilitycraft:tin_ingot": { output: "utilitycraft:tin_plate", amount: 1 },
    // Bronze
    "utilitycraft:bronze_ingot": { output: "utilitycraft:bronze_plate", amount: 1 },
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_press_recipe", JSON.stringify(newRecipes));
});