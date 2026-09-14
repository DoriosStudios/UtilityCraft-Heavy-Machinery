import * as DoriosLib from 'DoriosLib/index.js';
import { Machine, ItemEnergyStorage, registerIOInterface } from 'DoriosCore/index.js';

const INPUT_SLOT = 3;
export const REINFORCED_CHARGE_RATE = 1_000_000;

registerIOInterface('utilitycraft:reinforced_induction_anvil', {
    items: { anyInputSlots: [INPUT_SLOT], anyOutputSlots: [],
        modes: [{ id: 'default' }, { id: 'input_1', inputSlots: [INPUT_SLOT] }, { id: 'disabled' }] },
});

/** Return actual charged DE. Partial points remain in the machine buffer. */
export function chargeItem(container, source, budget) {
    const item = container.getItem(INPUT_SLOT);
    if (!item) return 0;
    const storage = new ItemEnergyStorage(item);
    if (!storage.isValid || storage.getFreeSpace() === 0) return 0;
    const accepted = storage.add(Math.min(source.get(), budget));
    if (accepted <= 0) return 0;
    storage.display();
    const used = source.consume(accepted);
    if (used !== accepted) {
        if (used > 0) source.add(used);
        return 0;
    }
    try { container.setItem(INPUT_SLOT, item); }
    catch (error) { source.add(accepted); throw error; }
    return accepted;
}

DoriosLib.registry.blockComponent('utilitycraft:reinforced_induction_anvil', {
    beforeOnPlayerPlace(event, { params: settings }) {
        Machine.spawnEntity(event, settings, () => {
            const machine = new Machine(event.block, { ...settings, ignoreTick: true });
            if (!machine.valid) return;
            machine.setEnergyCost(settings.machine.energy_cost);
            DoriosLib.entity.setNewItem(machine.entity, { slot: 2, typeId: 'utilitycraft:arrow_right_0', nameTag: ' ' });
        });
    },
    onTick({ block }, { params: settings }) {
        const machine = new Machine(block, settings);
        if (!machine.valid) return;
        const stack = machine.container.getItem(INPUT_SLOT);
        const idle = status => machine.showWarning(status, { displayProgress: false });
        if (!stack) return idle('No Item');

        if (stack.hasTag(ItemEnergyStorage.TAG)) {
            const storage = new ItemEnergyStorage(stack);
            if (!storage.isValid) return idle('Invalid Energy Container');
            if (storage.getFreeSpace() === 0) return idle('Fully Charged');
            const budget = REINFORCED_CHARGE_RATE * machine.processingInterval * machine.boosts.speed;
            const charged = chargeItem(machine.container, machine.energy, budget);
            if (charged <= 0) {
                return idle(`Needs ${ItemEnergyStorage.ENERGY_PER_POINT.toLocaleString('en-US')} DE`);
            }
            machine.on();
            machine.showStatus('Charging');
            return;
        }

        const durability = DoriosLib.item.durability.getInfo(stack);
        if (!durability) return idle('Invalid Item');
        const missing = durability.max - durability.remaining;
        if (missing <= 0) return idle('Fully Repaired');
        const cost = 10 * machine.boosts.consumption;
        const repair = Math.min(missing, Math.floor(Math.min(machine.energy.get(), machine.rate) / cost));
        if (repair <= 0) return idle('No Energy');
        const restored = DoriosLib.item.durability.repair(stack, repair);
        const used = machine.energy.consume(restored * cost);
        if (used !== restored * cost) {
            if (used > 0) machine.energy.add(used);
            return;
        }
        try { machine.container.setItem(INPUT_SLOT, stack); }
        catch (error) { machine.energy.add(used); throw error; }
        machine.on();
        machine.showStatus('Repairing');
    },
    onPlayerBreak(event) { Machine.onDestroy(event); },
});
