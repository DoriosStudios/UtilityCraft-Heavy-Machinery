import { system, world } from "@minecraft/server";

const newRecipes = {
    "utilitycraft:steel_dust|minecraft:glass": { output: "utilitycraft:tempered_steel_glass", required: 8 },
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(newRecipes));
});