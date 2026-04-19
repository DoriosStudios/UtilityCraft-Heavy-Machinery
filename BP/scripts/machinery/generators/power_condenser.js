import { EnergyStorage, Multiblock, MultiblockGenerator } from "DoriosCore/index.js"

const GENERATOR_CONFIG = {
    entity: {
        identifier: 'utilitycraft:power_condenser',
        name: 'power_condenser',
    },
    generator: {
        energy_cap: 1,
        rate_speed_base: 0,
    },
    multiblock: {
        transfer_rate_ratio: 1000,
    },
    required_case: 'dorios:multiblock.case.steel',
    missingEnergyWarning: '\u00A7c[Matrix] At least 1 energy container its required to operate.',
}

DoriosAPI.register.blockComponent('power_condenser', {
    onPlayerInteract(e) {
        return MultiblockGenerator.handlePlayerInteract(e, GENERATOR_CONFIG, {
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
        Multiblock.DeactivationManager.handleBreakController(block, player, GENERATOR_CONFIG.deactivateConfig)
    },
    onTick({ block }) {
        const matrix = new MultiblockGenerator(block, GENERATOR_CONFIG)
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
