import { EnergyStorage, Generator } from "DoriosCore/index.js"
import { Multiblock } from '../DoriosMachinery/multiblock.js'

DoriosAPI.register.blockComponent('power_condenser', {
    async onPlayerInteract(e, { params: settings }) {
        const { block, player } = e

        let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

        if (!player.getEquipment('Mainhand')?.typeId.includes('wrench')) {
            Generator.openGeneratorTransferModeMenu(entity, player)
            return
        }

        if (!entity) {
            Generator.spawnEntity(e, settings, (spawnedEntity) => {
                void activatePowerCondenser(e, settings, spawnedEntity)
            })
            return
        }

        await activatePowerCondenser(e, settings, entity)
    },
    onPlayerBreak({ block, player }) {
        Multiblock.handleBreakController(block, player)
    },
    onTick({ block }, { params: settings }) {
        const matrix = new Generator(block, settings)
        if (!matrix.valid) return

        const newRate = matrix.entity.getDynamicProperty("dorios:rateSpeed");
        matrix.setRate(newRate);

        if (matrix.rate <= 0) return
        const energy = matrix.energy
        const transfered = energy.transferToNetwork(matrix.rate) / tickSpeed

        matrix.setLabel(`        
§r§eEnergy Information

§r§bCapacity §f${Math.floor(energy.getPercent())}%%
§r§bStored §f${EnergyStorage.formatEnergyToText(energy.get())} / ${EnergyStorage.formatEnergyToText(energy.cap)}
§r§bTransfer Rate: §f${EnergyStorage.formatEnergyToText(matrix.baseRate ?? 0)}/t

§r§cTransferring §f${EnergyStorage.formatEnergyToText(transfered)}/t
`)
        matrix.displayEnergy()
    }
})

async function activatePowerCondenser(e, settings, entity) {
    const { block, player } = e

    Multiblock.deactivateMultiblock(block, player)

    const structure = await Multiblock.detectFromController(e, settings.required_case)
    if (!structure) return

    const energyCap = Multiblock.activateMultiblock(entity, structure)
    const transferRate = energyCap / settings.multiblock.transfer_rate_ratio
    if (energyCap <= 0) {
        player.sendMessage('§c[Matrix] At least 1 energy container its required to operate.')
        Multiblock.deactivateMultiblock(block, player)
        return
    }

    entity.setDynamicProperty('dorios:rateSpeed', transferRate)

    player.sendMessage('§a[Matrix] Power Condenser Matrix created successfully.')
    player.sendMessage(`§7[Matrix] Energy Capacity: §b${EnergyStorage.formatEnergyToText(energyCap)}`)
    player.sendMessage(`§7[Matrix] Transfer Rate: §b${EnergyStorage.formatEnergyToText(transferRate)}/t`)
}
