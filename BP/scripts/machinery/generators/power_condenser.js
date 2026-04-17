import { EnergyStorage, Multiblock, MultiblockGenerator } from "DoriosCore/index.js"

DoriosAPI.register.blockComponent('power_condenser', {
    onPlayerInteract(e, { params: settings }) {
        return MultiblockGenerator.handlePlayerInteract(e, settings, {
            onInteractWithoutWrench({ entity, player }) {
                MultiblockGenerator.openGeneratorTransferModeMenu(entity, player)
            },
            missingEnergyWarning: '\u00A7c[Matrix] At least 1 energy container its required to operate.',
            onActivate: ({ entity, energyCap, settings }) => {
                const transferRate = energyCap / settings.multiblock.transfer_rate_ratio
                entity.setDynamicProperty('dorios:rateSpeed', transferRate)
            },
            successMessages: ({ energyCap, settings }) => {
                const transferRate = energyCap / settings.multiblock.transfer_rate_ratio
                return [
                    '\u00A7a[Matrix] Power Condenser Matrix created successfully.',
                    `\u00A77[Matrix] Energy Capacity: \u00A7b${EnergyStorage.formatEnergyToText(energyCap)}`,
                    `\u00A77[Matrix] Transfer Rate: \u00A7b${EnergyStorage.formatEnergyToText(transferRate)}/t`,
                ]
            },
        })
    },
    onPlayerBreak({ block, player }) {
        Multiblock.DeactivationManager.handleBreakController(block, player)
    },
    onTick({ block }, { params: settings }) {
        const matrix = new MultiblockGenerator(block, settings)
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
