import { system } from "@minecraft/server";

/**
 * Pressing and compression recipes for the Electro Press machine.
 *
 * Each key represents an input item identifier, and its value specifies
 * the resulting output item, required input quantity, and output amount.
 *
 * @constant
 * @type {SingleInputRecipes}
 */
export const pressRecipes = {}

/**
 * ScriptEvent receiver: "utilitycraft:register_press_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace Electro Press recipes.
 * If the item already exists in `pressRecipes`, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "minecraft:stone": { "output": "minecraft:deepslate", "required": 4 },
 *   "minecraft:ice": { "output": "minecraft:packed_ice", "required": 9 }
 * }
 * ```
 *
 * Behavior:
 * - New items are created automatically if missing.
 * - Existing items are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_press_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [inputId, data] of Object.entries(payload)) {
            if (!data.output || typeof data.output !== "string") continue;

            if (pressRecipes[inputId]) {
                replaced++;
            } else {
                added++;
            }

            pressRecipes[inputId] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse press registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom Electro Press recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace press recipes dynamically
    const newRecipes = {
        "minecraft:stone": { output: "minecraft:deepslate", required: 4 },
        "minecraft:ice": { output: "minecraft:packed_ice", required: 9 },
        // This one replaces an existing recipe
        "minecraft:sand": { output: "utilitycraft:compressed_glass", required: 9 }
    };

    // Send the event to the press script
    system.sendScriptEvent("utilitycraft:register_press_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom press recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_press_recipe {"minecraft:stone":{"output":"minecraft:deepslate","required":4},"minecraft:sand":{"output":"utilitycraft:compressed_glass","required":9}}
*/