import { system } from "@minecraft/server";

/**
 * Infusing recipes for the Infuser machine.
 *
 * Uses a flat key format: "catalyst|input".
 * Each entry defines the output item and optional requirements.
 *
 * @constant
 * @type {InfuserRecipes}
 */
export const infuserRecipes = {}
/**
 * ScriptEvent receiver: "utilitycraft:register_infuser_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace Infuser recipes.
 * The key must be in `"catalyst|input"` format.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "minecraft:redstone|minecraft:iron_ingot": { "output": "utilitycraft:energized_iron_ingot", "required": 4 },
 *   "minecraft:coal|minecraft:iron_ingot": { "output": "utilitycraft:steel_ingot" }
 * }
 * ```
 *
 * Behavior:
 * - New recipes are created automatically if missing.
 * - Existing recipes are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_infuser_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [recipeKey, data] of Object.entries(payload)) {
            if (!data.output || typeof data.output !== "string") continue;
            if (!recipeKey.includes("|")) {
                console.warn(`[UtilityCraft] Invalid infuser key '${recipeKey}', expected "catalyst|input" format.`);
                continue;
            }

            if (infuserRecipes[recipeKey]) {
                replaced++;
            } else {
                added++;
            }

            infuserRecipes[recipeKey] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse infuser registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom Infuser recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace infuser recipes dynamically
    const newRecipes = {
        "minecraft:redstone|minecraft:copper_ingot": { output: "utilitycraft:charged_copper_ingot", required: 2 },
        "minecraft:coal|minecraft:iron_ingot": { output: "utilitycraft:steel_ingot" },
        // This one replaces an existing recipe
        "minecraft:redstone|minecraft:iron_ingot": { output: "utilitycraft:energized_iron_ingot", required: 2 }
    };

    // Send the event to the Infuser script
    system.sendScriptEvent("utilitycraft:register_infuser_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom infuser recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_infuser_recipe {"minecraft:redstone|minecraft:copper_ingot":{"output":"utilitycraft:charged_copper_ingot","required":2},"minecraft:coal|minecraft:iron_ingot":{"output":"utilitycraft:steel_ingot"}}
*/