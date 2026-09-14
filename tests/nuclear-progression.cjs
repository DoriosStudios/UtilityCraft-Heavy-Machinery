const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const recipes = vm.runInNewContext(read('BP/scripts/config/recipes/reactionChamber.js').replace('export const reactionRecipes', 'const reactionRecipes') + '\nreactionRecipes');
class ItemStack {
    constructor(typeId, amount = 1) { Object.assign(this, { typeId, amount, maxAmount: 64 }); }
    isStackableWith(other) { return this.typeId === other.typeId; }
}
function tank(type, amount, cap = 8000) {
    return { type, amount, cap, get() { return this.amount; }, getType() { return this.type; },
        setType(t) { this.type = t; }, getFreeSpace() { return this.cap - this.amount; },
        consume(n) { this.amount -= n; }, add(n) { this.amount += n; }, display() {} };
}
function chamber(item, amount, fluid, mb, energy) {
    const slots = new Map([[3, new ItemStack(item, amount)]]);
    const m = { valid: true, entity: {}, progress: 0, cost: 0, rate: Infinity,
        boosts: { consumption: 1 }, fluids: [tank(fluid, mb), tank('empty', 0)],
        container: { getItem: s => slots.get(s), setItem: (s, i) => slots.set(s, i) },
        energy: { amount: energy, get() { return this.amount; }, consume(n) { this.amount -= n; } },
        getProgress() { return this.progress; }, setProgress(n) { this.progress = n; },
        getEnergyCost() { return this.cost; }, setEnergyCost(n) { this.cost = n; },
        processIO() {}, displayProgress() {}, displayEnergy() {}, on() {},
        showWarning(s) { this.status = s; }, showStatus(s) { this.status = s; } };
    let handler;
    const context = { ItemStack, reactionRecipes: recipes, Machine: function () { return m; },
        FluidStorage: { initializeMultiple: () => m.fluids }, registerIOInterface() {},
        DoriosLib: { registry: { blockComponent(id, h) { handler = h; } }, entity: {
            changeItemAmount(entity, {slot, amount}) { slots.get(slot).amount += amount; }
        } } };
    vm.runInNewContext(read('BP/scripts/machinery/machines/reactionChamber.js').replace(/^import .*;\r?\n/gm, ''), context);
    m.tick = () => handler.onTick({ block: {} }, { params: { machine: { energy_cost: 1 } } });
    return m;
}
test('one bucket of essence produces exactly the matter needed by the Exo set', () => {
    const dissolve = chamber('minecraft:nether_star', 8, 'sulfuric_acid', 8000, 8 * 16000000);
    dissolve.tick();
    assert.equal(dissolve.fluids[1].getType(), 'nether_star_essence');
    assert.equal(dissolve.fluids[1].get(), 1000);
    assert.equal(dissolve.fluids[0].get(), 0);
    assert.equal(dissolve.container.getItem(3).amount, 0);
    assert.equal(dissolve.energy.get(), 0);
    const stabilize = chamber('utilitycraft:spent_uranium_pellet', 16, 'nether_star_essence', 1000, 8 * 128000000);
    stabilize.tick();
    assert.equal(stabilize.container.getItem(5).typeId, 'utilitycraft:stabilized_nuclear_matter');
    assert.equal(stabilize.container.getItem(5).amount, 8);
    assert.equal(stabilize.fluids[0].get(), 0);
    assert.equal(stabilize.container.getItem(3).amount, 0);
    assert.equal(stabilize.energy.get(), 0);
    let needed = 0;
    const crafter = read('BP/scripts/config/recipes/crafter.js');
    for (const piece of ['helmet', 'chestplate', 'leggings', 'boots']) {
        const r = json(`BP/recipes/equipment/utility_exo_${piece}.json`)['minecraft:recipe_shaped'];
        const slots = [...r.pattern.join('')].map(c => c === ' ' ? 'air' : r.key[c].item.split(':')[1]);
        needed += slots.filter(s => s === 'stabilized_nuclear_matter').length;
        assert.ok(crafter.includes(`"${slots.join(',')}": { output: "${r.result.item}", amount: 1 }`));
    }
    assert.equal(needed, 8);
});
test('short inputs and blocked outputs cannot consume a star or energy', () => {
    for (const setup of [m => m.fluids[0].amount = 999, m => m.fluids[1].cap = 124,
        m => { m.fluids[1].type = 'water'; m.fluids[1].amount = 1; }]) {
        const m = chamber('minecraft:nether_star', 1, 'sulfuric_acid', 1000, 16000000);
        setup(m); m.tick();
        assert.equal(m.container.getItem(3).amount, 1);
        assert.equal(m.energy.get(), 16000000);
    }
    const m = chamber('utilitycraft:spent_uranium_pellet', 2, 'nether_star_essence', 124, 128000000);
    m.tick(); assert.equal(m.container.getItem(5), undefined); assert.equal(m.energy.get(), 128000000);
});
test('incomplete energy preserves ingredients until the reaction completes', () => {
    const m = chamber('minecraft:nether_star', 1, 'sulfuric_acid', 1000, 8000000);
    m.tick();
    assert.equal(m.container.getItem(3).amount, 1);
    assert.equal(m.fluids[1].amount, 0);
    m.energy.amount = 8000000; m.tick();
    assert.equal(m.container.getItem(3).amount, 0);
    assert.equal(m.fluids[1].amount, 125);
});
test('essence has all bar frames, a tank entity and reversible bucket registration', () => {
    const atlas = json('RP/textures/item_texture.json').texture_data;
    for (let i = 0; i <= 48; i++) {
        const frame = String(i).padStart(2, '0');
        const item = json(`BP/items/UI/nether_star_essence/utilitycraft_nether_star_essence_${frame}.json`)['minecraft:item'];
        assert.equal(item.description.identifier, `utilitycraft:nether_star_essence_${frame}`);
        const texture = atlas[item.components['minecraft:icon']].textures;
        assert.ok(fs.existsSync(path.join(root, '../UtilityCraft/RP', texture + '.png')));
    }
    for (const [pack, folder, key] of [['BP','entities','minecraft:entity'], ['RP','entity','minecraft:client_entity']]) {
        assert.equal(json(`${pack}/${folder}/fluids/fluid_tank_nether_star_essence.json`)[key].description.identifier,
            'utilitycraft:fluid_tank_nether_star_essence');
    }
    let items, holders;
    vm.runInNewContext(read('BP/scripts/config/fluids.js').replace(/^import .*;\r?\n/gm, ''), {
        DoriosLib: { registry: { registerFluidItem(v) { items = v; }, registerFluidHolder(v) { holders = v; } } }
    });
    const bucket = holders['minecraft:bucket'];
    const filled = items[bucket.types.nether_star_essence];
    assert.equal(filled.type, 'nether_star_essence');
    assert.equal(filled.amount, 1000);
    assert.equal(filled.amount, bucket.required);
    assert.equal(filled.output, 'minecraft:bucket');
});
