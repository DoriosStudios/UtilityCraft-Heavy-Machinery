import * as doriosAPI from '../../doriosAPI.js'
import { MultiblockStructure } from '../multiblock_creator.js'
import { EnergyManager, Machinery, formatEnergyToText } from '../managers.js'
import { system, world } from '@minecraft/server'

const transferRate = 1e-3

system.beforeEvents.startup.subscribe(e => {
    e.blockComponentRegistry.registerCustomComponent('utilitycraft:power_condenser', {
        onTick({ block }) {
            const matrix = new Machinery(block, {
                nameTag: 'entity.utilitycraft:power_condenser.name'
            })
            if (!matrix.entity) return
            const trueRateSpeed = matrix.entity.getDynamicProperty('dorios:rateSpeed')
            const rateSpeed = trueRateSpeed * matrix.refreshSpeed
            if (rateSpeed <= 0) return
            Machinery.tick(() => {
                matrix.energy.transferToNetwork(rateSpeed)
                matrix.displayEnergy()
                const item = matrix.inv.getItem(0)
                const transfering = matrix.entity.getDynamicProperty('transfering') ?? 0
                item.setLore([])
                item.nameTag = `
§r§7Capacity: ${formatEnergyToText(matrix.energy.cap)}
§r§7Stored: ${formatEnergyToText(matrix.energy.value)}
§r§7Percentage: ${100 * (matrix.energy.value / matrix.energy.cap).toFixed(2)}%%
§r§7Transfering: ${formatEnergyToText(transfering)}/t
  `;
                matrix.inv.setItem(3, item)
            })
        },
        onPlayerBreak({ block, player }) {
            const entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]
            if (!entity) return
            MultiblockStructure.deactivateMultiblock(player, entity)
            entity.remove()
        },
        async onPlayerInteract(e) {
            const { block, player } = e
            if (doriosAPI.entities.getEquipment(player, 'Mainhand')?.typeId != 'twm:wrench') return

            let entity = block.dimension.getEntitiesAtBlockLocation(block.location)[0]

            let { x, y, z } = block.location;
            if (!entity) {
                y += 0.25; x += 0.5; z += 0.5;
                entity = block.dimension.spawnEntity('utilitycraft:power_condenser', { x, y, z })
                entity.nameTag = 'entity.utilitycraft:power_condenser.name'
                entity.runCommand(`scoreboard players set @s energy ${0}`)
            }
            MultiblockStructure.deactivateMultiblock(player, entity)

            const structure = await MultiblockStructure.detectFromController(e, "dorios:multiblock_case")
            if (!structure) return


            const energyCap = MultiblockStructure.calculateEnergyCapacity(structure.components)
            if (energyCap <= 0) {
                player.sendMessage("§c[Matrix] At least 1 energy container its required to operate.");
                return
            }
            MultiblockStructure.activateMultiblock(entity, structure.inputBlocks)
            EnergyManager.setCap(entity, energyCap)
            entity.setDynamicProperty('dorios:caseBlocks', JSON.stringify(structure.caseBlocks))
            entity.setDynamicProperty('dorios:rateSpeed', energyCap * transferRate)

            player.sendMessage("§a[Matrix] Power Condenser Matrix created successfully.");
            player.sendMessage(`§7[Matrix] Energy Capacity: §b${formatEnergyToText(energyCap)}`);
            player.sendMessage(`§7[Matrix] Transfer Rate: §b${formatEnergyToText(energyCap * transferRate)}/t`);
        }
    })
})
