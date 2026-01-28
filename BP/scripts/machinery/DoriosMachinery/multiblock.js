import { world, system, ItemStack } from '@minecraft/server'
import { Energy } from './core.js'

/**
 * Maximum expansion distance allowed when scanning multiblock casing boundaries.
 * Used by findMultiblockBounds() to prevent infinite outward scanning.
 *
 * @constant
 * @type {number}
 * @private
 */
const MAX_SIZE = 99;

let SCAN_SPEED = 64

/**
 * Energy capacity contributed by each type of multiblock component.
 * Keys represent block identifiers, and values represent energy units contributed.
 *
 * @constant
 * @type {Object.<string, number>}
 * @private
 */
const ENERGY_PER_UNIT = {
    'energy_cell': 4e6,
    'basic_power_condenser_unit': 40e6,
    'advanced_power_condenser_unit': 320e6,
    'expert_power_condenser_unit': 2.56e9,
    'ultimate_power_condenser_unit': 64e9
};

/**
 *  DoriosMachinery – Multiblock Extension
 *
 * The Multiblock module provides optional support for
 * detecting, validating and interacting with multiblock machines.
 * 
 * This system does *not* replace the main Machinery core and does
 * not function independently. Instead, it acts as a structural
 * utility layer that:
 *
 *   - Scans casing blocks around a controller
 *   - Calculates bounding-box limits for potential structures
 *   - Validates internal components and ports
 *   - Activates or deactivates multiblock machines
 *   - Supports visual and particle feedback during formation
 *   - Computes structural metrics (volume, capacity, etc.)
 *
 * All results produced by this module are intended to be consumed
 * by higher-level machinery logic (Machinery, EnergyManager, etc.).
 *
 * This module is implemented as a functional singleton rather than
 * a class, because:
 *   - It does not require instances
 *   - It exposes stateless utility operations
 *   - It behaves as a structural helper used by the core
 *
 * Dependencies:
 *   - DoriosMachinery/core.js (for machinery behavior)
 *   - DoriosAPI (global, for additional helpers or integration)
 *
 * Usage:
 *   const structure = await Multiblock.detectFromController(event, "dorios:reactor_casing");
 *   if (structure) {
 *       // Pass structure data into Machinery or a custom machine controller
 *   }
 *
 * @namespace Multiblock
 * @version 1.0.0
 * @author Dorios Studios
 */
export const Multiblock = {
    /**
     * Scans and validates a potential multiblock structure using the controller block
     * as the origin. Called when a player activates or interacts with a multiblock controller.
     *
     * Steps performed:
     *  1. Detect casing boundaries by scanning outward.
     *  2. Validate the casing shell and interior contents.
     *  3. Identify all structural components (vents, ports, casing blocks).
     *  4. Emit a formation effect when the structure is valid.
     *
     * If the structure is incomplete or contains invalid blocks, a message is sent
     * to the player and the method returns `false`.
     *
     * @async
     * @function detectFromController
     * @memberof Multiblock
     *
     * @param {{ block: Block, player: Player }} e Event object containing the controller block and triggering player.
     * @param {string} caseTag Tag that identifies valid casing blocks for this multiblock.
     *
     * @returns {Promise<{bounds:{min:Vector3,max:Vector3},components:Object.<string,number>,inputBlocks:string[],caseBlocks:{x:number,y:number,z:number}[],ventBlocks:{x:number,y:number,z:number}[],center:Vector3} | false>} Structure data if valid, or false if validation fails.
     *
     * @example
     * const result = await Multiblock.detectFromController(event, "dorios:reactor_casing");
     * if (result) {
     *     const { bounds, components } = result;
     *     // Apply structure data to machinery logic...
     * }
     */
    async detectFromController(e, caseTag) {
        const controllerBlock = e.block
        const sendMessage = e.player.sendMessage.bind(e.player)
        const dim = controllerBlock.dimension;
        const startPos = controllerBlock.location;

        // Step 1: Find the bounding box of the potential multiblock structure
        const bounds = await Multiblock.findMultiblockBounds(startPos, dim, caseTag);
        if (bounds == undefined) {
            sendMessage('§c[Scan] No valid casing structure found around the controller.')
            return false;
        }

        sendMessage('§7[Scan] Detecting outer casing bounds and scanning internal components...')
        const { min, max } = bounds;
        const data = await Multiblock.scanStructure(min, max, dim, startPos, caseTag)
        // Step 2: Verify that the bounding box is fully enclosed with casing blocks and scan components
        if (typeof data === 'string') {
            sendMessage(`§c[Scan] Invalid block detected at:${data}`)
            return false;
        }
        const { components, inputBlocks, caseBlocks, ventBlocks } = data

        // Step 3: Return structure data
        await Multiblock.showFormationEffect(bounds, dim)
        return {
            bounds,
            components,
            inputBlocks,
            caseBlocks,
            ventBlocks,
            center: this.getCenter(min, max),
        };
    },

    /**
     * Displays a formation particle effect along the outer faces of the structure's
     * bounding box. This is a visual indicator used when a multiblock is successfully
     * formed and validated.
     *
     * The effect:
     *  - Draws redstone particles on the four vertical sides.
     *  - Animates bottom → top, layer by layer.
     *  - Adds a brief delay per layer for smoother visuals.
     *
     * @async
     * @function showFormationEffect
     * @memberof Multiblock
     *
     * @param {{ min: Vector3, max: Vector3 }} bounds Bounding box of the structure.
     * @param {Dimension} dim Dimension where particles will be spawned.
     *
     * @returns {Promise<void>} Resolves when the animation is complete.
     */
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
     * Attempts to determine the full outer bounds of a multiblock casing structure
     * by expanding outward from the controller block. The scan searches along X, Z,
     * and Y axes to detect the maximum enclosed rectangular volume formed by blocks
     * containing the specified casing tag.
     *
     * Axis expansion order:
     *  1. Horizontal priority — east/west, then north/south.
     *  2. Vertical scan — expands upward and downward last.
     *
     * Expansion stops when:
     *  - A block without the casing tag is encountered, or
     *  - The maximum scan size limit is reached.
     *
     * @async
     * @function findMultiblockBounds
     * @memberof Multiblock
     * 
     * @param {Vector3} start Starting position (controller block).
     * @param {Dimension} dim The dimension used for block lookups.
     * @param {string} caseTag Tag that identifies casing blocks.
     * 
     * @returns {Promise<{min: Vector3, max: Vector3} | null>} Bounding corners or null if invalid.
     */
    async findMultiblockBounds(start, dim, caseTag) {
        const isCasing = pos => dim.getBlock(pos)?.hasTag(caseTag);

        async function expandAxis(axis, origin) {
            let min = origin[axis], max = origin[axis];

            for (let i = 1; i <= MAX_SIZE; i++) {
                if (i % 2 == 0) await system.waitTicks(1)
                const pos = { ...origin, [axis]: origin[axis] + i };
                if (!isCasing(pos)) break;
                max = pos[axis];
            }

            for (let i = 1; i <= MAX_SIZE; i++) {
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
     * Validates the full multiblock volume by checking casing integrity, interior components, ports, and vents. 
     * Returns component data or a position string when an invalid block is found.
     *
     * @async
     * @function scanStructure
     * @memberof Multiblock
     *
     * @param {Vector3} min Minimum corner of the bounding box.
     * @param {Vector3} max Maximum corner of the bounding box.
     * @param {Dimension} dim Dimension used for block scanning.
     * @param {Vector3} controller Controller block position (excluded from casing check).
     * @param {string} caseTag Tag used to identify casing blocks.
     *
     * @returns {Promise<{components:Object.<string,number>,inputBlocks:string[],caseBlocks:{x:number,y:number,z:number}[],ventBlocks:{x:number,y:number,z:number}[]}|string>}
     *          Component data when valid, or a string containing the invalid block position.
     */
    async scanStructure(min, max, dim, controller, caseTag) {
        const components = {};
        const inputBlocks = [];
        const ventBlocks = [];

        for (let x = min.x; x <= max.x; x++) {
            for (let y = min.y; y <= max.y; y++) {
                for (let z = min.z; z <= max.z; z++) {
                    if (z % SCAN_SPEED == 0) await system.waitTicks(1)
                    const block = dim.getBlock({ x, y, z });

                    const isEdge =
                        x === min.x || x === max.x ||
                        y === min.y || y === max.y ||
                        z === min.z || z === max.z;

                    if (isEdge) {
                        if (block.x === controller.x && block.y === controller.y && block.z === controller.z) continue
                        if (block?.hasTag(caseTag)) {
                            if (block?.hasTag('dorios:multiblock.port')) {
                                inputBlocks.push(`input:[${x},${y},${z}]`)
                            }
                            if (block?.hasTag("dorios:vent_block") && y === max.y) {
                                components['vent'] = (components['vent'] ?? 0) + 1;
                                ventBlocks.push({ x, y, z })
                            }
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

        return { components, inputBlocks, ventBlocks };
    },

    /**
     * Fills every AIR block inside the multiblock bounds using a layer-by-layer `/fill` from bottom → top.
     *
     * @async
     * @function fillEmptyBlocks
     * @memberof Multiblock
     *
     * @param {{ min: Vector3, max: Vector3 }} bounds Bounding area to fill.
     * @param {Dimension} dim Dimension where fill commands are executed.
     * @param {string} [blockId="minecraft:water"] Block ID to place in empty cells.
     *
     * @returns {Promise<void>} Resolves when the fill operation is complete.
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
     * Replaces all instances of the specified block inside a multiblock's stored bounds with AIR, clearing the interior layer by layer from top → bottom.
     *
     * @async
     * @function emptyBlocks
     * @memberof Multiblock
     *
     * @param {Entity} entity Multiblock entity containing stored bounds data.
     * @param {string} [blockId="minecraft:water"] Block type to remove.
     *
     * @returns {Promise<void>} Resolves when clearing is complete.
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
     * Computes the geometric center of a bounding box.
     *
     * @function getCenter
     * @memberof Multiblock
     *
     * @param {Vector3} min Minimum corner of the bounding box.
     * @param {Vector3} max Maximum corner of the bounding box.
     *
     * @returns {Vector3} Center point of the bounding box.
     */
    getCenter(min, max) {
        return {
            x: (min.x + max.x) / 2,
            y: (min.y + max.y) / 2,
            z: (min.z + max.z) / 2
        };
    },

    /**
     * Deactivates a multiblock machine by removing active port tags, resetting
     * casing metadata, disabling visuals, and updating nearby pipe networks.
     * Called when a casing block is broken or the structure becomes invalid.
     *
     * @function deactivateMultiblock
     * @memberof Multiblock
     *
     * @param {Entity} entity Multiblock controller entity holding structure data.
     * @param {Player} [player] Player responsible for triggering the deactivation.
     *
     * @returns {void}
     */
    deactivateMultiblock(entity, player) {
        if (player) player.sendMessage("§c[Scan] Multiblock structure deactivated.");
        if (!entity) return
        entity?.triggerEvent('utilitycraft:hide')
        entity.getTags().forEach(tag => {
            if (tag.startsWith('input:')) {
                const [x, y, z] = tag.slice(7, -1).split(",").map(Number);
                const inputBlock = entity.dimension.getBlock({ x, y, z })
                if (inputBlock?.hasTag('dorios:multiblock.port')) {
                    entity.removeTag(tag)
                    if (inputBlock.hasTag('dorios:energy')) entity.runCommand(`scriptevent dorios:updatePipes energy|[${x},${y},${z}]`);
                    if (inputBlock.hasTag('dorios:fluid')) entity.runCommand(`scriptevent dorios:updatePipes fluid|[${x},${y},${z}]`);
                    if (inputBlock.hasTag('dorios:item')) entity.runCommand(`scriptevent dorios:updatePipes item|[${x},${y},${z}]`);
                    inputBlock.setPermutation(inputBlock.permutation.withState('utilitycraft:active', 0));
                }
            }
        })
        entity.setDynamicProperty('dorios:rateSpeed', 0)
        entity.setDynamicProperty('dorios:bounds', undefined)
        entity.setDynamicProperty('dorios:state', 'off')
    },

    /**
     * Activates a validated multiblock structure by:
     * - enabling its detected input ports,
     * - applying controller tags,
     * - updating port visual state,
     * - storing structural bounds and vent data,
     * - calculating and applying energy capacity.
     *
     * This version stores only bounding corners (bounds) instead of all case blocks.
     * Energy capacity is computed internally using the detected multiblock components.
     *
     * @function activateMultiblock
     * @memberof Multiblock
     *
     * @param {Entity} entity The multiblock controller entity to activate.
     * @param {{inputBlocks: string[], bounds: Object, ventBlocks?: Object[], components?: Object.<string,number>}} structure
     * Structure data returned by detectFromController().
     *
     * @returns {number} The total calculated energy capacity.
     */
    activateMultiblock(entity, structure) {
        const { inputBlocks, bounds, ventBlocks, components } = structure;

        // Show the controller entity
        entity.triggerEvent('utilitycraft:show');

        // Enable all input ports
        for (const tag of inputBlocks) {
            entity.addTag(tag);

            const [x, y, z] = tag.slice(7, -1).split(",").map(Number);
            const block = entity.dimension.getBlock({ x, y, z });

            if (block?.hasTag('dorios:multiblock.port')) {
                block.setPermutation(
                    block.permutation.withState('utilitycraft:active', 1)
                );
                if (block.hasTag('dorios:energy')) entity.runCommand(`scriptevent dorios:updatePipes energy|[${x},${y},${z}]`);
                if (block.hasTag('dorios:fluid')) entity.runCommand(`scriptevent dorios:updatePipes fluid|[${x},${y},${z}]`);
                if (block.hasTag('dorios:item')) entity.runCommand(`scriptevent dorios:updatePipes item|[${x},${y},${z}]`);
            }
        }

        // Store only bounding corners
        if (bounds) {
            entity.setDynamicProperty("dorios:bounds", JSON.stringify(bounds));
        }

        // Store vent blocks if present
        if (ventBlocks) {
            entity.setDynamicProperty("ventBlocks", JSON.stringify(ventBlocks));
        }

        // Compute energy capacity internally
        const energyCap = Multiblock.calculateEnergyCapacity(components ?? {});
        if (energyCap > 0) {
            Energy.setCap(entity, energyCap);
            entity.setDynamicProperty("dorios:energyCap", energyCap);
        }

        entity.setDynamicProperty('dorios:state', 'on')
        // Return the computed energy capacity
        return energyCap;
    },

    /**
     * Calculates the total stored energy capacity of a multiblock structure
     * based on the count of its registered energy-bearing components.
     *
     * @function calculateEnergyCapacity
     * @memberof Multiblock
     *
     * @param {Object.<string, number>} components Map of component IDs to their counts.
     *
     * @returns {number} Total computed energy capacity.
     */
    calculateEnergyCapacity(components) {
        let total = 0;

        for (const [id, count] of Object.entries(components)) {
            const amount = ENERGY_PER_UNIT[id]
            if (!amount) continue
            total += count * amount;
        }

        return total;
    },

    /**
     * Computes the total block volume of a multiblock structure from its bounds.
     *
     * @function getVolume
     * @memberof Multiblock
     *
     * @param {{min: Vector3, max: Vector3}} bounds Bounding box of the structure.
     *
     * @returns {number} Total block volume inside the bounding box.
     */
    getVolume(bounds) {
        return (bounds.max.x - bounds.min.x + 1) * (bounds.max.y - bounds.min.y + 1) * (bounds.max.z - bounds.min.z + 1);
    },

    /**
     * Updates the main machine information label (slot 1).
     *
     * This label displays:
     * - Core machine statistics (processing, speed, efficiency effects)
     * - Current machine status
     *
     * The function also returns the required line offset so that
     * secondary labels can be aligned directly below this one.
     *
     * @param {Machine} controller Machine instance controlling the block entity.
     * @param {MachineStats} data Fully computed machine statistics.
     * @param {string} [status='§aRunning'] Current machine status text (formatted).
     *
     * @returns {string} Line offset string (`'\n'.repeat(n)`) used to align subsequent labels.
     */
    setMachineInfoLabel(controller, data, status = '§aRunning') {
        const infoText = `§r§7Status: ${status}

§r§eMachine Information

§r§aInput Capacity §fx${data.processing.amount}
§r§aCost §f${data.cost ? Energy.formatEnergyToText(data.cost * data.processing.amount) : "---"}
§r§aSpeed §fx${data.speed.multiplier.toFixed(2)}
§r§aEfficiency §f${((data.processing.amount / data.energyMultiplier) * 100).toFixed(2)}%%
`;

        controller.setLabel(infoText, 1);

        const offsetLines = '\n'.repeat(infoText.split('\n').length - 1);
        return offsetLines;
    },

    /**
     * Computes all effective machine statistics from installed components.
     *
     * This function centralizes machine balance logic:
     * - Processing increases batch size but heavily penalizes energy cost.
     * - Speed increases processing rate with diminishing returns and adds energy pressure.
     * - Efficiency reduces total energy cost with diminishing returns.
     *
     * All calculations are deterministic and scale safely to very large component values.
     *
     * @param {MachineComponents} components Installed machine components.
     * @returns {MachineStats} Fully computed machine statistics.
     */
    computeMachineStats(components) {
        const processing = Math.max(1, components.processing_module | 0);
        const speed = Math.max(0, components.speed_module | 0);
        const efficiency = Math.max(0, components.efficiency_module | 0);

        // =========================
        // Processing
        // =========================
        const processAmount = 2 * processing;

        // Penalización fuerte por processing
        const processingPenalty = 1 + 2.25 * (processing - 1);

        // =========================
        // Speed (curva con diminishing returns)
        // =========================
        const MAX_SPEED_BONUS = 999;     // hasta +10x rate
        const SPEED_K = 3200;

        const speedMultiplier =
            1 + (MAX_SPEED_BONUS * speed) / (SPEED_K + speed);

        // Penalización por speed (más agresiva)
        const MAX_SPEED_PENALTY = 99;   // hasta +4x costo
        const SPEED_PENALTY_K = 640;

        const speedPenalty =
            1 + (MAX_SPEED_PENALTY * speed) / (SPEED_PENALTY_K + speed);

        // =========================
        // Efficiency (reduce el costo final)
        // =========================
        const MIN_EFFICIENCY = 0.01;  // límite inferior
        const EFFICIENCY_RATE = 0.15;

        const efficiencyMultiplier =
            MIN_EFFICIENCY +
            (1 - MIN_EFFICIENCY) *
            Math.exp(-EFFICIENCY_RATE * efficiency);


        // =========================
        // Resultado final
        // =========================
        return {
            raw: {
                processing,
                speed,
                efficiency
            },

            processing: {
                amount: Math.floor(processAmount),
                penalty: processingPenalty
            },

            speed: {
                multiplier: speedMultiplier,
                penalty: speedPenalty
            },

            efficiency: {
                multiplier: efficiencyMultiplier
            },

            // Multiplicador energético TOTAL (antes de baseCost)
            energyMultiplier:
                processingPenalty *
                speedPenalty *
                efficiencyMultiplier
        };
    }


}

function isInsideBounds(pos, bounds) {
    return (
        pos.x >= bounds.min.x && pos.x <= bounds.max.x &&
        pos.y >= bounds.min.y && pos.y <= bounds.max.y &&
        pos.z >= bounds.min.z && pos.z <= bounds.max.z
    );
}



/**
 * Handles the breaking of a multiblock casing block. When a casing block belonging
 * to a formed multiblock is destroyed, the function locates the corresponding
 * controller entity, deactivates the structure, and clears its internal contents.
 *
 * @listens world.afterEvents.playerBreakBlock
 *
 * @param {PlayerBreakBlockEvent} e Event containing block, player, and permutation data.
 *
 * @returns {void}
 */
world.afterEvents.playerBreakBlock.subscribe(e => {
    const { brokenBlockPermutation, block, player } = e;
    const { x, y, z } = block.location;

    const tags = brokenBlockPermutation.getTags();
    const isCase = tags.some(t => t.startsWith("dorios:multiblock.case"));
    if (!isCase) return;

    const entity = block.dimension.getEntities({
        location: block.location,
        maxDistance: MAX_SIZE,
        families: ['dorios:multiblock']
    }).find(ent => {
        const raw = ent.getDynamicProperty("dorios:bounds");
        if (!raw) return false;

        try {
            const bounds = JSON.parse(raw);
            return isInsideBounds(block.location, bounds);
        } catch {
            return false;
        }
    });


    if (!entity) return;

    Multiblock.deactivateMultiblock(entity, player);
    Multiblock.emptyBlocks(entity, 'minecraft:water');
});

world.afterEvents.blockExplode.subscribe(e => {
    const { explodedBlockPermutation, block } = e
    const { x, y, z } = block.location;

    const tags = explodedBlockPermutation.getTags();
    const isCase = tags.some(t => t.startsWith("dorios:multiblock.case"));
    if (!isCase) return;

    const entity = block.dimension.getEntities({
        location: block.location,
        maxDistance: MAX_SIZE,
        families: ['dorios:multiblock']
    }).find(ent => {
        const raw = ent.getDynamicProperty("dorios:bounds");
        if (!raw) return false;

        try {
            const bounds = JSON.parse(raw);
            return isInsideBounds(block.location, bounds);
        } catch {
            return false;
        }
    });


    if (!entity) return;

    Multiblock.deactivateMultiblock(entity);
    Multiblock.emptyBlocks(entity, 'minecraft:water');
})


/**
 * Raw machine components coming from multiblock / entity data.
 *
 * @typedef {Object} MachineComponents
 * @property {number} processing_module Amount of processing modules installed.
 * @property {number} speed_module Amount of speed modules installed.
 * @property {number} efficiency_module Amount of efficiency modules installed.
 */

/**
 * Processing-related computed stats.
 *
 * @typedef {Object} ProcessingStats
 * @property {number} amount Items processed per batch.
 * @property {number} penalty Energy multiplier caused by processing pressure.
 */

/**
 * Speed-related computed stats.
 *
 * @typedef {Object} SpeedStats
 * @property {number} multiplier Speed multiplier applied to machine rate.
 * @property {number} penalty Energy multiplier caused by speed pressure.
 */

/**
 * Efficiency-related computed stats.
 *
 * @typedef {Object} EfficiencyStats
 * @property {number} multiplier Energy reduction multiplier (0–1 range).
 */

/**
 * Full computed statistics for a machine.
 *
 * @typedef {Object} MachineStats
 * @property {{processing:number, speed:number, efficiency:number}} raw Raw component values.
 * @property {ProcessingStats} processing Processing stats.
 * @property {SpeedStats} speed Speed stats.
 * @property {EfficiencyStats} efficiency Efficiency stats.
 * @property {number} energyMultiplier Final energy multiplier to apply over base cost.
 */
