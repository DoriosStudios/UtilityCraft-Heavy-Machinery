// import * as doriosAPI from '../../doriosAPI.js'
// import { MultiblockStructure } from '../multiblock_creator.js'
// import { system } from '@minecraft/server'



// doriosAPI.register.OldBlockComponent('dorios:crusher_controller', {
//     beforeOnPlayerPlace(e) {
//         Machine.spawnMachineEntity(e, settings.crusher);
//     },
//     onTick(e) {
//         if (e.block?.typeId == 'minecraft:air') return;
//         const machine = new Machine(e.block, settings.crusher)
//         if (!machine.entity || !machine.inv) return
//         machine.runProccessSingleMachine()
//     },
//     onPlayerDestroy(e) {
//         Machine.onDestroy(e)
//     },
//     onPlayerInteract(e) {
//         const machine = MultiblockStructure.detectMultiblockFromController(e)
//         if (!machine) return
//         doriosAPI.utils.printJSON(e.player, 'Multiblock Crusher', machine)
//     }
// })