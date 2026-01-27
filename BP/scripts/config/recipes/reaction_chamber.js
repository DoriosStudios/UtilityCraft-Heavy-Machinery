
export const reactionRecipes = {
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
