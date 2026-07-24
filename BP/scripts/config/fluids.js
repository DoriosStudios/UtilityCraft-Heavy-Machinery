import * as DoriosLib from "DoriosLib/index.js";

const fluidItems = {
    "utilitycraft:saline_coolant_bucket": {
        amount: 1000,
        type: "saline_coolant",
        output: "minecraft:bucket",
    },
};

const fluidHolders = {
    "minecraft:bucket": {
        types: {
            saline_coolant: "utilitycraft:saline_coolant_bucket",
        },
        required: 1000,
    },
};

DoriosLib.registry.registerFluidItem(fluidItems);
DoriosLib.registry.registerFluidHolder(fluidHolders);
