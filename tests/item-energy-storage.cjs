const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const relative = 'BP/scripts/DoriosCore/machinery/itemEnergyStorage.js';
const source = fs.readFileSync(path.join(root, relative), 'utf8');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const formatter = read('BP/scripts/DoriosCore/machinery/energyStorage.js').match(/static formatEnergyToText\(value\) \{[\s\S]*?\n  \}/)[0];
const resourceLore = read('BP/scripts/DoriosCore/machinery/resourceLore.js').replace(/^import[^\n]*\n/gm, '').replace(/export /g, '') + '\n';
const {ItemEnergyStorage} = vm.runInNewContext('class EnergyStorage {' + formatter + '}\n' + resourceLore + source.replace(/^import[^\n]*\n/gm, '').replace(/export /g, '') + '\n({ItemEnergyStorage})');
function item(max = 10200, damage = 100, tagged = true) {
    const durability = {maxDurability: max, damage};
    return {durability, lore: ['Player lore'], hasTag: tag => tagged && tag === ItemEnergyStorage.TAG,
        getComponent: () => durability, getLore() {return [...this.lore];}, setLore(v) {this.lore = [...v];}};
}
test('capacity comes from arbitrary durability, with no per-item registration', () => {
    assert.equal(new ItemEnergyStorage(item()).getCap(), 1e9);
    const battery = new ItemEnergyStorage(item(1200));
    assert.equal(battery.getCap(), 100e6);
    assert.equal(battery.get(), 100e6);
    assert.equal(new ItemEnergyStorage(item(200)).isValid, false);
    assert.equal(new ItemEnergyStorage(item(1200, 100, false)).isValid, false);
});
test('charging and consumption keep actual energy and the two margins consistent', () => {
    const stack = item(); const s = new ItemEnergyStorage(stack); s.set(0);
    assert.equal(stack.durability.damage, 10100);
    assert.equal(s.add(99999), 0);
    assert.equal(s.add(150001), 100000);
    assert.equal(s.get(), 100000);
    assert.equal(s.consume(1), 100000);
    assert.equal(s.get(), 0);
    assert.equal(s.consume(1e9), 0);
    assert.equal(s.add(2e9), 1e9);
    assert.equal(stack.durability.damage, 100);
    assert.equal(s.consume(2e9), 1e9);
    assert.equal(stack.durability.damage, 10100);
});
test('invalid requests do not create energy and lore retains unrelated text', () => {
    const stack = item(); const s = new ItemEnergyStorage(stack); s.set(500000);
    for (const n of [NaN, Infinity, -1, 0]) {assert.equal(s.add(n), 0);assert.equal(s.consume(n), 0);}
    assert.equal(s.get(), 500000);
    assert.equal(s.display(), true); assert.equal(s.display(), false);
    assert.equal(stack.lore[0], 'Player lore'); assert.equal(stack.lore.length, 2);
    assert.equal(stack.lore[1], '\u00a7e\u00a7r\u00a77  Energy: 500.0 kDE/1.00 GDE');
    assert.ok(stack.lore[1].length <= 50);
    s.set(640e6); s.display();
    assert.equal(stack.lore[1], '\u00a7e\u00a7r\u00a77  Energy: 640.00 MDE/1.00 GDE');
    stack.durability.damage = 0; s.display(); assert.equal(stack.durability.damage, 100);
    stack.durability.damage = 10200; s.display(); assert.equal(stack.durability.damage, 10100);
});
test('UC and HM ship the identical public storage class', () => {
    assert.equal(fs.readFileSync(path.resolve(root, '../UtilityCraft', relative), 'utf8'), source);
});
