import { FluidStorage, GasStorage, Multiblock, MultiblockMachine, registerLinkNodeIO } from "DoriosCore/index.js";
import * as DoriosLib from "DoriosLib/index.js";

const TANK_COUNT = 5;
const CAPACITY_PER_CELL = 256_000;
const INDICES = [0, 1, 2, 3, 4];

for (const [kind, resource, Storage] of [
    ["liquid", "fluid", FluidStorage],
    ["gas", "gas", GasStorage],
]) {
    const identifier = `utilitycraft:${kind}_tank_controller`;
    const cell = `${resource}_cell`;
    const config = {
        required_case: "dorios:multiblock.case.steel",
        ignoreTick: true,
        entity: {
            identifier: "utilitycraft:multiblock_machine",
            type: `${kind}_storage`,
            inventory_size: TANK_COUNT,
        },
        machine: { energy_cap: 0 },
        requirements: {
            [cell]: { amount: 1, warning: `\u00a7c[Controller] At least 1 ${kind} cell is required.` },
        },
    };

    registerLinkNodeIO(identifier, {
        [kind === "liquid" ? "liquids" : "gases"]: {
            anyInputIndices: INDICES,
            anyOutputIndices: INDICES,
            inputs: INDICES.map(index => ({ id: `tank_${index + 1}`, label: `Tank ${index + 1}`, indices: [index] })),
            outputs: INDICES.map(index => ({ id: `tank_${index + 1}`, label: `Tank ${index + 1}`, indices: [index] })),
        },
    });

    DoriosLib.registry.blockComponent(identifier, {
        onPlayerInteract(e) {
            return MultiblockMachine.handlePlayerInteract(e, config, {
                initializeEntity(entity) {
                    Storage.initializeMultiple(entity, TANK_COUNT);
                },
                onActivate({ entity, structure, player }) {
                    const hasPort = structure.inputBlocks.some(tag => {
                        const location = DoriosLib.linkNode.parseLinkNodeTag(tag);
                        return location && entity.dimension.getBlock(location)?.hasTag(`dorios:${resource}`);
                    });
                    if (!hasPort) {
                        player.sendMessage(`\u00a7c[Controller] At least 1 ${kind} port is required.`);
                        return false;
                    }
                    const capacity = structure.components[cell] * CAPACITY_PER_CELL / TANK_COUNT;
                    for (const tank of Storage.initializeMultiple(entity, TANK_COUNT)) tank.setCap(capacity);
                },
                successMessages: [`\u00a7a[Controller] ${kind === "liquid" ? "Liquid" : "Gas"} Tank activated.`],
            });
        },
        onPlayerBreak({ block, brokenBlockPermutation, player }) {
            Multiblock.DeactivationManager.handleBreakController(block, player, undefined, brokenBlockPermutation);
        },
        onTick({ block }) {
            if (!worldLoaded) return;
            const controller = new MultiblockMachine(block, config);
            if (!controller.valid) return;
            Storage.initializeMultiple(controller.entity, TANK_COUNT).forEach((tank, index) => tank.display(index));
        },
    });
}
