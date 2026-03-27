import { EnergyStorage, MultiblockManager, MultiblockMachine } from "DoriosCore/index.js"
import { sieveRecipes } from 'config/recipes/sieve.js'

const MESH_SLOT = 4
const INPUT_SLOTS = [5, 6, 7, 8, 9, 10, 11, 12, 13]
const OUTPUT_SLOTS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]

const DEFAULT_COST = 6400
const MULTI_PENALTY = 4
const BASE_RATE = 800
const CONTROLLER_REQUIREMENTS = {
    energy_cell: {
        amount: 1,
        warning: '§c[Controller] At least 1 energy container is required.',
    },
    processing_module: {
        amount: 1,
        warning: '§c[Controller] At least 1 processing module is required.',
    },
}

DoriosAPI.register.blockComponent('autosieve_controller', {

    async onPlayerInteract(e, { params: settings }) {
        const { block, player } = e
        let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

        if (!player.getEquipment('Mainhand')?.typeId.includes('wrench')) return

        if (!entity) {
            MultiblockMachine.spawnEntity(e, settings, (spawnedEntity) => {
                initializeControllerEntity(spawnedEntity)
                void activateAutosieveController(e, settings, spawnedEntity)
            })
            return
        }

        await activateAutosieveController(e, settings, entity)
    },

    onPlayerBreak({ block, player }) {
        MultiblockManager.handleBreakController(block, player)
    },

    onTick(e, { params: settings }) {
        if (!worldLoaded) return

        const controller = new MultiblockMachine(e.block, settings)
        if (!controller.valid) return

        const state = controller.entity.getDynamicProperty('dorios:state')
        if (!state || state === 'off') return

        const raw = controller.entity.getDynamicProperty('components')
        const data = raw ? JSON.parse(raw) : {}

        controller.setRate(BASE_RATE * data.speed.multiplier)

        const inv = controller.container

        const meshSlot = inv.getItem(MESH_SLOT)
        if (!meshSlot) {
            updateUI(controller, data, '§eNo Mesh')
            controller.setProgress(0, 3)
            return
        }

        const meshComp = meshSlot.getComponent('utilitycraft:mesh')
        if (!meshComp) {
            updateUI(controller, data, '§eInvalid Mesh')
            controller.setProgress(0, 3)
            return
        }

        const meshData = meshComp.customComponentParameters.params
        const meshCapacity = meshSlot.amount * 9

        const tier = meshData.tier
        const multi = meshData.multiplier
        const amountMultiplier = meshData.amount_multiplier

        let inputType = null
        let totalInput = 0

        for (const slot of INPUT_SLOTS) {
            const item = inv.getItem(slot)
            if (!item) continue

            if (!inputType) inputType = item.typeId
            if (item.typeId === inputType) {
                totalInput += item.amount
            }
        }

        if (!inputType || totalInput <= 0) {
            updateUI(controller, data, '§eNo Input')
            controller.setProgress(0, 3)
            return
        }

        const recipe = sieveRecipes[inputType]
        if (!recipe) {
            updateUI(controller, data, '§eInvalid Input')
            controller.setProgress(0, 3)
            return
        }

        const processCount = Math.min(
            data.processing.amount,
            meshCapacity,
            totalInput
        )

        if (processCount <= 0) {
            updateUI(controller, data, '§eCapacity Limit')
            controller.setProgress(0, 3)
            return
        }

        const cost = (recipe.cost ?? DEFAULT_COST) * MULTI_PENALTY
        data.cost = cost;
        controller.setEnergyCost(cost)

        const progress = controller.getProgress()

        if (controller.energy.get() <= 0) {
            updateUI(controller, data, '§eNo Energy')
            controller.displayProgress(3)
            return
        }

        if (progress >= cost) {
            processAutosieveDrops(
                controller,
                recipe,
                processCount,
                tier,
                multi,
                amountMultiplier
            )

            controller.entity.removeItem(inputType, processCount)
            controller.addProgress(-cost)
        } else {
            const energyToConsume = Math.min(
                controller.energy.get(),
                controller.rate,
                cost * data.energyMultiplier
            )

            controller.energy.consume(energyToConsume)
            controller.addProgress(
                energyToConsume / data.energyMultiplier
            )
        }

        controller.displayProgress(3)
        updateUI(controller, data, '§aRunning')
    }
})

function initializeControllerEntity(entity) {
    entity.setItem(1, 'utilitycraft:arrow_right_0', 1, '')
    entity.setItem(2, 'utilitycraft:arrow_right_0', 1, '')
}

async function activateAutosieveController(e, settings, entity) {
    await MultiblockMachine.activateMachineController(e, settings, entity, {
        requirements: CONTROLLER_REQUIREMENTS,
        successMessages: ({ energyCap }) => [
            '§a[Controller] Autosieve Factory created successfully.',
            `§7Energy Capacity: §b${EnergyStorage.formatEnergyToText(energyCap)}`,
        ],
    })
}

function processAutosieveDrops(
    controller,
    recipe,
    processCount,
    tier,
    multi,
    amountMultiplier
) {
    recipe.forEach(loot => {
        if (tier < (loot.tier ?? 0)) return
        if (loot.item === 'minecraft:flint' && tier >= 7) return

        if (Math.random() <= loot.chance * multi) {
            let qty = Array.isArray(loot.amount)
                ? DoriosAPI.math.randomInterval(loot.amount[0], loot.amount[1])
                : loot.amount

            if (amountMultiplier) qty *= amountMultiplier

            const total = processCount * Math.ceil(Math.random() * qty)
            MultiblockMachine.distributeOutput(controller, OUTPUT_SLOTS, loot.item, total, {
                suppressErrors: true,
            })
        }
    })
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
