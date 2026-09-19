import { world, system } from '@minecraft/server';
import { ItemEnergyStorage } from '../DoriosCore/machinery/itemEnergyStorage.js';

const slots = ['Head', 'Chest', 'Legs', 'Feet'];
const reduction = [0.125, 0.40, 0.30, 0.125];
const tag = 'utilitycraft:exo_armor';
const energyPerDamage = 100_000;
// Only holds same-tick costs until the equipment can be written outside beforeEvents.
const pending = new Map();

world.beforeEvents.entityHurt.subscribe(event => {
    const player = event.hurtEntity;
    if (event.cancel || player.typeId !== 'minecraft:player' || event.damage <= 0) return;
    const equipment = player.getComponent('minecraft:equippable');
    if (!equipment) return;
    const previous = pending.get(player.id);
    const pieces = slots.map((slot, i) => {
        const item = equipment.getEquipment(slot);
        if (!item?.hasTag(tag)) return;
        const storage = new ItemEnergyStorage(item);
        if (!storage.isValid || storage.durability.damage === 0) return;
        const old = previous?.[i];
        return old && old.item.typeId === item.typeId && old.item.nameTag === item.nameTag
            && old.damage === storage.durability.damage ? old
            : { item, damage: storage.durability.damage, energy: storage.get(), spent: 0 };
    });
    const unit = ItemEnergyStorage.ENERGY_PER_POINT;
    const fallCost = Math.ceil(event.damage * energyPerDamage / unit) * unit;
    if (event.damageSource.cause === 'fall' && pieces[3]
        && pieces[3].energy - pieces[3].spent >= fallCost) {
        pieces[3].spent += fallCost;
        event.cancel = true;
        const dimension = player.dimension;
        const location = { ...player.location };
        system.run(() => {
            try { dimension.spawnParticle('utilitycraft:exo_fall_absorption', location); }
            catch { /* The landing chunk may have unloaded. */ }
        });
    } else {
        let absorbed = 0;
        pieces.forEach((piece, i) => {
            if (!piece) return;
            const cost = Math.ceil(event.damage * reduction[i] * energyPerDamage / unit) * unit;
            if (piece.energy - piece.spent < cost) return;
            piece.spent += cost;
            absorbed += reduction[i];
        });
        if (!absorbed) return;
        event.damage *= 1 - absorbed;
    }
    pending.set(player.id, pieces);
    if (previous) return;
    system.run(() => {
        const charged = pending.get(player.id);
        pending.delete(player.id);
        if (player.isValid === false) return;
        const current = player.getComponent('minecraft:equippable');
        charged.forEach((piece, i) => {
            if (!piece?.spent) return;
            const item = current?.getEquipment(slots[i]);
            if (item?.typeId !== piece.item.typeId || item.nameTag !== piece.item.nameTag) return;
            const storage = new ItemEnergyStorage(item);
            if (storage.durability?.damage !== piece.damage) return;
            storage.consume(piece.spent);
            storage.display();
            current.setEquipment(slots[i], item);
        });
    });
});
