const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = read('BP/scripts/DoriosCore/multiblock/multiblockMachine.js');
const stats = vm.runInNewContext('(function(components) {' + core.match(/static computeMachineStats\(components\) \{([\s\S]*?)\n  \}/)[1] + '})');
const helpers = {};
vm.runInNewContext(read('BP/scripts/machinery/machines/factoryProcessing.js').replace(/export /g, '')
    + '\nthis.processFactory = processFactory; this.canFitFactoryOutputs = canFitFactoryOutputs;', helpers);
const config = {
    crusher: { input: [3,4,5,6,7,8,9,10,11], output: [12,13,14,15,16,17,18,19,20], cost: 800, rate: 200, uc: 20 },
    electroPress: { input: [3,4,5,6,7,8,9,10,11], output: [12,13,14,15,16,17,18,19,20], cost: 800, rate: 200, uc: 20 },
    incinerator: { input: [3,4,5,6,7,8,9,10,11], output: [12,13,14,15,16,17,18,19,20], cost: 800, rate: 200, uc: 20 },
    infuser: { input: [8,9,10,11,12,13,14,15,16], output: [17,18,19,20,21,22,23,24,25], cost: 3200, rate: 400, uc: 40 },
    autosieve: { input: [4,5,6,7,8,9,10,11,12], output: [13,14,15,16,17,18,19,20,21,22,23,24,25,26,27], cost: 6400, rate: 400, uc: 40 },
    magmaticChamber: { input: [4,5,6,7,8,9,10,11,12], output: [], cost: 8000, rate: 400, uc: 40 },
    reactionChamber: { input: [5,6,7,8], output: [9,10,11,12], cost: 12800, rate: 1600, uc: 160 },
};
function item(typeId, amount = 64) { return { typeId, amount, maxAmount: 64 }; }
function tank(type = 'empty', amount = 0) {
    return { type, amount, cap: 1e9, get() { return this.amount; }, getType() { return this.type; },
        setType(v) { this.type = v; }, consume(v) { this.amount -= v; }, add(v) { this.amount += v; },
        getFreeSpace() { return this.cap - this.amount; }, display() {} };
}
function load(name, { interval = 20, processing = 1, speed = 0, efficiency = 0 } = {}) {
    const c = config[name], slots = new Map();
    const data = stats({ processing_module: processing, speed_module: speed, efficiency_module: efficiency });
    const fluids = [tank('water', 1e9), tank()];
    const machine = { valid: true, progress: 0, cost: 0, used: 0, interval, slots, data, fluids,
        entity: { getDynamicProperty(key) { return key === 'components' ? JSON.stringify(data) : undefined; } },
        container: { getItem: s => slots.get(s) },
        energy: { amount: 1e12, get() { return this.amount; }, consume(n) { this.amount -= n; machine.used += n; } },
        setRateMultiplier(n) { this.rate = c.rate * n * interval; },
        getProgress() { return this.progress; }, setProgress(n) { this.progress = n; },
        setEnergyCost(n) { this.cost = n; }, displayProgress() {},
        fill() {
            for (const slot of c.input) slots.set(slot, item('input'));
            if (name === 'infuser') for (const slot of [4,5,6,7]) slots.set(slot, item('catalyst'));
            if (name === 'autosieve') slots.set(3, { amount: 64, getComponent() {
                return { customComponentParameters: { params: { tier: 1, multiplier: 1, amount_multiplier: 1 } } };
            } });
        },
        drain() {
            let n = 0;
            for (const slot of c.output) { n += slots.get(slot)?.amount ?? 0; slots.delete(slot); }
            if (name === 'magmaticChamber') { n = fluids[1].amount / 100; fluids[1].amount = 0; }
            return n;
        },
    };
    const recipes = { input: { output: 'output', amount: 1, cost: c.cost } };
    let handler;
    const context = {
        ...helpers, worldLoaded: true,
        Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
        MultiblockMachine: function(block, settings) { assert.equal(settings.machine.rate_speed_base, c.rate); return machine; },
        Multiblock: {}, EnergyStorage: {},
        InterfaceManager: { registerInterface() {}, linkBlockInterface() {} }, registerLinkNodeIO() {},
        FluidStorage: { initializeMultiple: () => fluids, initializeSingle: () => fluids[1] },
        crusherRecipes: recipes, pressRecipes: recipes, furnaceRecipes: recipes,
        infuserRecipes: { 'catalyst|input': recipes.input },
        sieveRecipes: { input: [{ item: 'output', chance: 1, amount: 1 }] },
        melterRecipes: { input: { liquid: 'lava', amount: 100, cost: c.cost } },
        reactionRecipes: { 'input|water': { required_items: 1, required_liquid: 100,
            output_item: { id: 'output', amount: 1 }, output_liquid: { type: 'product', amount: 50 }, cost: c.cost } },
        DoriosLib: { registry: { blockComponent(id, h) { handler = h; } }, entity: {
            removeItem(entity, type, amount) {
                for (const [slot, current] of slots) {
                    if (current.typeId !== type) continue;
                    const n = Math.min(current.amount, amount); current.amount -= n; amount -= n;
                    if (!current.amount) slots.delete(slot);
                    if (!amount) break;
                }
                assert.equal(amount, 0, 'cannot consume missing inputs');
            },
        } },
    };
    context.MultiblockMachine.distributeOutput = (m, outputSlots, typeId, amount) => {
        for (const slot of outputSlots) {
            const existing = slots.get(slot);
            if (existing && existing.typeId !== typeId) continue;
            const n = Math.min(64 - (existing?.amount ?? 0), amount);
            slots.set(slot, item(typeId, (existing?.amount ?? 0) + n)); amount -= n;
            if (!amount) break;
        }
        assert.equal(amount, 0, 'cannot overflow outputs');
    };
    let source = read(`BP/scripts/machinery/machines/${name}Controller.js`).replace(/^import .*\r?\n/gm, '');
    // Exercise the actual recipe planning and mutation; replace only rendering.
    source += '\nupdateUI = (...args) => { globalThis.uiCalls++; };';
    context.uiCalls = 0;
    vm.runInNewContext(source, context);
    machine.tick = () => handler.onTick({ block: {} });
    machine.uiCalls = () => context.uiCalls;
    machine.fill();
    return machine;
}
function run(name, options = {}) {
    const m = load(name, options);
    let produced = 0;
    for (let tick = 0; tick < 400; tick += m.interval) {
        m.fill(); m.tick(); produced += m.drain();
    }
    return { produced, used: m.used, progress: m.progress, uiCalls: m.uiCalls() };
}
for (const name of Object.keys(config)) {
    test(`${name}: same production and cost at 4/20/40/80 ticks`, () => {
        for (const upgrades of [{}, { speed: 2, efficiency: 8 }, { processing: 2, speed: 2, efficiency: 8 }]) {
            const baseline = run(name, { interval: 4, ...upgrades });
            for (const interval of [20,40,80]) {
                const result = run(name, { interval, ...upgrades });
                assert.equal(result.produced, baseline.produced);
                assert.ok(Math.abs(result.used - baseline.used) < 1e-5);
                assert.ok(Math.abs(result.progress - baseline.progress) < 1e-6);
                assert.equal(result.uiCalls, 400 / interval, 'one UI refresh per update');
            }
        }
    });
    test(`${name}: minimum factory replaces two fully speed-upgraded standard machines`, () => {
        const result = run(name);
        const c = config[name];
        assert.equal(result.produced, 2 * (400 * c.uc * 10 / c.cost));
        assert.equal(result.used / result.produced, c.cost / 2);
    });
    test(`${name}: last paid batch completes with an empty battery`, () => {
        const m = load(name);
        m.energy.amount = config[name].cost;
        m.tick();
        assert.equal(m.energy.get(), 0);
        assert.equal(m.drain(), 2);
        assert.equal(m.progress, 0);
    });
    test(`${name}: blocked output spends nothing and preserves partial progress`, () => {
        const m = load(name);
        m.progress = config[name].cost / 2;
        for (const slot of config[name].output) m.slots.set(slot, item('blocked'));
        if (name === 'magmaticChamber') m.fluids[1].cap = 0;
        m.tick();
        assert.equal(m.used, 0);
        assert.equal(m.progress, config[name].cost / 2);
    });
}
test('Processing has diminishing throughput gains and constant DE per paid operation', () => {
    const one = run('crusher'), four = run('crusher', { processing: 4 });
    assert.equal(four.produced, one.produced * 2);
    assert.equal(four.used / four.produced, one.used / one.produced);
});
test('Efficiency saves energy without increasing throughput; discount is bounded', () => {
    const plain = run('crusher'), efficient = run('crusher', { efficiency: 32 });
    assert.equal(efficient.produced, plain.produced);
    assert.ok(efficient.used < plain.used * 0.3);
    assert.ok(efficient.used >= plain.used * 0.25);
});
test('Speed increases throughput without increasing energy per unit of work', () => {
    const plain = run('crusher'), fast = run('crusher', { speed: 2 });
    const speed = Math.sqrt(2);
    assert.equal(fast.produced, 2 * Math.floor(plain.produced / 2 * speed));
    assert.ok(Math.abs(fast.used - plain.used * speed) < 1e-6);
});
test('insufficient energy preserves progress and inputs, then finishes without extra DE', () => {
    const m = load('crusher'); m.energy.amount = 300;
    m.tick(); assert.equal(m.drain(), 0); assert.equal(m.progress, 300);
    m.energy.amount = 500; m.tick();
    assert.equal(m.drain(), 2); assert.equal(m.progress, 0); assert.equal(m.used, 800);
});
test('paid progress can finish without drawing any new energy', () => {
    const m = load('crusher'); m.progress = 800; m.energy.amount = 0;
    m.tick(); assert.equal(m.drain(), 2); assert.equal(m.used, 0);
});
test('stops after inputs run out instead of charging unused work', () => {
    const m = load('crusher'); m.slots.clear(); m.slots.set(3, item('input', 2));
    m.tick(); assert.equal(m.drain(), 2); assert.equal(m.used, 800);
});
test('rechecks both reaction outputs between batches', () => {
    const m = load('reactionChamber'); m.fluids[1].cap = 100;
    m.tick(); assert.equal(m.drain(), 2); assert.equal(m.fluids[1].amount, 100);
    assert.equal(m.used, 12800);
});
test('wrong reaction output fluid blocks without resetting or spending progress', () => {
    const m = load('reactionChamber'); m.progress = 500;
    m.fluids[1].type = 'wrong'; m.fluids[1].amount = 1;
    m.tick(); assert.equal(m.used, 0); assert.equal(m.progress, 500);
    assert.equal(m.uiCalls(), 1);
});
test('partial output space admits only a fitting batch', () => {
    const m = load('crusher');
    for (const slot of config.crusher.output) m.slots.set(slot, item('blocked'));
    m.slots.set(12, item('output', 63));
    m.tick(); assert.equal(m.slots.get(12).amount, 64); assert.equal(m.used, 800);
});
test('autosieve reserves simultaneous drops across shared output slots', () => {
    const slots = new Map([[0, item('a', 63)]]);
    const container = { getItem: s => slots.get(s) };
    assert.equal(helpers.canFitFactoryOutputs(container, [0,1], [
        { typeId: 'a', amount: 2 }, { typeId: 'b', amount: 1 },
    ]), false);
    assert.equal(helpers.canFitFactoryOutputs(container, [0,1], [
        { typeId: 'a', amount: 1 }, { typeId: 'b', amount: 64 },
    ]), true);
});
test('shared factory formulas stay identical in UC and HM', () => {
    assert.equal(core, fs.readFileSync(path.join(root, '../UtilityCraft/BP/scripts/DoriosCore/multiblock/multiblockMachine.js'), 'utf8'));
});

test('balanced module counts follow the agreed curve, allowing partial final batches', () => {
    const standard = 400 * config.crusher.uc * 10 / config.crusher.cost;
    for (const count of [2, 8, 16, 32, 64]) {
        const data = stats({ processing_module: count, speed_module: count });
        assert.ok(Math.abs(data.processing.amount * data.speed.multiplier - 2 * count) < 1e-10);
        // Keep inventories supplied between updates even at the largest tier.
        const result = run('crusher', { processing: count, speed: count, interval: 4 });
        assert.ok(Math.abs(result.produced - standard * 2 * count) < data.processing.amount);
        const paidOperations = result.produced + result.progress / config.crusher.cost * data.processing.amount;
        assert.ok(Math.abs(result.used / paidOperations - config.crusher.cost / 2) < 1e-6);
    }
});
test('one-sided module investment has diminishing returns', () => {
    const throughput = (p, s) => {
        const d = stats({ processing_module: p, speed_module: s });
        return d.processing.amount * d.speed.multiplier;
    };
    assert.equal(throughput(64, 1), 16);
    assert.equal(throughput(1, 64), 16);
    assert.equal(throughput(64, 64), 128);
});
