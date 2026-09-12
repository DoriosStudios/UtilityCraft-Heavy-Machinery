export const chemicalProcessorRecipes = {
    "nuclear_waste_gas|water": {
        required_gas: 1000,
        required_liquid: 1000,
        output_item: { id: "utilitycraft:spent_uranium_pellet", amount: 1 },
        cost: 256000,
    },
    "enriched_uranium_hexafluoride_gas|water": {
        required_gas: 250,
        required_liquid: 1000,
        output_item: { id: "utilitycraft:enriched_uranium_oxide", amount: 1 },
        output_gas: { type: "hydrogen_fluoride_gas", amount: 800 },
        cost: 256000,
    },
};
