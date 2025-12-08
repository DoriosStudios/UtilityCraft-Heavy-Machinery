import { Multiblock, Generator, Energy } from '../DoriosMachinery/main.js'

DoriosAPI.register.blockComponent('power_condenser', {
    async onPlayerInteract(e, { params: settings }) {
        const { block, player } = e
        if (!player.getEquipment('Mainhand')?.typeId.includes('wrench')) return

        let { x, y, z } = block.center(); y -= 0.25;
        let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

        if (!entity) {
            entity = block.dimension.spawnEntity('utilitycraft:power_condenser', { x, y, z })
            entity.nameTag = `entity.utilitycraft:${settings.entity.name}.name`
            Energy.initialize(entity)
        }
        Multiblock.deactivateMultiblock(player, entity)

        const structure = await Multiblock.detectFromController(e, settings.required_case)
        if (!structure) return

        const energyCap = Multiblock.calculateEnergyCapacity(structure.components)
        const transferRate = energyCap / settings.multiblock.transfer_rate_ratio
        if (energyCap <= 0) {
            player.sendMessage("§c[Matrix] At least 1 energy container its required to operate.");
            return
        }
        Multiblock.activateMultiblock(entity, structure.inputBlocks)
        Energy.setCap(entity, energyCap)

        entity.setDynamicProperty('dorios:caseBlocks', JSON.stringify(structure.caseBlocks))
        entity.setDynamicProperty('dorios:rateSpeed', transferRate)

        player.sendMessage("§a[Matrix] Power Condenser Matrix created successfully.");
        player.sendMessage(`§7[Matrix] Energy Capacity: §b${Energy.formatEnergyToText(energyCap)}`);
        player.sendMessage(`§7[Matrix] Transfer Rate: §b${Energy.formatEnergyToText(transferRate)}/t`);
    },
    onPlayerBreak({ block, player }) {
        const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
        if (!entity) return
        Multiblock.deactivateMultiblock(player, entity)
        entity.remove()
    },
    onTick({ block }, { params: settings }) {
        if (!worldLoaded) return;
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
§r§bStored §f${Energy.formatEnergyToText(energy.get())} / ${Energy.formatEnergyToText(energy.cap)}
§r§bTransfer Rate: §f${Energy.formatEnergyToText(matrix.baseRate)}/t

§r§cTransferring §f${Energy.formatEnergyToText(transfered)}/t
`)
        matrix.displayEnergy()
    }
})