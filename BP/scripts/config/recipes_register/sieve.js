import * as DoriosLib from "DoriosLib/index.js";

const newDrops = {
    "minecraft:gravel": [
        { item: "utilitycraft:tin_chunk", amount: 1, chance: 0.05, tier: 4 }
    ],
    "utilitycraft:compressed_gravel": [
        { item: "utilitycraft:tin_chunk", amount: 9, chance: 0.05, tier: 4 }
    ],
    "utilitycraft:crushed_cobbled_deepslate": [
        { item: "utilitycraft:deepslate_tin_chunk", amount: 1, chance: 0.05, tier: 4 },
        { item: "utilitycraft:deepslate_uranium_chunk", amount: 1, chance: 0.01, tier: 4 }
    ],
    "utilitycraft:compressed_crushed_cobbled_deepslate": [
        { item: "utilitycraft:deepslate_tin_chunk", amount: 9, chance: 0.05, tier: 4 },
        { item: "utilitycraft:deepslate_uranium_chunk", amount: 9, chance: 0.01, tier: 4 }
    ]
};

DoriosLib.registry.registerSieveDrop(newDrops);
