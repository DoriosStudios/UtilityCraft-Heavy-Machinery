const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const strip = text => text.replace(/^import[^\n]*\n/gm, '').replace(/export /g, '');
const formatter = read('BP/scripts/DoriosCore/machinery/energyStorage.js').match(/static formatEnergyToText\(value\) \{[\s\S]*?\n  \}/)[0];
const shared = 'class EnergyStorage {' + formatter + '}\n'
    + strip(read('BP/scripts/DoriosCore/machinery/resourceLore.js')) + '\n'
    + strip(read('BP/scripts/DoriosCore/machinery/itemEnergyStorage.js'));
const { ItemEnergyStorage } = vm.runInNewContext(shared + '\n({ItemEnergyStorage})');
const slots = ['Head', 'Chest', 'Legs', 'Feet'];
function item(energy = 1e9, tagged = true, max = 10200) {
    const result = { typeId: 'other_addon:exo_piece', nameTag: '', lore: [], durability: { damage: 100, maxDurability: max },
        hasTag: tag => tag === 'utilitycraft:energy_container' || (tagged && tag === 'utilitycraft:exo_armor'),
        getComponent() { return this.durability; }, getLore() { return this.lore; }, setLore(lore) { this.lore = lore; },
        clone() { const next = item(0, tagged, max); next.nameTag = this.nameTag; next.durability = { ...this.durability }; next.lore = [...this.lore]; return next; },
    };
    new ItemEnergyStorage(result).set(energy); return result;
}
function harness() {
    let hurt, before = false, writes = 0;
    const worn = new Map(), queue = [], particles = [];
    const equipment = { getEquipment: slot => worn.get(slot)?.clone(),
        setEquipment(slot, stack) { assert.equal(before, false); writes++; worn.set(slot, stack); return true; } };
    const player = { location: { x: 3, y: 64, z: -2 }, dimension: { spawnParticle(id, location) { assert.equal(before, false); particles.push({id, location}); } }, id: 'player', typeId: 'minecraft:player', isValid: true, getComponent: () => equipment };
    vm.runInNewContext(shared + '\n' + strip(read('BP/scripts/equipment/exoArmor.js')), {
        world: { beforeEvents: { entityHurt: { subscribe(fn) { hurt = fn; } } } },
        system: { run(fn) { queue.push(fn); } },
    });
    return { worn, particles, get writes() { return writes; },
        hit(damage, cause = 'entityAttack', cancel = false) {
            const event = { damage, cancel, damageSource: { cause }, hurtEntity: player };
            before = true; try { hurt(event); } finally { before = false; } return event;
        },
        flush() { while (queue.length) queue.shift()(); },
    };
}
const energy = stack => new ItemEnergyStorage(stack).get();
test('every combination adds per-slot absorption and charges each piece for its own share', () => {
    const shares = [0.125, 0.40, 0.30, 0.125];
    for (let mask = 0; mask < 16; mask++) {
        const h = harness(); let total = 0;
        slots.forEach((slot, i) => { if (mask & (1 << i)) { h.worn.set(slot, item()); total += shares[i]; } });
        assert.ok(Math.abs(h.hit(20).damage - 20 * (1 - total)) < 1e-9);
        h.flush(); slots.forEach((slot, i) => {
            if (mask & (1 << i)) assert.equal(energy(h.worn.get(slot)), 1e9 - Math.ceil(20 * shares[i]) * 100000);
        });
    }
});
test('empty, insufficiently charged and untagged pieces provide no scripted protection', () => {
    const h = harness(); h.worn.set('Head', item(0)); h.worn.set('Chest', item(100000)); h.worn.set('Legs', item(1e9, false));
    assert.equal(h.hit(20).damage, 20); h.flush(); assert.equal(h.writes, 0);
});
test('paid boots cancel all fall damage, and ordinary hits do not cancel', () => {
    const h = harness(); h.worn.set('Feet', item());
    assert.equal(h.hit(30, 'fall').cancel, true); h.flush();
    assert.equal(energy(h.worn.get('Feet')), 997e6);
    assert.equal(h.particles.length, 1);
    assert.equal(h.particles[0].id, 'utilitycraft:exo_fall_absorption');
    assert.equal(JSON.stringify(h.particles[0].location), JSON.stringify({x:3,y:64,z:-2}));
    assert.equal(h.hit(20).cancel, false);
    const noBoots = harness(); noBoots.worn.set('Head', item());
    assert.equal(noBoots.hit(20, 'fall').cancel, false); noBoots.flush();
    assert.equal(noBoots.particles.length, 0);
    h.flush(); assert.equal(h.particles.length, 1);
    const empty = harness(); empty.worn.set('Feet', item(0));
    empty.hit(30, 'fall'); empty.flush(); assert.equal(empty.particles.length, 0);
});
test('same-tick hits cannot spend charge twice, and arbitrary durability sets capacity', () => {
    const h = harness(); h.worn.set('Head', item(300000, true, 1200));
    assert.equal(new ItemEnergyStorage(h.worn.get('Head')).getCap(), 100e6);
    assert.equal(h.hit(20).damage, 17.5); assert.equal(h.hit(20).damage, 20);
    h.flush(); assert.equal(energy(h.worn.get('Head')), 0);
    assert.equal(h.worn.get('Head').durability.damage, 1100);
});
test('canceled damage does not cost energy and deferred writes do not overwrite replacements', () => {
    const h = harness(); h.worn.set('Head', item()); h.hit(20, 'entityAttack', true); h.flush(); assert.equal(h.writes, 0);
    h.hit(20); const replacement = item(); replacement.nameTag = 'replacement'; h.worn.set('Head', replacement);
    h.flush(); assert.equal(energy(h.worn.get('Head')), 1e9);
});
test('all four definitions opt in by tag, with valid durability and no enchantments', () => {
    for (const name of ['helmet', 'chestplate', 'leggings', 'boots']) {
        const c = JSON.parse(read(`BP/items/equipment/utility_exo_${name}.json`))['minecraft:item'].components;
        assert.ok(c['minecraft:tags'].tags.includes('utilitycraft:exo_armor'));
        assert.ok(c['minecraft:tags'].tags.includes('utilitycraft:energy_container'));
        assert.equal(new Int16Array([c['minecraft:durability'].max_durability])[0], c['minecraft:durability'].max_durability);
        assert.equal(c['minecraft:enchantable'], undefined); assert.equal(c['minecraft:wearable'].protection, {helmet:3,chestplate:8,leggings:6,boots:3}[name]);
    }
    assert.equal(fs.existsSync(path.join(root, 'BP/scripts/equipment/exoEnergy.js')), false);
});
