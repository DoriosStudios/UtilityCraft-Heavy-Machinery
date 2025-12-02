import * as doriosAPI from "../doriosAPI.js"
import { world, system, ItemStack } from '@minecraft/server'

export { EnergyManager, LiquidManager, Machinery } from './managers.js'

const maxSize = 25;

const energyPerUnit = {
    'energy_cell': 2.56e6,
    'basic_power_condenser_unit': 256e6,
    'advanced_power_condenser_unit': 1.6e9,
    'expert_power_condenser_unit': 6.4e9,
    'ultimate_power_condenser_unit': 51.2e9
}


export const MultiblockStructure = {

    /**
     * Detects a valid multiblock structure starting from a controller block.
     * 
     * @param {object} e The event data object containing information about the destroyed block and player.
     * @returns {{ bounds: { min: {Vector3}, max: Vector3 }, components: Object.<string, number>,inputBlocks: string[], caseBlocks: string[], ventBlocks: string[], center: Vector3 } | null}
     */
    async detectFromController(e, caseTag) {
        const controllerBlock = e.block
        const sendMessage = e.player.sendMessage.bind(e.player)
        const dim = controllerBlock.dimension;
        const startPos = controllerBlock.location;

        // Step 1: Find the bounding box of the potential multiblock structure
        const bounds = await MultiblockStructure.findMultiblockBounds(startPos, dim, caseTag);
        if (bounds == undefined) {
            sendMessage('§c[Scan] No valid casing structure found around the controller.')
            return false;
        }

        sendMessage('§7[Scan] Detecting outer casing bounds and scanning internal components...')
        const { min, max } = bounds;
        const data = await MultiblockStructure.scanStructure(min, max, dim, startPos, caseTag)
        // Step 2: Verify that the bounding box is fully enclosed with casing blocks and scan components
        if (typeof data === 'string') {
            sendMessage(`§c[Scan] Invalid block detected at:${data}`)
            return false;
        }
        const { components, inputBlocks, caseBlocks, ventBlocks } = data

        // Step 3: Return structure data
        await MultiblockStructure.showFormationEffect(bounds, dim)
        return {
            bounds,
            components,
            inputBlocks,
            caseBlocks,
            ventBlocks,
            center: this.getCenter(min, max),
        };
    },

    async showFormationEffect(bounds, dim) {
        const { min, max } = bounds;

        for (let y = min.y; y <= max.y; y++) {
            const yOffset = y + 0.5;

            // Cara norte (Z mín)
            for (let x = min.x; x <= max.x; x++) {
                dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
                    x: x + 0.5,
                    y: yOffset,
                    z: min.z - 0.1
                });
            }

            // Cara sur (Z máx)
            for (let x = min.x; x <= max.x; x++) {
                dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
                    x: x + 0.5,
                    y: yOffset,
                    z: max.z + 1.1
                });
            }

            // Cara oeste (X mín)
            for (let z = min.z; z <= max.z; z++) {
                dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
                    x: min.x - 0.1,
                    y: yOffset,
                    z: z + 0.5
                });
            }

            // Cara este (X máx)
            for (let z = min.z; z <= max.z; z++) {
                dim.spawnParticle("minecraft:redstone_ore_dust_particle", {
                    x: max.x + 1.1,
                    y: yOffset,
                    z: z + 0.5
                });
            }

            await system.waitTicks(2);
        }
    },

    /**
         * Finds the full bounds of a multiblock structure by expanding from the controller block.
         * Prioritizes east/west, then north/south, then vertical.
         * 
         * @param {Vector3} start Controller block position.
         * @param {Dimension} dim Dimension to scan.
         * @returns {Promise<{ min: Vector3, max: Vector3 } | null>}
         */
    async findMultiblockBounds(start, dim, caseTag) {
        const isCasing = pos => dim.getBlock(pos)?.hasTag(caseTag);

        async function expandAxis(axis, origin) {
            let min = origin[axis], max = origin[axis];

            for (let i = 1; i <= maxSize; i++) {
                if (i % 2 == 0) await system.waitTicks(1)
                const pos = { ...origin, [axis]: origin[axis] + i };
                if (!isCasing(pos)) break;
                max = pos[axis];
            }

            for (let i = 1; i <= maxSize; i++) {
                if (i % 2 == 0) await system.waitTicks(1)
                const pos = { ...origin, [axis]: origin[axis] - i };
                if (!isCasing(pos)) break;
                min = pos[axis];
            }

            return [min, max];
        }

        const origin = { ...start };

        // Detect initial casing direction
        const hasEast = isCasing({ ...origin, x: origin.x + 1 });
        const hasWest = isCasing({ ...origin, x: origin.x - 1 });
        const hasNorth = isCasing({ ...origin, z: origin.z - 1 });
        const hasSouth = isCasing({ ...origin, z: origin.z + 1 });

        let minX, maxX, minZ, maxZ;

        if (hasEast || hasWest) {
            [minX, maxX] = await expandAxis('x', origin);

            // Pick valid casing block for Z scan
            let zScanPoint = { ...origin, x: minX };
            if (!isCasing(zScanPoint)) zScanPoint = { ...origin, x: maxX };
            if (!isCasing(zScanPoint)) return null;

            [minZ, maxZ] = await expandAxis('z', zScanPoint);
        } else if (hasNorth || hasSouth) {
            [minZ, maxZ] = await expandAxis('z', origin);

            // Pick valid casing block for X scan
            let xScanPoint = { ...origin, z: minZ };
            if (!isCasing(xScanPoint)) xScanPoint = { ...origin, z: maxZ };
            if (!isCasing(xScanPoint)) return null;

            [minX, maxX] = await expandAxis('x', xScanPoint);
        } else {
            return null; // No valid direction
        }

        // Pick known corner for Y scan
        const yScanPoint = { x: minX, y: origin.y, z: minZ };
        const [minY, maxY] = await expandAxis('y', yScanPoint);

        return {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ }
        };
    },
    /**
     * Checks if the entire outer shell of the bounding box is made of casing blocks.
     * Allows the controller block to be part of the frame even if it lacks the casing tag.
     * 
     * Scans the internal volume of a multiblock and counts valid component blocks.
     * 
     * The interior must only contain air or blocks with the tag "dorios:multiblock_component".
     * If an invalid block is found, returns its position as a string.
     *  
     * @param {Vector3} min Minimum corner of the structure.
     * @param {Vector3} max Maximum corner of the structure.
     * @param {Dimension} dim The dimension to scan.
     * @param {Vector3} controller Position of the controller block.
     * @returns {Object.<string, number> | string} Component map if valid, or a string with the invalid block position.
     */
    async scanStructure(min, max, dim, controller, caseTag) {
        const components = {};
        const inputBlocks = [];
        const caseBlocks = [];
        const ventBlocks = [];

        for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
                for (let z = min.z; z <= max.z; z++) {
                    if (z % 8 == 0) await system.waitTicks(1)
                    const block = dim.getBlock({ x, y, z });

                    const isEdge =
                        x === min.x || x === max.x ||
                        y === min.y || y === max.y ||
                        z === min.z || z === max.z;

                    if (isEdge) {
                        if (block.x === controller.x && block.y === controller.y && block.z === controller.z) continue
                        if (block?.hasTag(caseTag)) {
                            if (block?.hasTag('dorios:port')) {
                                inputBlocks.push(`input:[${x},${y},${z}]`)
                            }
                            if (block?.hasTag("dorios:vent_block") && y === max.y) {
                                components['vent'] = (components['vent'] ?? 0) + 1;
                                ventBlocks.push({ x, y, z })
                            }
                            caseBlocks.push({ x, y, z })
                            continue
                        }
                        return `x: ${x}, y: ${y}, z: ${z}`;
                    }
                    if (block?.typeId === "minecraft:air") {
                        components['air'] = (components['air'] ?? 0) + 1
                        continue
                    };

                    if (block?.hasTag("dorios:multiblock_component")) {
                        const id = block.typeId.split(':')[1];
                        components[id] = (components[id] ?? 0) + 1;
                        continue;
                    }
                    if (block?.isLiquid) continue
                    // Invalid block found
                    return `x: ${x}, y: ${y}, z: ${z}`;
                }
            }
        }

        return { components, inputBlocks, caseBlocks, ventBlocks };
    },

    /**
     * Fills all AIR cells inside the bounds with the given block using the /fill command.
     * Processes one horizontal layer per pass, bottom → top, with a 4-tick pause between layers.
     *
     * @param {{min: Vector3, max: Vector3}} bounds
     * @param {Dimension} dim
     * @param {string} blockId Example: "minecraft:water"
     */
    async fillEmptyBlocks(bounds, dim, blockId = "minecraft:water") {
        const xA = bounds.min.x, yA = bounds.min.y, zA = bounds.min.z;
        const xB = bounds.max.x, yB = bounds.max.y, zB = bounds.max.z;

        const yBottom = yA <= yB ? yA : yB;
        const yTop = yA <= yB ? yB : yA;

        for (let y = yBottom; y <= yTop; y++) {
            dim.runCommand(`fill ${xA} ${y} ${zA} ${xB} ${y} ${zB} ${blockId} replace air`);
            await system.waitTicks(4); // bottom → top pacing
        }
    },

    /**
     * Empties all cells of the given block inside the bounds by replacing them with AIR.
     * Processes one horizontal layer per pass, top → bottom, with a 4-tick pause between layers.
     *
     * @param {Entity} entity
     * @param {string} blockId Example: "minecraft:water"
     */
    async emptyBlocks(entity, blockId = "minecraft:water") {
        const oldDataRaw = entity.getDynamicProperty("reactorStats");
        if (!oldDataRaw) return
        const oldData = JSON.parse(oldDataRaw)
        const bounds = oldData.bounds
        const dim = entity.dimension
        const xA = bounds.min.x, yA = bounds.min.y, zA = bounds.min.z;
        const xB = bounds.max.x, yB = bounds.max.y, zB = bounds.max.z;

        const yBottom = yA <= yB ? yA : yB;
        const yTop = yA <= yB ? yB : yA;

        for (let y = yTop; y >= yBottom; y--) {
            dim.runCommand(`fill ${xA} ${y} ${zA} ${xB} ${y} ${zB} air replace ${blockId}`);
            await system.waitTicks(2); // top → bottom pacing
        }
    },


    /**
     * Calculates the center point of a bounding box.
     * 
     * @param {Vector3} min Minimum corner of the structure.
     * @param {Vector3} max Maximum corner of the structure.
     * @returns {Vector3} The geometric center of the box.
     */
    getCenter(min, max) {
        return {
            x: (min.x + max.x) / 2,
            y: (min.y + max.y) / 2,
            z: (min.z + max.z) / 2
        };
    },

    deactivateMultiblock(player, entity) {
        player.sendMessage("§c[Scan] Multiblock structure deactivated.");
        entity?.triggerEvent('hide')
        entity.getTags().forEach(tag => {
            if (tag.startsWith('input:')) {
                const [x, y, z] = tag.slice(7, -1).split(",").map(Number);
                const inputBlock = player.dimension.getBlock({ x, y, z })
                if (inputBlock?.hasTag('dorios:port')) {
                    entity.removeTag(tag)
                    inputBlock.setPermutation(inputBlock.permutation.withState('utilitycraft:active', 0));
                    player.runCommand(`scriptevent dorios:updatePipes energy|[${x},${y},${z}]`)
                }
            }
        })
        entity.setDynamicProperty('dorios:rateSpeed', 0)
        entity.setDynamicProperty('dorios:caseBlocks', 'empty')
    },

    activateMultiblock(entity, inputBlocks) {
        entity.triggerEvent('show')
        inputBlocks.forEach(tag => {
            entity.addTag(tag)
            const [x, y, z] = tag.slice(7, -1).split(",").map(Number);
            const inputBlock = entity.dimension.getBlock({ x, y, z })
            if (inputBlock?.hasTag('dorios:port')) {
                inputBlock.setPermutation(inputBlock.permutation.withState('utilitycraft:active', 1));
                entity.runCommand(`scriptevent dorios:updatePipes energy|[${x},${y},${z}]`)
            }
        })
    },


    /**
 * Calculates the total energy capacity.
 *
 * @param {Object.<string, number>} components Object with block typeIds and their amounts.
 * @returns {number|string} Total energy capacity or error message if invalid components exist.
 */
    calculateEnergyCapacity(components) {
        let total = 0;

        for (const [id, count] of Object.entries(components)) {
            const amount = energyPerUnit[id]
            if (!amount) continue
            total += count * amount;
        }

        return total;
    },

    getVolume(bounds) {
        return (bounds.max.x - bounds.min.x + 1) * (bounds.max.y - bounds.min.y + 1) * (bounds.max.z - bounds.min.z + 1);
    }
}

world.afterEvents.playerBreakBlock.subscribe(e => {
    const { brokenBlockPermutation, block, player } = e
    let { x, y, z } = block.location;

    if (brokenBlockPermutation.hasTag('dorios:multiblock_case')) {
        const entity = block.dimension.getEntities({
            location: block.location,
            maxDistance: maxSize,
            families: ['dorios:multiBlock']
        }).filter(ent => {
            const raw = ent.getDynamicProperty("dorios:caseBlocks");
            if (!raw || raw === "empty") return false;

            try {
                const parsed = JSON.parse(raw); // [{x, y, z}, ...]
                return parsed.some(pos =>
                    pos.x === x &&
                    pos.y === y &&
                    pos.z === z
                );
            } catch {
                return false;
            }
        })[0]
        if (!entity) return
        MultiblockStructure.deactivateMultiblock(player, entity)
        MultiblockStructure.emptyBlocks(entity, 'minecraft:water')
    }
})
