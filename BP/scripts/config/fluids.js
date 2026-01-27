import { system, world } from "@minecraft/server";


const fluidItemsRegister = {
    "utilitycraft:saline_coolant_bucket": { amount: 1000, type: 'saline_coolant', output: 'minecraft:bucket' }
};

world.afterEvents.worldLoad.subscribe(() => {
    // Send the event → registers all default fluids
    system.sendScriptEvent(
        "utilitycraft:register_fluid_item",
        JSON.stringify(fluidItemsRegister)
    );
});

const fluidHolderRegister = {
    // Vanilla buckets
    "minecraft:bucket": {
        types: {
            saline_coolant: "utilitycraft:saline_coolant_bucket"
        },
        required: 1000
    }
};

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent(
        "utilitycraft:register_fluid_holder",
        JSON.stringify(fluidHolderRegister)
    );
});
