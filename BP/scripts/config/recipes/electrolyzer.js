import * as DoriosLib from "DoriosLib/index.js";

const recipes = {
    "empty|hydrogen_fluoride_gas": {
        "required_gas": 1000,
        "output1": {
            "type": "hydrogen_gas",
            "amount": 400
        },
        "output2": {
            "type": "fluorine_gas",
            "amount": 400
        },
        "cost": 128000
    }
};
DoriosLib.registry.registerElectrolyzerRecipe(recipes);
