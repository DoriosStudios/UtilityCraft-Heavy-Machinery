export const chemicalConverterRecipes = {
    "utilitycraft:fluorite_dust|sulfuric_acid|empty": {
        required_items: 1,
        required_liquid: 250,
        output_gas: { type: "hydrogen_fluoride_gas", amount: 1000 },
        cost: 512000,
    },
    "utilitycraft:uranium_concentrate|empty|fluorine_gas": {
        required_items: 1,
        required_gas: 400,
        output_gas: { type: "natural_uranium_hexafluoride_gas", amount: 1000 },
        cost: 2048000,
    },
};
