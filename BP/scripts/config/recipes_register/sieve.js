import { world, system } from '@minecraft/server'

const newDrops = {
    "minecraft:gravel": [
        { item: "utilitycraft:tin_chunk", amount: 1, chance: 0.05, tier: 4 }
    ],
    "utilitycraft:compressed_gravel": [
        { item: "utilitycraft:tin_chunk", amount: 9, chance: 0.05, tier: 4 }
    ],
    "utilitycraft:crushed_cobbled_deepslate": [
        { item: "utilitycraft:deepslate_tin_chunk", amount: 1, chance: 0.05, tier: 4 }
    ],
    "utilitycraft:compressed_crushed_cobbled_deepslate": [
        { item: "utilitycraft:deepslate_tin_chunk", amount: 9, chance: 0.05, tier: 4 }
    ]
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_sieve_drop", JSON.stringify(newDrops));
});