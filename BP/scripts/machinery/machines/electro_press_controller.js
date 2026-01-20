import { Multiblock, Energy, Machine } from '../DoriosMachinery/main.js'
import { pressRecipes } from 'config/recipes/press.js'

const INPUT_SLOTS = [4, 5, 6, 7, 8, 9, 10, 11, 12]
const OUTPUT_SLOTS = [13, 14, 15, 16, 17, 18, 19, 20, 21]
const DEFAULT_COST = 800
const MULTI_PENALTY = 4
const BASE_RATE = 100

// slots energy, label, label, progress, 9 input 9 output
DoriosAPI.register.blockComponent('electro_press_controller', {
    async onPlayerInteract(e, { params: settings }) {
        const { block, player } = e
        let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

        if (!player.getEquipment('Mainhand')?.typeId.includes('wrench')) {
            return
        }

        if (!entity) {
            entity = Machine.spawn(block, settings, block.permutation)
            entity.setItem(1, 'utilitycraft:arrow_right_0', 1, " ")
            entity.setItem(2, 'utilitycraft:arrow_right_0', 1, " ")
            entity.setItem(3, 'utilitycraft:arrow_right_0', 1, "")
            Energy.initialize(entity)
        }
        Multiblock.deactivateMultiblock(player, entity)

        const structure = await Multiblock.detectFromController(e, settings.required_case)
        if (!structure) return

        const energyCap = Multiblock.activateMultiblock(entity, structure)
        if (energyCap <= 0) {
            player.sendMessage("§c[Controller] At least 1 energy container its required to operate.");
            Multiblock.deactivateMultiblock(player, entity)
            return
        }

        const processing = structure.components["processing_module"] ?? 0
        if (processing == 0) {
            player.sendMessage("§c[Controller] At least 1 processing module its required to operate.");
            Multiblock.deactivateMultiblock(player, entity)
            return
        }

        const factoryData = computeMachineStats(structure.components)
        entity.setDynamicProperty('components', JSON.stringify(factoryData))

        player.sendMessage("§a[Controller] Electro Press Factory created successfully.");
        player.sendMessage(`§7[Controller] Energy Capacity: §b${Energy.formatEnergyToText(energyCap)}`);
    },
    onPlayerBreak({ block, player }) {
        const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
        if (!entity) return
        Multiblock.deactivateMultiblock(player, entity)
        entity.remove()
    },
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;

        const controller = new Machine(e.block, settings);
        if (!controller.valid) return;

        const state = controller.entity.getDynamicProperty('dorios:state');
        if (!state || state === 'off') return;

        const raw = controller.entity.getDynamicProperty('components');
        /** @type {MachineStats} */
        const data = raw ? JSON.parse(raw) : {};

        controller.setRate(BASE_RATE * data.speed.multiplier);

        const inv = controller.inv;
        const recipes = pressRecipes;

        let recipe = null;
        let inputType = null;
        let totalInput = 0;

        for (const slot of INPUT_SLOTS) {
            const item = inv.getItem(slot);
            if (!item) continue;

            const r = recipes[item.typeId];
            if (!r) continue;

            if (!recipe) {
                recipe = r;
                inputType = item.typeId;
            }

            // Solo sumar stacks del mismo item
            if (item.typeId === inputType) {
                totalInput += item.amount;
            }
        }

        if (!recipe) {
            updateUI(controller, data, '§eNo Input');
            controller.setProgress(0, 3);
            return;
        }

        let availableSpace = 0;
        for (const slot of OUTPUT_SLOTS) {
            const out = inv.getItem(slot);
            if (!out) {
                availableSpace += 64;
            } else if (out.typeId === recipe.output) {
                availableSpace += out.maxAmount - out.amount;
            }
        }

        const required = recipe.required ?? 1;
        const recipeAmount = recipe.amount ?? 1;

        const maxProcess = Math.min(
            data.processing.amount,
            Math.floor(totalInput / required),
            Math.floor(availableSpace / recipeAmount)
        );

        if (maxProcess <= 0) {
            updateUI(controller, data, '§eOutput Full', recipe);
            controller.setProgress(0, 3);
            return;
        }

        const cost = (recipe.cost ?? DEFAULT_COST) * MULTI_PENALTY;
        data.cost = cost;
        controller.setEnergyCost(cost);

        const progress = controller.getProgress();

        if (controller.energy.get() <= 0) {
            updateUI(controller, data, '§eNo Energy', recipe);
            controller.displayProgress(3);
            return;
        }

        if (progress >= cost) {
            const craftCount = maxProcess;

            if (craftCount > 0) {
                // OUTPUT
                distributeOutput(
                    controller,
                    recipe.output,
                    craftCount * recipeAmount
                );

                // INPUT (GLOBAL REMOVAL)
                controller.entity.removeItem(
                    inputType,
                    craftCount * required
                );

                controller.addProgress(-cost);
            }
        } else {
            const energyToConsume = Math.min(
                controller.energy.get(),
                controller.rate,
                cost * data.energyMultiplier
            );

            controller.energy.consume(energyToConsume);
            controller.addProgress(
                energyToConsume / data.energyMultiplier
            );
        }

        controller.displayProgress(3);
        updateUI(controller, data, '§aRunning', recipe);
    }
})

function distributeOutput(controller, itemId, amount) {
    let remaining = amount;
    const entity = controller.entity
    for (const slot of OUTPUT_SLOTS) {
        if (remaining <= 0) break;

        const out = controller.inv.getItem(slot);

        if (!out) {
            const add = Math.min(64, remaining);
            entity.setItem(slot, itemId, add);
            remaining -= add;
        } else if (out.typeId === itemId && out.amount < out.maxAmount) {
            const add = Math.min(out.maxAmount - out.amount, remaining);
            entity.changeItemAmount(slot, add);
            remaining -= add;
        }
    }
}

function updateUI(controller, data, status = '§aRunning', recipe) {
    controller.displayEnergy()
    const offsetLines = setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

}
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
function setMachineInfoLabel(controller, data, status = '§aRunning') {
    const infoText = `§r§eMachine Information

§r§7Status: ${status}

§r§7Input Capacity §fx${data.processing.amount}
§r§7Cost §f${data.cost ? Energy.formatEnergyToText(data.cost * data.processing.amount) : "---"}
§r§7Speed §fx${data.speed.multiplier.toFixed(2)}
§r§7Efficiency §f${((data.processing.amount / data.energyMultiplier) * 100).toFixed(2)}%%
`;

    controller.setLabel(infoText, 1);

    const offsetLines = '\n'.repeat(infoText.split('\n').length - 1);
    return offsetLines;
}


function setEnergyAndRecipeLabel(controller, offsetLines, recipe) {
    const energy = controller.energy
    const rate = controller.baseRate

    const hasRecipe = !!recipe;

    const output = hasRecipe ? DoriosAPI.utils.formatIdToText(recipe.output) ?? "---" : "---";
    const yieldAmt = hasRecipe ? (recipe.amount ?? 1) : "---";
    const inputReq = hasRecipe ? (recipe.required ?? 1) : "---";

    const text = `${offsetLines}
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${Energy.formatEnergyToText(energy.get())} / ${Energy.formatEnergyToText(energy.cap)}
§r§bRate §f${Energy.formatEnergyToText(rate)}/t

§r§eRecipe Information

§r§7Output §f${output}
§r§7Yield §f${yieldAmt}
§r§7Input Required §f${inputReq}
`;

    controller.setLabel(text, 2);
}

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
function computeMachineStats(components) {
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
