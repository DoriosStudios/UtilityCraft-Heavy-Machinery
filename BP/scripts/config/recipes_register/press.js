import * as DoriosLib from "DoriosLib/index.js";

const newRecipes = {
    // Tin
    "utilitycraft:tin_chunk": { output: "utilitycraft:tin_ore", required: 4 },
    "utilitycraft:deepslate_tin_chunk": { output: "utilitycraft:deepslate_tin_ore", required: 4 },
    "utilitycraft:tin_ingot": { output: "utilitycraft:tin_plate", required: 1 },
    // Uranium
    "utilitycraft:deepslate_uranium_chunk": { output: "utilitycraft:deepslate_uranium_ore", required: 4 },
    "utilitycraft:uranium_ingot": { output: "utilitycraft:uranium_pellet", required: 1 },
    "utilitycraft:enriched_uranium_oxide": { output: "utilitycraft:enriched_uranium_pellet", required: 1 },
    // Bronze
    "utilitycraft:bronze_ingot": { output: "utilitycraft:bronze_plate", required: 1 },
};

DoriosLib.registry.registerPressRecipe(newRecipes);
