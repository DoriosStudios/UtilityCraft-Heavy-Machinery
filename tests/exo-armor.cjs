const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const stripImports = s => s.replace(/^import[\s\S]*?from [^\n]+;\r?\n/gm, '');
const pure = read('BP/scripts/equipment/exoEnergy.js').replace(/export /g, '');
const api = vm.runInNewContext(pure + '\n({absorbExoDamage, exoVisualDamage})');
const ids = ['helmet', 'chestplate', 'leggings', 'boots'].map(x => 'utilitycraft:utility_exo_' + x);
const keys = ['Head', 'Chest', 'Legs', 'Feet'];
function harness() {
    let restricted = false, hurt, charge;
    const queued = [], props = new Map(), entities = new Map();
    let interval;
    const writable = () => assert.equal(restricted, false, 'no before-event item/world writes');
    class Item {
        constructor(typeId, energy, id = typeId) {
            this.typeId = typeId;
            this.props = new Map();
            if (energy !== undefined) {
                this.props.set('utilitycraft:exo_energy', energy);
                this.props.set('utilitycraft:exo_id', id);
            }
            this.durability = { damage: 0, maxDurability: 100000 };
            this.lore = ['Custom lore'];
        }
        getDynamicProperty(k) { return this.props.get(k); }
        setDynamicProperty(k, v) { writable(); this.props.set(k, v); }
        getComponent(k) { return k === 'minecraft:durability' ? this.durability : undefined; }
        getLore() { return [...this.lore]; }
        setLore(v) { writable(); this.lore = [...v]; }
        clone() { const x = new Item(this.typeId); x.props = new Map(this.props); x.durability = {...this.durability}; x.lore = [...this.lore]; return x; }
    }
    function container() {
        const items = new Map();
        return { size: 36, items, getItem: i => items.get(i)?.clone(), setItem(i, item) { writable(); items.set(i, item.clone()); } };
    }
    const inventory = container(), worn = new Map();
    const equipment = {
        getEquipment: slot => worn.get(slot)?.clone(),
        setEquipment(slot, item) { writable(); worn.set(slot, item.clone()); return true; }
    };
    const player = { typeId: 'minecraft:player', getComponent: k => k === 'minecraft:equippable' ? equipment : inventory && {container: inventory} };
    const world = {
        getAllPlayers: () => [player], getEntity: id => entities.get(id),
        getDynamicPropertyIds: () => [...props.keys()], getDynamicProperty: k => props.get(k),
        setDynamicProperty(k, v) { writable(); if (v === undefined) props.delete(k); else props.set(k, v); },
        beforeEvents: { entityHurt: { subscribe(fn) { hurt = fn; } } }
    };
    const system = { run(fn) { queued.push(fn); }, runInterval(fn) { interval = fn; },
        afterEvents: { scriptEventReceive: { subscribe(fn) { charge = fn; } } } };
    const ctx = { world, system, console, EnergyStorage: function(entity) { return entity.energy; } };
    vm.runInNewContext(pure + '\n' + stripImports(read('BP/scripts/equipment/exoArmor.js')), ctx);
    const flush = () => { while (queued.length) queued.shift()(); };
    return { Item, worn, inventory, props, entities, flush,
        scan: () => interval(),
        hit(damage, cause = 'entityAttack', cancel = false) {
            const event = { damage, cancel, hurtEntity: player, damageSource: { cause } };
            restricted = true; try { hurt(event); } finally { restricted = false; } return event;
        },
        charge(entityId, rate) { charge({id: 'utilitycraft:charge_equipment', message: JSON.stringify({entityId, rate})}); },
        machine(energy) {
            const inv = container();
            const e = { dimension: { getBlock: () => ({typeId:'utilitycraft:induction_anvil'}) }, location: {},
                getComponent: () => ({container: inv}),
                energy: { amount: energy, get() { return this.amount; }, consume(n) { this.amount -= n; } } };
            entities.set('anvil', e); return {e, inv};
        }
    };
}
const energy = item => item.getDynamicProperty('utilitycraft:exo_energy');
function fullSet(h) { keys.forEach((key, i) => h.worn.set(key, new h.Item(ids[i], 1e9))); h.flush(); }
test('four pieces absorb additive 90% of the event damage and pay only their shares', () => {
    const h = harness(); fullSet(h);
    const result = h.hit(20);
    assert.ok(Math.abs(result.damage - 2) < 1e-9);
    assert.equal(result.cancel, false);
    h.flush();
    for (const item of h.worn.values()) {
        assert.equal(energy(item), 995500000);
        assert.ok(item.durability.damage >= 1000 && item.durability.damage <= 99000);
        assert.equal(item.lore[0], 'Custom lore');
    }
});
test('energy reservations stop repeated same-tick hits spending the same charge', () => {
    const h = harness(); h.worn.set('Head', new h.Item(ids[0], 1e6)); h.flush();
    assert.equal(h.hit(20).damage, 19);
    assert.equal(h.hit(20).damage, 20);
    h.flush();
    assert.equal(energy(h.worn.get('Head')), 0);
    assert.equal(h.worn.get('Head').durability.damage, 99000);
});
test('boots cancel paid falls; insufficient boots use normal partial absorption', () => {
    const h = harness(); fullSet(h);
    assert.equal(h.hit(30, 'fall').cancel, true); h.flush();
    assert.equal(energy(h.worn.get('Feet')), 970e6);
    assert.equal(energy(h.worn.get('Chest')), 1e9);
    h.worn.set('Feet', new h.Item(ids[3], 1e6));
    const partial = h.hit(20, 'fall');
    assert.equal(partial.cancel, false);
    assert.equal(partial.damage, 5.5);
});
test('fresh armor is empty and native repairs cannot create energy', () => {
    const h = harness(); h.worn.set('Head', new h.Item(ids[0])); h.flush();
    assert.equal(energy(h.worn.get('Head')), 0);
    h.worn.get('Head').durability.damage = 0;
    h.scan();
    assert.equal(h.hit(20).damage, 20);
    assert.equal(h.worn.get('Head').durability.damage, 99000);
});
test('deferred damage follows the original item instead of overwriting a slot replacement', () => {
    const h = harness(); fullSet(h); h.hit(20);
    h.inventory.setItem(0, h.worn.get('Head'));
    h.worn.set('Head', new h.Item(ids[0], 1e9, 'replacement'));
    h.flush();
    assert.equal(energy(h.worn.get('Head')), 1e9);
    assert.equal(energy(h.inventory.getItem(0)), 995500000);
});
test('unavailable items retain their energy debt across runtime reloads', () => {
    const h = harness(); fullSet(h); h.hit(20);
    const dropped = h.worn.get('Head'); h.worn.delete('Head'); h.flush();
    assert.equal(h.props.size, 1);
    const restored = harness();
    for (const [key, value] of h.props) restored.props.set(key, value);
    restored.inventory.setItem(0, dropped); restored.flush();
    assert.equal(energy(restored.inventory.getItem(0)), 995500000);
    assert.equal(restored.props.size, 0);
});
test('anvil charging uses actual stored energy, respects rate and capacity and costs one DE per DE', () => {
    const h = harness(); h.flush(); const {e, inv} = h.machine(2e9);
    inv.setItem(3, new h.Item(ids[0]));
    h.charge('anvil', 64e6);
    assert.equal(energy(inv.getItem(3)), 64e6);
    assert.equal(e.energy.amount, 1936e6);
    h.charge('anvil', 2e9);
    assert.equal(energy(inv.getItem(3)), 1e9);
    assert.equal(inv.getItem(3).durability.damage, 1000);
    assert.equal(e.energy.amount, 1e9);
    h.charge('anvil', 2e9); assert.equal(e.energy.amount, 1e9);
});
test('huge hits exhaust charge without breaking items, and canceled hits do not cost energy', () => {
    const h = harness(); fullSet(h); h.hit(20, 'entityAttack', true); h.flush();
    assert.equal(energy(h.worn.get('Head')), 1e9);
    assert.equal(h.hit(100000).damage, 96000); h.flush();
    for (const item of h.worn.values()) assert.equal(item.durability.damage, 99000);
});
test('all definitions disable enchantments/native wear and retain the requested visual margins', () => {
    for (const name of ['helmet','chestplate','leggings','boots']) {
        const c = JSON.parse(read(`BP/items/equipment/utility_exo_${name}.json`))['minecraft:item'].components;
        assert.equal(c['minecraft:durability'].max_durability, 100000);
        assert.equal(c['minecraft:durability'].damage_chance.max, 0);
        assert.equal(c['minecraft:enchantable'], undefined);
        assert.equal(c['minecraft:damage_absorption'], undefined);
        assert.equal(c['minecraft:wearable'].protection, 0);
        assert.ok(c['minecraft:tags'].tags.includes('utilitycraft:energy_equipment'));
    }
    assert.equal(api.exoVisualDamage(0), 99000);
    assert.equal(api.exoVisualDamage(1e9), 1000);
    assert.equal(api.exoVisualDamage(5e8), 50000);
});
