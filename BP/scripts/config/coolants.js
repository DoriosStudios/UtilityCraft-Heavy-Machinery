import { system } from "@minecraft/server";
import * as DoriosLib from "DoriosLib/index.js";

export const coolants = {}

const coolantsRegister = {
    "saline_coolant": {
        efficiency: 1,
        tier: 0
    }
}

DoriosLib.registry.registerCoolant(coolantsRegister);

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_coolant") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        for (const [inputId, data] of Object.entries(payload)) {
            if (!data.efficiency) continue;

            // Directly assign; machine will handle defaults
            coolants[inputId] = {
                efficiency: data.efficiency ?? 1,
                tier: data.tier ?? 0
            };
        }
    } catch (err) {
    }
});
