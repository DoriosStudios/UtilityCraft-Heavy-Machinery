import { system } from "@minecraft/server";

/**
 * Represents a possible sieve loot drop.
 * 
 * @typedef {Object} SieveLoot
 * @property {string} item   Item identifier (namespace:item_name).
 * @property {number} amount Number of items granted on success.
 * @property {number} chance Drop probability (0–1).
 * @property {number} tier   Minimum sieve tier required.
 */

/**
 * Recipes for the Sieve machine.
 * Each key is the input block/item, and the value is an array of possible loot.
 *
 * @type {Object.<string, SieveLoot[]>}
 */
export const sieveRecipes = {}

/**
 * ScriptEvent receiver: "utilitycraft:register_sieve_drop"
 * 
 * Allows other addons or scripts to **add new drops to existing blocks only**.
 * 
 * Expected payload format (JSON):
 * 
 * {
 *   "minecraft:gravel": [
 *     { "item": "minecraft:string", "amount": 1, "chance": 0.05 }
 *   ],
 *   "minecraft:dirt": [
 *     { "item": "minecraft:apple", "amount": 1, "chance": 0.10 }
 *   ]
 * }
 * 
 * - If a block ID is not already defined in `sieveRecipes`, the entry is skipped.
 * - If an invalid format is detected, a warning is printed and ignored.
 */
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "utilitycraft:register_sieve_drop") return;

    try {
        const payload = JSON.parse(message);
        if (!payload || typeof payload !== "object") {
            console.warn("[UtilityCraft] Invalid payload format received.");
            return;
        }

        let addedBlocks = 0;
        let addedDrops = 0;

        for (const [blockId, drops] of Object.entries(payload)) {
            if (!Array.isArray(drops)) continue;

            // Si el bloque no existía, se crea una nueva entrada
            if (!sieveRecipes[blockId]) {
                sieveRecipes[blockId] = [];
                addedBlocks++;
            }

            for (const drop of drops) {
                if (!drop.item || typeof drop.item !== "string") continue;

                sieveRecipes[blockId].push({
                    item: drop.item,
                    amount: drop.amount ?? 1,
                    chance: drop.chance ?? 0.1,
                    tier: drop.tier ?? 0
                });

                addedDrops++;
            }
        }
    } catch {
    }
});

// ==================================================
// EXAMPLES – How to register custom sieve drops
// ==================================================
/*
import { system, world } from "@minecraft/server";

world.afterEvents.worldLoad.subscribe(() => {
    // Add new custom drops for blocks
    // You can add drops to existing blocks (like gravel)
    // or define completely new ones that didn’t exist before.
    const newDrops = {
        "utilitycraft:crushed_basalt": [
            { item: "minecraft:blackstone", amount: 1, chance: 0.3, tier: 1 },
            { item: "minecraft:basalt", amount: 1, chance: 0.15, tier: 1 },
            { item: "minecraft:coal", amount: 1, chance: 0.1, tier: 2 }
        ],
        "minecraft:gravel": [
            { item: "minecraft:string", amount: 1, chance: 0.05 },
            { item: "minecraft:bone_meal", amount: 1, chance: 0.15 }
        ]
    };

    // Send the event to the sieve script
    // This tells UtilityCraft to register your new drops dynamically.
    system.sendScriptEvent("utilitycraft:register_sieve_drop", JSON.stringify(newDrops));

    console.warn("[Addon] Custom sieve drops registered via system event.");
});

// You can also do this directly with a command inside Minecraft:
Command:
/scriptevent utilitycraft:register_sieve_drop {"utilitycraft:crushed_endstone":[{"item":"minecraft:dragon_breath","amount":1,"chance":0.05,"tier":5}]}
*/
