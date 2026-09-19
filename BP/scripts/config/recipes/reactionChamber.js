
export const reactionRecipes = {
    "minecraft:nether_star|sulfuric_acid": {
        required_items: 1,
        required_liquid: 1000,
        output_liquid: { type: "nether_star_essence", amount: 125 },
        cost: 16000000,
    },
    "utilitycraft:spent_uranium_pellet|nether_star_essence": {
        required_items: 2,
        required_liquid: 125,
        output_item: { id: "utilitycraft:stabilized_nuclear_matter", amount: 1 },
        cost: 128000000,
    },
    "minecraft:slime_ball|sulfuric_acid": {
        required_items: 4,
        required_liquid: 250,
        output_item: { id: "utilitycraft:rubber_sheet", amount: 1 },
        cost: 16000,
    },
    "minecraft:sulfur_spike|water": {
        required_items: 4,
        required_liquid: 1000,
        output_liquid: { type: "sulfuric_acid", amount: 1000 },
        cost: 32000,
    },
    "utilitycraft:uranium_dust|sulfuric_acid": {
        required_items: 1,
        required_liquid: 250,
        output_item: { id: "utilitycraft:uranium_concentrate", amount: 1 },
        cost: 64000,
    },
    "minecraft:lapis_lazuli|water": {
        required_items: 4,
        required_liquid: 8000,
        output_liquid: {
            type: "heavy_water",
            amount: 1000
        },
        cost: 64000
    },
    "utilitycraft:calcite_pebble|water": {
        // ───── INPUT ─────
        required_items: 2,          // opcional (default 1)
        required_liquid: 1000,       // mB, opcional (default 0)

        // ───── OUTPUT ITEM ─────
        output_item: {              // opcional
            id: "utilitycraft:stone_pebble",
            amount: 2             // opcional (default 1)
        },

        // ───── OUTPUT LIQUID ─────
        output_liquid: {            // opcional
            type: "saline_coolant",
            amount: 1000             // mB
        },

        cost: 12800                 // opcional
    }
};
