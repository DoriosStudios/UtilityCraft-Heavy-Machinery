import { system, world } from "@minecraft/server";

const newRecipes = {
    // Tin
    "utilitycraft:tin_ingot": { output: "utilitycraft:tin_plate", required: 1 },
    // Uranium
    "utilitycraft:uranium_ingot": { output: "utilitycraft:uranium_rod", required: 1 },
    // Bronze
    "utilitycraft:bronze_ingot": { output: "utilitycraft:bronze_plate", required: 1 },
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_press_recipe", JSON.stringify(newRecipes));
});
