import { system, world } from "@minecraft/server";

const newRecipes = {
    // Steel
    "utilitycraft:steel_dust|minecraft:glass": { output: "utilitycraft:tempered_steel_glass", required: 8 },
    // Darloonite
    "minecraft:echo_shard|minecraft:amethyst_shard": { output: "utilitycraft:darloonite_crystal", required: 1, cost: 6400 },
    "utilitycraft:diamond_dust|utilitycraft:darloonite_crystal": { output: "utilitycraft:charged_darloonite_crystal", required: 8, cost: 128_000 },

    "utilitycraft:tin_dust|minecraft:copper_ingot": { output: "utilitycraft:brute_bronze", required: 5, input_required: 2, cost: 6400 },
    "utilitycraft:tin_dust|utilitycraft:copper_dust": { output: "utilitycraft:brute_bronze", required: 5, input_required: 2, cost: 6400 },
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(newRecipes));
});