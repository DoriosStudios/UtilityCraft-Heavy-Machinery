import * as DoriosLib from "DoriosLib/index.js";

const fluidItems = {
    "utilitycraft:nether_star_essence_bucket": {
        amount: 1000,
        type: "nether_star_essence",
        output: "minecraft:bucket",
    },
};

const fluidHolders = {
    "minecraft:bucket": {
        types: {
            nether_star_essence: "utilitycraft:nether_star_essence_bucket",
        },
        required: 1000,
    },
};

DoriosLib.registry.registerFluidItem(fluidItems);
DoriosLib.registry.registerFluidHolder(fluidHolders);
