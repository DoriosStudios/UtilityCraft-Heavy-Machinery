import { world, system } from '@minecraft/server';
import { EnergyStorage } from '../DoriosCore/index.js';
import {
    EXO_CAPACITY, EXO_ITEMS, EXO_ID_PROPERTY, EXO_ENERGY_PROPERTY,
    isExo, readExoEnergy, exoVisualDamage, writeExoEnergy, absorbExoDamage,
} from './exoEnergy.js';

const slots = Object.keys(EXO_ITEMS);
const debtPrefix = 'utilitycraft:exo_debt_';
// Reserve energy synchronously; equipment writes are forbidden inside beforeEvents.
const debts = new Map();
let ready = false;
let queued = false;
let sequence = 0;

function prepare(item) {
    let changed = false;
    if (!item.getDynamicProperty(EXO_ID_PROPERTY)) {
        item.setDynamicProperty(EXO_ID_PROPERTY, `${Date.now().toString(36)}_${(++sequence).toString(36)}_${Math.random().toString(36).slice(2)}`);
        changed = true;
    }
    const energy = readExoEnergy(item);
    const durability = item.getComponent('minecraft:durability');
    if (changed || item.getDynamicProperty(EXO_ENERGY_PROPERTY) === undefined || durability?.damage !== exoVisualDamage(energy)) {
        writeExoEnergy(item, energy);
        changed = true;
    }
    return changed;
}

function settle(item, save) {
    if (!isExo(item)) return;
    let changed = prepare(item);
    const id = item.getDynamicProperty(EXO_ID_PROPERTY);
    const debt = debts.get(id) ?? 0;
    if (debt > 0) {
        writeExoEnergy(item, Math.max(0, readExoEnergy(item) - debt));
        changed = true;
    }
    if (changed) save(item);
    // Only clear the reservation after the original item has actually been saved.
    if (debt > 0) {
        debts.delete(id);
        world.setDynamicProperty(debtPrefix + id, undefined);
    }
}

function scanPlayers() {
    for (const player of world.getAllPlayers()) {
        try {
            const equipment = player.getComponent('minecraft:equippable');
            if (equipment) for (const slot of slots) {
                settle(equipment.getEquipment(slot), item => {
                    if (!equipment.setEquipment(slot, item)) throw new Error('Equipment write failed');
                });
            }
            const inventory = player.getComponent('minecraft:inventory')?.container;
            if (inventory) for (let i = 0; i < inventory.size; i++) {
                settle(inventory.getItem(i), item => inventory.setItem(i, item));
            }
        } catch {
            // Unloaded players are retried when they return; never overwrite another item.
        }
    }
}

function flush() {
    queued = false;
    for (const [id, debt] of debts) world.setDynamicProperty(debtPrefix + id, debt);
    scanPlayers();
}

system.run(() => {
    for (const key of world.getDynamicPropertyIds()) {
        if (!key.startsWith(debtPrefix)) continue;
        const debt = world.getDynamicProperty(key);
        if (Number.isFinite(debt) && debt > 0) debts.set(key.slice(debtPrefix.length), debt);
    }
    ready = true;
    scanPlayers();
});
system.runInterval(() => { if (ready) scanPlayers(); }, 4);

world.beforeEvents.entityHurt.subscribe(event => {
    if (!ready || event.cancel || event.hurtEntity.typeId !== 'minecraft:player') return;
    const equipment = event.hurtEntity.getComponent('minecraft:equippable');
    if (!equipment) return;
    const items = slots.map(slot => equipment.getEquipment(slot));
    const energies = items.map((item, i) => {
        if (item?.typeId !== EXO_ITEMS[slots[i]]) return 0;
        const id = item.getDynamicProperty(EXO_ID_PROPERTY);
        return id ? Math.max(0, readExoEnergy(item) - (debts.get(id) ?? 0)) : 0;
    });
    const result = absorbExoDamage(event.damage, energies, event.damageSource.cause === 'fall');
    if (!result.spent.some(amount => amount > 0)) return;
    result.spent.forEach((amount, i) => {
        if (!amount) return;
        const id = items[i].getDynamicProperty(EXO_ID_PROPERTY);
        debts.set(id, (debts.get(id) ?? 0) + amount);
    });
    event.damage = result.damage;
    if (result.cancel) event.cancel = true;
    if (!queued) { queued = true; system.run(flush); }
});

// The owning pack reads/writes item properties; UC only supplies its anvil's charge budget.
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== 'utilitycraft:charge_equipment' || !ready) return;
    try {
        const request = JSON.parse(message);
        if (!Number.isFinite(request.rate) || request.rate <= 0) return;
        const entity = world.getEntity(request.entityId);
        if (!entity || entity.dimension.getBlock(entity.location)?.typeId !== 'utilitycraft:induction_anvil') return;
        const container = entity.getComponent('minecraft:inventory')?.container;
        const item = container?.getItem(3);
        if (!isExo(item)) return;
        settle(item, stack => container.setItem(3, stack));
        const stored = readExoEnergy(item);
        const energy = new EnergyStorage(entity);
        // One machine DE becomes one stored DE. Repair-efficiency upgrades cannot create charge.
        const amount = Math.min(EXO_CAPACITY - stored, request.rate, energy.get());
        if (amount <= 0) return;
        writeExoEnergy(item, stored + amount);
        container.setItem(3, item);
        energy.consume(amount);
    } catch (error) {
        console.warn(`[Heavy Machinery] Exo charging failed: ${error}`);
    }
});
