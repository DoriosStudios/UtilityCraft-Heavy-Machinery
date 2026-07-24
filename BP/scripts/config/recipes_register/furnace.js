import * as DoriosLib from "DoriosLib/index.js";

const newRecipes = {
    "utilitycraft:tin_dust": { output: "utilitycraft:tin_ingot" },
    "utilitycraft:raw_tin": { output: "utilitycraft:tin_ingot" },
    "utilitycraft:raw_tin_block": { output: "utilitycraft:tin_block" },
    "utilitycraft:uranium_dust": { output: "utilitycraft:uranium_ingot" },
    "utilitycraft:raw_uranium": { output: "utilitycraft:uranium_ingot" },
    "utilitycraft:raw_uranium_block": { output: "utilitycraft:uranium_block" },
    // Bronze
    "utilitycraft:bronze_dust": { output: "utilitycraft:bronze_ingot" },
    "utilitycraft:brute_bronze": { output: "utilitycraft:bronze_ingot" },
    "utilitycraft:brute_bronze_block": { output: "utilitycraft:bronze_block" },
};

DoriosLib.registry.registerFurnaceRecipe(newRecipes);
