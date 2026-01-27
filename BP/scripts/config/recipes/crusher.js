import { world, system } from "@minecraft/server";

/**
 * Recipes for the Crusher machine.
 *
 * Each key represents an input item identifier, and its value specifies
 * the resulting output item, required input quantity, and output amount.
 *
 * @constant
 * @type {SingleInputRecipes}
 */
export const crusherRecipes = {};

/**
 * ScriptEvent receiver: "utilitycraft:register_crusher_recipe"
 *
 * Allows other addons or scripts to dynamically add or replace crusher recipes.
 * If the item already exists in `crusherRecipes`, it will be replaced.
 *
 * Expected payload format (JSON):
 * ```json
 * {
 *   "minecraft:stone": { "output": "minecraft:cobblestone", "amount": 1, "cost": 1000, "tier": 1 },
 *   "minecraft:bone_block": { "output": "minecraft:bone_meal", "amount": 9 }
 * }
 * ```
 *
 * Behavior:
 * - New items are created automatically if missing.
 * - Existing items are replaced and logged individually.
 * - Only a summary log is printed when finished.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_crusher_recipe") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") return;

        let added = 0;
        let replaced = 0;

        for (const [inputId, data] of Object.entries(payload)) {
            if (!data.output || typeof data.output !== "string") continue;

            if (crusherRecipes[inputId]) {
                replaced++;
            } else {
                added++;
            }

            // Directly assign; machine will handle defaults
            crusherRecipes[inputId] = data;
        }
    } catch (err) {
        console.warn("[UtilityCraft] Failed to parse crusher registration payload:", err);
    }
});

// ==================================================
// EXAMPLES – How to register custom crusher recipes
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add or replace crusher recipes dynamically
    const newRecipes = {
        "minecraft:stone": { output: "minecraft:cobblestone", amount: 1, cost: 1000, tier: 1 },
        "minecraft:clay": { output: "minecraft:clay_ball", amount: 4 },
        "minecraft:sponge": { output: "minecraft:string", amount: 2, cost: 1600 },
        // This one replaces an existing recipe
        "minecraft:cobblestone": { output: "minecraft:sand", amount: 1, cost: 1200 }
    };

    // Send the event to the crusher script
    system.sendScriptEvent("utilitycraft:register_crusher_recipe", JSON.stringify(newRecipes));

    console.warn("[Addon] Custom crusher recipes registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_crusher_recipe {"minecraft:stone":{"output":"minecraft:cobblestone","amount":1,"cost":1000,"tier":1},"minecraft:cobblestone":{"output":"minecraft:sand","amount":1,"cost":1200}}
*/