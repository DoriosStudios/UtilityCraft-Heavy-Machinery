import { system, world } from "@minecraft/server";

export const coolants = {}

const coolantsRegister = {
    "saline_coolant": {
        efficiency: 1,
        tier: 0
    }
}

world.afterEvents.worldLoad.subscribe(() => {
    system.sendScriptEvent("utilitycraft:register_coolant", JSON.stringify(coolantsRegister))
})

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_coolant") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        for (const [inputId, data] of Object.entries(payload)) {
            if (!data.output || typeof data.output !== "string") continue;

            // Directly assign; machine will handle defaults
            coolants[inputId] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse furnace registration payload:", err);
    }
});