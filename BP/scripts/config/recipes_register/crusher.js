import * as DoriosLib from "DoriosLib/index.js";

const newRecipes = {
    // Tin
    "utilitycraft:deepslate_tin_chunk": { output: "utilitycraft:raw_tin", amount: 1 },
    "utilitycraft:tin_chunk": { output: "utilitycraft:raw_tin", amount: 1 },
    "utilitycraft:raw_tin": { output: "utilitycraft:tin_dust", amount: 2 },
    "utilitycraft:tin_ingot": { output: "utilitycraft:tin_dust", amount: 1 },
    "utilitycraft:tin_plate": { output: "utilitycraft:tin_dust", amount: 1 },
    "utilitycraft:raw_tin_block": { output: "utilitycraft:tin_dust", amount: 12 },
    "utilitycraft:tin_block": { output: "utilitycraft:tin_dust", amount: 6 },
    // Uranium
    "utilitycraft:deepslate_uranium_chunk": { output: "utilitycraft:raw_uranium", amount: 1 },
    "utilitycraft:raw_uranium": { output: "utilitycraft:uranium_dust", amount: 2 },
    "utilitycraft:uranium_ingot": { output: "utilitycraft:uranium_dust", amount: 1 },
    "utilitycraft:raw_uranium_block": { output: "utilitycraft:uranium_dust", amount: 12 },
    "utilitycraft:uranium_block": { output: "utilitycraft:uranium_dust", amount: 6 },
    // Bronze
    "utilitycraft:brute_bronze": { output: "utilitycraft:bronze_dust", amount: 2 },
    "utilitycraft:bronze_ingot": { output: "utilitycraft:bronze_dust", amount: 1 },
    "utilitycraft:bronze_plate": { output: "utilitycraft:bronze_dust", amount: 1 },
    "utilitycraft:brute_bronze_block": { output: "utilitycraft:bronze_dust", amount: 12 },
    "utilitycraft:bronze_block": { output: "utilitycraft:bronze_dust", amount: 6 },
};

DoriosLib.registry.registerCrusherRecipe(newRecipes);
