export const electrolyzerRecipes = {
    "water|empty": {
        required_liquid: 1000,
        output1: {
            type: "hydrogen_gas",
            amount: 1000,
        },
        output2: {
            type: "oxygen_gas",
            amount: 500,
        },
        cost: 512000,
    },
    "empty|hydrogen_fluoride_gas": {
        required_gas: 1000,
        output1: {
            type: "hydrogen_gas",
            amount: 400,
        },
        output2: {
            type: "fluorine_gas",
            amount: 400,
        },
        cost: 128000,
    },
};
