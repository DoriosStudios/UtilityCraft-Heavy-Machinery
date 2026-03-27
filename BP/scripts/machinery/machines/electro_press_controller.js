import { EnergyStorage } from "DoriosCore/index.js"
import { Multiblock } from '../DoriosMachinery/multiblock.js'
import { MultiblockMachine } from '../multiblockMachine.js'
import { pressRecipes } from 'config/recipes/press.js'

const INPUT_SLOTS = [4, 5, 6, 7, 8, 9, 10, 11, 12]
const OUTPUT_SLOTS = [13, 14, 15, 16, 17, 18, 19, 20, 21]
const DEFAULT_COST = 800
const MULTI_PENALTY = 4
const BASE_RATE = 100

DoriosAPI.register.blockComponent('electro_press_controller', {
    async onPlayerInteract(e, { params: settings }) {
        const { block, player } = e
        let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

        if (!player.getEquipment('Mainhand')?.typeId.includes('wrench')) {
            return
        }

        if (!entity) {
            MultiblockMachine.spawnEntity(e, settings, (spawnedEntity) => {
                initializeControllerEntity(spawnedEntity)
                void activateElectroPressController(e, settings, spawnedEntity)
            })
            return
        }

        await activateElectroPressController(e, settings, entity)
    },
    onPlayerBreak({ block, player }) {
        Multiblock.handleBreakController(block, player)
    },
    onTick(e, { params: settings }) {
        if (!worldLoaded) return;

        const controller = new MultiblockMachine(e.block, settings);
        if (!controller.valid) return;

        const state = controller.entity.getDynamicProperty('dorios:state');
        if (!state || state === 'off') return;

        const raw = controller.entity.getDynamicProperty('components');
        /** @type {MachineStats} */
        const data = raw ? JSON.parse(raw) : {};

        controller.setRate(BASE_RATE * data.speed.multiplier);

        const inv = controller.container;
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
                distributeOutput(
                    controller,
                    recipe.output,
                    craftCount * recipeAmount
                );

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

function initializeControllerEntity(entity) {
    entity.setItem(1, 'utilitycraft:arrow_right_0', 1, ' ')
    entity.setItem(2, 'utilitycraft:arrow_right_0', 1, ' ')
    entity.setItem(3, 'utilitycraft:arrow_right_0', 1, '')
}

async function activateElectroPressController(e, settings, entity) {
    const { block, player } = e

    Multiblock.deactivateMultiblock(block, player)

    const structure = await Multiblock.detectFromController(e, settings.required_case)
    if (!structure) return

    const energyCap = Multiblock.activateMultiblock(entity, structure)
    if (energyCap <= 0) {
        player.sendMessage('§c[Controller] At least 1 energy container its required to operate.')
        Multiblock.deactivateMultiblock(block, player)
        return
    }

    const processing = structure.components.processing_module ?? 0
    if (processing === 0) {
        player.sendMessage('§c[Controller] At least 1 processing module its required to operate.')
        Multiblock.deactivateMultiblock(block, player)
        return
    }

    const factoryData = MultiblockMachine.computeMachineStats(structure.components)
    entity.setDynamicProperty('components', JSON.stringify(factoryData))

    player.sendMessage('§a[Controller] Electro Press Factory created successfully.')
    player.sendMessage(`§7[Controller] Energy Capacity: §b${EnergyStorage.formatEnergyToText(energyCap)}`)
}

function distributeOutput(controller, itemId, amount) {
    let remaining = amount;
    const entity = controller.entity
    for (const slot of OUTPUT_SLOTS) {
        if (remaining <= 0) break;

        const out = controller.container.getItem(slot);

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
    const offsetLines = MultiblockMachine.setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

}

function setEnergyAndRecipeLabel(controller, offsetLines, recipe) {
    const energy = controller.energy
    const rate = controller.baseRate

    const hasRecipe = !!recipe;

    const output = hasRecipe ? DoriosAPI.utils.formatIdToText(recipe.output) ?? '---' : '---';
    const yieldAmt = hasRecipe ? (recipe.amount ?? 1) : '---';
    const inputReq = hasRecipe ? (recipe.required ?? 1) : '---';

    const text = `${offsetLines}
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}
§r§bRate §f${EnergyStorage.formatEnergyToText(rate)}/t

§r§eRecipe Information

§r§aOutput §f${output}
§r§aYield §f${yieldAmt}
§r§aInput Required §f${inputReq}
`;

    controller.setLabel(text, 2);
}
