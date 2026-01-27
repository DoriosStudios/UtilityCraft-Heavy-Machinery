import { Multiblock, Energy, Machine } from '../DoriosMachinery/main.js'
import { sieveRecipes } from 'config/recipes/sieve.js'

const MESH_SLOT = 4
const INPUT_SLOTS = [5, 6, 7, 8, 9, 10, 11, 12, 13]
const OUTPUT_SLOTS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]

const DEFAULT_COST = 6400
const MULTI_PENALTY = 4
const BASE_RATE = 800

DoriosAPI.register.blockComponent('autosieve_controller', {

    async onPlayerInteract(e, { params: settings }) {
        const { block, player } = e
        let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

        if (!player.getEquipment('Mainhand')?.typeId.includes('wrench')) return

        if (!entity) {
            entity = Machine.spawn(block, settings, block.permutation)
            entity.setItem(1, 'utilitycraft:arrow_right_0', 1, '')
            entity.setItem(2, 'utilitycraft:arrow_right_0', 1, '')
            Energy.initialize(entity)
        }

        Multiblock.deactivateMultiblock(player, entity)

        const structure = await Multiblock.detectFromController(e, settings.required_case)
        if (!structure) return

        const energyCap = Multiblock.activateMultiblock(entity, structure)
        if (energyCap <= 0) {
            player.sendMessage('§c[Controller] At least 1 energy container is required.')
            Multiblock.deactivateMultiblock(player, entity)
            return
        }

        const processing = structure.components.processing_module ?? 0
        if (processing <= 0) {
            player.sendMessage('§c[Controller] At least 1 processing module is required.')
            Multiblock.deactivateMultiblock(player, entity)
            return
        }

        const factoryData = Multiblock.computeMachineStats(structure.components)
        entity.setDynamicProperty('components', JSON.stringify(factoryData))

        player.sendMessage('§a[Controller] Autosieve Factory created successfully.')
        player.sendMessage(`§7Energy Capacity: §b${Energy.formatEnergyToText(energyCap)}`)
    },

    onPlayerBreak({ block, player }) {
        const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
        if (!entity) return
        Multiblock.deactivateMultiblock(player, entity)
        entity.remove()
    },

    onTick(e, { params: settings }) {
        if (!worldLoaded) return

        const controller = new Machine(e.block, settings)
        if (!controller.valid) return

        const state = controller.entity.getDynamicProperty('dorios:state')
        if (!state || state === 'off') return

        const raw = controller.entity.getDynamicProperty('components')
        const data = raw ? JSON.parse(raw) : {}

        controller.setRate(BASE_RATE * data.speed.multiplier)

        const inv = controller.inv

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
            // controller.entity.runCommand(`say ${slot} ${item?.typeId}`)
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
            distributeOutput(controller, loot.item, total)
        }
    })
}

function distributeOutput(controller, itemId, amount) {
    let remaining = amount
    const inv = controller.inv
    const entity = controller.entity

    for (const slot of OUTPUT_SLOTS) {
        if (remaining <= 0) break

        const out = inv.getItem(slot)
        try {
            if (!out) {
                const add = Math.min(64, remaining)
                entity.setItem(slot, itemId, add)
                remaining -= add
            } else if (out.typeId === itemId && out.amount < out.maxAmount) {
                const add = Math.min(out.maxAmount - out.amount, remaining)
                entity.changeItemAmount(slot, add)
                remaining -= add
            }
        } catch { }
    }
}

function updateUI(controller, data, status = '§aRunning', recipe) {
    controller.displayEnergy()
    const offsetLines = Multiblock.setMachineInfoLabel(controller, data, status);
    setEnergyAndRecipeLabel(controller, offsetLines, recipe);

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

§r§aOutput §f${output}
§r§aYield §f${yieldAmt}
§r§aInput Required §f${inputReq}
`;

    controller.setLabel(text, 2);
}