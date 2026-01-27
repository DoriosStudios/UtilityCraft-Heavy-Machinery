import { system } from "@minecraft/server";

/**
 * Recipes for the Incinerator machine.
 *
 * Each key represents an input item identifier, and its value specifies
 * the resulting output item, required input quantity, and output amount.
 *
 * @constant
 * @type {SingleInputRecipes}
 */
export const furnaceRecipes = {}

/**
 * ScriptEvent receiver: "utilitycraft:register_furnace_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace furnace recipes.
 * If the item already exists in `furnaceRecipes`, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "minecraft:stone": { "output": "minecraft:smooth_stone" },
 *   "minecraft:rotten_flesh": { "output": "strat:coagulated_blood" }
 * }
 * ```
 *
 * Behavior:
 * - New items are created automatically if missing.
 * - Existing items are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_furnace_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [inputId, data] of Object.entries(payload)) {
            if (!data.output || typeof data.output !== "string") continue;

            if (furnaceRecipes[inputId]) {
                replaced++;
            } else {
                added++;
            }

            // Directly assign; machine will handle defaults
            furnaceRecipes[inputId] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse furnace registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom furnace recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace furnace recipes dynamically
    const newRecipes = {
        "minecraft:stone": { output: "minecraft:smooth_stone" },
        "minecraft:rotten_flesh": { output: "strat:coagulated_blood" },
        // This one replaces an existing recipe
        "minecraft:cobblestone": { output: "minecraft:deepslate" }
    };

    // Send the event to the furnace script
    system.sendScriptEvent("utilitycraft:register_furnace_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom furnace recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_furnace_recipe {"minecraft:stone":{"output":"minecraft:smooth_stone"},"minecraft:cobblestone":{"output":"minecraft:deepslate"}}
*/