const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
function load(file, imports = {}) {
    const source = buildSync({ entryPoints: [path.join(root, file)], bundle: true, write: false,
        format: 'cjs', platform: 'node', external: ['@minecraft/server'] }).outputFiles[0].text;
    const module = { exports: {} };
    vm.runInNewContext(source, { module, exports: module.exports, require: id => {
        if (!(id in imports)) throw Error(id);
        return imports[id];
    }});
    return module.exports;
}
class ItemStack { constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; } }
const thermal = load('BP/scripts/machinery/generators/nuclearSimulation.js');
const { TemperatureStorage } = load('BP/scripts/DoriosCore/machinery/temperatureStorage.js', { '@minecraft/server': { ItemStack } });
let handler, openHandler, buttons, runtime, explosions = 0, deactivations = 0;
const events = [];
const fluids = { heavy_water: { efficiency: 2, tier: 2 }, saline_coolant: { efficiency: 1, tier: 0 }, custom: { efficiency: 4, tier: 3 } };
let entityIds = 0;
const context = { runtimes: new Map(), ...thermal, TemperatureStorage, ItemStack, worldLoaded: true,
    world: { afterEvents: { entityContainerOpened: { subscribe(fn) { openHandler = fn; } } } },
    system: { currentTick: 0, run(fn) { fn(); } },
    EnergyStorage: { formatEnergyToText: String },
    FluidStorage: { initializeMultiple: e => { e.initializations++; return [e.coolant]; }, formatFluid: String },
    GasStorage: { initializeMultiple: e => { e.initializations++; return [e.waste]; }, formatGas: String },
    MultiblockGenerator: function () { return runtime; },
    InterfaceManager: { registerInterface(id, def) { buttons = def.buttons; }, linkBlockInterface() {}, linkEntityInterface() {}, ensureEntityInterfaces() {} },
    registerLinkNodeIO() {}, ensureFluidIOConfig() {}, ensureGasIOConfig() {}, ensureItemIOConfig() {},
    Multiblock: { DeactivationManager: { deactivateMultiblock() { deactivations++; } }, EntityManager: { getCenter: () => ({x:0,y:0,z:0}), getVolume: () => 125 } },
    DoriosLib: { registry: { blockComponent(id, h) { handler = h; } },
        text: { formatIdentifier: String }, time: { runAfterSeconds(delay, fn) { events.push(fn); } },
        entity: { setNewItem(e, spec) { const item = new ItemStack(spec.typeId); item.nameTag = spec.nameTag; e.container.setItem(spec.slot, item); } },
    }, coolants: fluids,
    formatReactorOnTime: () => '00:00:00', synchronizeReactorTimer() {}, spawnReactorVentSmoke() {},
    setReactorRunning(data, running) { data.state = running ? 'on' : 'off'; data.startedAtMs = running ? 1 : 0; },
};
const source = fs.readFileSync(path.join(root, 'BP/scripts/machinery/generators/nuclearReactor.js'), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '');
vm.createContext(context);
vm.runInContext(source + '\nglobalThis.api = { config, getReactorData, getRecommendedRate, loadFuelFromInput, updateFuelBar };', context);
const { config } = context.api;
function near(a, b, tol = 1e-8) { assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} != ${b}`); }
function tank(type, value, cap) {
    return { type, value, cap, capWrites: 0, displays: 0,
        get() { return this.value; }, getType() { return this.type; }, setType(v) { this.type = v; },
        getCap() { return this.cap; }, setCap(v) { this.cap = v; this.capWrites++; },
        getFreeSpace() { return Math.max(0, this.cap - this.value); },
        add(v) { const n = Math.min(v, this.getFreeSpace()); this.value += n; return n; },
        consume(v) { assert.ok(v <= this.value + 1e-8); this.value -= v; return v; },
        display() { this.displays++; },
    };
}
function setup({ data = {}, open = false, interval = 4, coolantType = 'heavy_water', coolant = 10000, waste = 0, stats = {} } = {}) {
    const values = new Map();
    values.set('nuclearData', JSON.stringify({ state: 'on', rate: 1, fuelStored: 1000, fuelType: 'enriched_uranium', temperature: 1000, ...data }));
    values.set('nuclearStats', JSON.stringify({ fuelAssemblies: 1, rodControls: 1, heatConductors: 2, emptyBlocks: 1,
        gasCells: 1, fuelCapacity: 4000, coolantCapacity: 64000, heatCapacity: 120, ...stats }));
    const items = new Map(), reads = [], writes = [];
    const container = { size: 26, getItem(slot) { reads.push(slot); return items.get(slot); },
        setItem(slot, item) { writes.push(slot); if (item) items.set(slot, item); else items.delete(slot); } };
    const entity = { id: 'nuclear-' + (++entityIds), typeId: 'utilitycraft:nuclear_reactor', isValid: true, container, initializations: 0,
        coolant: tank(coolantType, coolant, 64000), waste: tank('nuclear_waste_gas', waste, 256000),
        getDynamicProperty: k => values.get(k), setDynamicProperty: (k, v) => values.set(k, v),
        getProperty: () => open ? 1 : 0,
        getComponent: () => ({ container }),
    };
    const energy = { value: 0, cap: 1e12, get() { return this.value; }, getFreeSpace() { return this.cap - this.value; },
        getPercent() { return this.value / this.cap * 100; }, add(v) { assert.ok(Number.isFinite(v)); this.value += v; }, transferToNetwork() {} };
    const r = { entity, energy, container, valid: true, shouldUpdateUI: open, processingInterval: interval,
        setRate(rate) { this.rate = rate * interval; }, displayEnergy() {},
        setLabel(text, slot) { const i = new ItemStack('utilitycraft:arrow_indicator_90'); i.nameTag = text; container.setItem(slot, i); },
        dimension: { createExplosion() { explosions++; } }, block: {},
    };
    return { entity, energy, items, reads, writes, values, reactor: r,
        tick() { runtime = r; context.system.currentTick += interval; handler.onTick({ block: {} }); },
        read: () => JSON.parse(values.get('nuclearData')),
    };
}
function simulation(overrides = {}) {
    return { temperature: 1000, heatCapacity: 120, ticks: 20, running: true, rate: 1, nominalRate: 2,
        fuelEfficiency: 1, fuel: 1000, energySpace: 1e12, wasteSpace: 1000, conductance: 2 / 15,
        coolantHeatBudget: 4000000, ...overrides };
}

test('both fuel types retain values, overflow and mixing protections', () => {
    for (const [id, type, fu] of [['uranium_rod', 'uranium', 250], ['enriched_uranium_rod', 'enriched_uranium', 1000]]) {
        const x = setup({ data: { fuelStored: 0 } });
        x.items.set(21, { typeId: 'utilitycraft:' + id, amount: 20 });
        const d = context.api.getReactorData(x.entity); context.api.loadFuelFromInput(x.reactor.container, d);
        assert.equal(d.fuelType, type); assert.equal(d.fuelStored, 4000); assert.equal(x.items.get(21).amount, 20 - 4000 / fu);
    }
    const x = setup(); x.items.set(21, { typeId: 'utilitycraft:uranium_rod', amount: 1 }); x.tick();
    assert.ok(x.read().warning.includes('Waiting')); assert.equal(x.items.get(21).amount, 1);
    assert.ok(x.read().fuelStored < 1000);
});

test('closed UI performs no UI slot reads/writes and creates stores per update', () => {
    const x = setup(); x.tick(); x.tick();
    assert.deepEqual([...new Set(x.reads)], [21]); assert.equal(x.writes.length, 0);
    assert.equal(x.entity.coolant.displays, 0); assert.equal(x.entity.waste.displays, 0);
    assert.equal(x.entity.initializations, 4); assert.equal(x.entity.coolant.capWrites, 0);
    assert.ok(x.energy.value > 0); assert.ok(x.read().temperature !== 1000);
    assert.equal(x.read().bounds, undefined); assert.equal(x.read().heatCapacity, undefined);
    assert.equal(x.read().fuelAssemblies, undefined);
});

test('open UI retains native bars, labels and Filled text', () => {
    const x = setup({ open: true }); x.tick();
    for (const slot of [1, 3, 4, 22, 23, 25]) assert.ok(x.items.has(slot), `missing slot ${slot}`);
    assert.ok(x.items.get(4).typeId.startsWith('utilitycraft:temperature_'));
    assert.ok(x.items.get(22).nameTag.includes('Filled:'));
    assert.equal(x.entity.coolant.displays, 1); assert.equal(x.entity.waste.displays, 1);
});

test('InterfaceManager callbacks work without any simulation tick', () => {
    const x = setup({ open: true, data: { state: 'off' } });
    openHandler({ entity: x.entity }); assert.ok(x.items.get(6).nameTag.includes('1 FU/t'));
    buttons.cancel.onPress({ entity: x.entity });
    buttons.keypad_7.onPress({ entity: x.entity }); buttons.keypad_8.onPress({ entity: x.entity });
    buttons.delete.onPress({ entity: x.entity }); buttons.keypad_16.onPress({ entity: x.entity });
    buttons.keypad_11.onPress({ entity: x.entity }); buttons.accept.onPress({ entity: x.entity });
    near(x.read().rate, 7.5); assert.ok(x.items.get(23).nameTag.includes('7.50 FU/t'));
    buttons.power.onPress({ entity: x.entity }); assert.equal(x.read().state, 'on');
    buttons.power.onPress({ entity: x.entity }); assert.equal(x.read().state, 'off');
    assert.equal(x.energy.value, 0); assert.equal(Object.keys(buttons).length, 15);
});

test('legacy temperature, percent rate, waste ID and existing new storage migrate safely', () => {
    const x = setup({ data: { rate: undefined, power: 25, temperature: 1234.5 }, interval: 4 });
    x.entity.waste.type = 'uranium_waste_gas';
    const d = context.api.getReactorData(x.entity); near(d.rate, 0.5);
    x.tick(); assert.equal(x.entity.waste.type, 'nuclear_waste_gas');
    near(new TemperatureStorage(x.entity).get(), x.read().temperature);
    assert.equal(x.read().power, undefined);
    const t = new TemperatureStorage(x.entity); t.set(1700);
    x.tick(); assert.ok(x.read().temperature > 1690);
});

test('waste conservation and full-tank pause/resume include fractional FU', () => {
    const x = setup({ data: { rate: 0.1 }, interval: 4, waste: 255999 });
    x.tick(); x.tick(); x.tick(); near(x.read().fuelStored, 999);
    near(x.entity.waste.value, 256000); near(x.read().wasteRemainder, 0);
    assert.ok(x.read().warning.includes('Waste Full'));
    const fuel = x.read().fuelStored; x.tick(); near(x.read().fuelStored, fuel);
    x.entity.waste.value -= 10; x.tick(); assert.ok(x.read().fuelStored < fuel);
});

test('finite coolant uses prepaid fractions and rejects insufficient tiers', () => {
    for (const type of ['heavy_water', 'custom', 'saline_coolant']) {
        const x = setup({ coolantType: type, coolant: 1, data: { state: 'off', temperature: 2000 }, interval: 80 });
        x.tick(); assert.ok(x.entity.coolant.value >= 0);
        if (type === 'saline_coolant') near(x.entity.coolant.value, 1);
        else { near(x.entity.coolant.value, 0); assert.ok(x.read().coolantCreditMb < 1e-6); }
    }
    const a = setup({ data: { state: 'off' }, interval: 4 });
    const b = setup({ data: { state: 'off' }, interval: 20 });
    for (let i = 0; i < 5; i++) a.tick(); b.tick();
    near(a.read().temperature, b.read().temperature);
    near(a.entity.coolant.value - b.entity.coolant.value, 0);
    near(a.read().coolantCreditMb, b.read().coolantCreditMb);
});

test('coolant exhaustion splits time and does not provide cooling for the whole interval', () => {
    const dry = thermal.simulateNuclearReactor(simulation({ running: false, coolantHeatBudget: 0 }), config);
    const wet = thermal.simulateNuclearReactor(simulation({ running: false }), config);
    const limited = thermal.simulateNuclearReactor(simulation({ running: false, coolantHeatBudget: 1 }), config);
    near(limited.coolantHeatRemoved, 1, 1e-7);
    assert.ok(limited.temperature > wet.temperature && limited.temperature < dry.temperature);
});

test('4/20/80 tick batches preserve fuel, energy, waste and thermal evolution', () => {
    const initial = simulation({ ticks: 80, coolantHeatBudget: 13, energySpace: 1e12 });
    const expected = thermal.simulateNuclearReactor(initial, config);
    for (const ticks of [4, 20]) {
        let input = { ...initial, ticks }, consumed = 0, produced = 0, removed = 0;
        for (let n = 0; n < 80; n += ticks) {
            const r = thermal.simulateNuclearReactor(input, config);
            consumed += r.consumedFuel; produced += r.producedEnergy; removed += r.coolantHeatRemoved;
            input = { ...input, temperature: r.temperature, fuel: initial.fuel - consumed,
                energySpace: initial.energySpace - produced, wasteSpace: initial.wasteSpace - consumed,
                coolantHeatBudget: Math.max(0, initial.coolantHeatBudget - removed) };
        }
        near(input.temperature, expected.temperature); near(consumed, expected.consumedFuel);
        near(produced, expected.producedEnergy); near(removed, expected.coolantHeatRemoved);
    }
});

test('low rates stabilize passively, larger rates melt down and stop further burn', () => {
    const low = thermal.simulateNuclearReactor(simulation({ ticks: 5000, rate: 0.01, coolantHeatBudget: 0 }), config);
    assert.equal(low.meltdown, false); assert.ok(low.temperature < 1000);
    const high = thermal.simulateNuclearReactor(simulation({ ticks: 80, temperature: 2990,
        heatCapacity: 20, rate: 100, fuel: 10000, wasteSpace: 10000, coolantHeatBudget: 0 }), config);
    assert.equal(high.meltdown, true); near(high.temperature, config.meltdownTemperatureK);
    assert.ok(high.consumedFuel < 100 * 80);
    const x = setup({ data: { temperature: 2999, rate: 100 }, coolant: 0 });
    x.tick(); assert.equal(x.read().meltdownPending, true); assert.equal(x.read().state, 'off');
    assert.ok(deactivations > 0); events.splice(0).forEach(fn => fn()); assert.ok(explosions > 0);
});

test('energy/fuel exhaustion stop combustion while residual interval continues cooling', () => {
    for (const limited of [{ energySpace: 100 }, { fuel: 0.1 }, { wasteSpace: 0.1 }]) {
        const r = thermal.simulateNuclearReactor(simulation(limited), config);
        assert.ok(r.consumedFuel <= 0.1 || r.producedEnergy <= 100);
        assert.ok(r.temperature < 1000);
    }
});

test('solid structure grows thermal capacity, extra air does not', () => {
    const bounds = n => ({ min: {x:0,y:0,z:0}, max: {x:n-1,y:n-1,z:n-1} });
    const base = thermal.getNuclearHeatCapacity(bounds(5), { fuel_assemblies: 1, air: 20 });
    near(base, thermal.getNuclearHeatCapacity(bounds(5), { fuel_assemblies: 1, air: 200 }));
    assert.ok(thermal.getNuclearHeatCapacity(bounds(7), { fuel_assemblies: 1 }) > base);
    assert.ok(thermal.getNuclearHeatCapacity(bounds(5), { fuel_assemblies: 2 }) > base);
});

test('fuel overlay still references the native two-frame flipbook', () => {
    const json = fs.readFileSync(path.join(root, 'RP/ui/nuclear_reactor.json'), 'utf8');
    assert.ok(json.includes('nuclear_fuels_flipbook'));
});

test('fuel profiles retain 95% and 57% maximum conversion efficiencies', () => {
    const ideal = config.ambientTemperatureK + (config.maximumTemperatureK - config.ambientTemperatureK) * config.idealTemperatureFraction;
    for (const multiplier of [1, 0.6]) {
        const r = thermal.simulateNuclearReactor(simulation({ temperature: ideal, heatCapacity: 1e20,
            ticks: 4, fuelEfficiency: multiplier }), config);
        near(r.producedEnergy / r.consumedFuel, 200000 * 0.95 * multiplier);
    }
});

test('changed structure refreshes capacity without resetting stored temperature', () => {
    const x = setup(); x.tick();
    const old = new TemperatureStorage(x.entity).get();
    const stats = JSON.parse(x.values.get('nuclearStats')); stats.heatCapacity = 300; stats.gasCells = 2;
    x.values.set('nuclearStats', JSON.stringify(stats)); context.runtimes.delete(x.entity.id); x.tick();
    near(new TemperatureStorage(x.entity).getHeatCapacity(), 300);
    assert.ok(Math.abs(new TemperatureStorage(x.entity).get() - old) < 10);
    near(x.entity.waste.cap, 512000);
});


test('Nuclear skips cold stopped simulation, keeps UI/export and resumes on restart or heat change',()=>{
 const original=context.simulateNuclearReactor;let calls=0;context.simulateNuclearReactor=(...args)=>{calls++;return original(...args);};
 try {
  for(const open of [false,true]){
   const x=setup({open,data:{state:'off',temperature:300,producing:100,activeRate:5}});let exports=0;x.energy.transferToNetwork=()=>{exports++;};
   x.tick();x.tick();assert.equal(calls,0);assert.equal(exports,2);near(x.read().temperature,300);near(x.read().producing,0);near(x.read().activeRate,0);near(x.entity.coolant.value,10000);
   if(open)assert(x.items.get(1).nameTag.includes('Stopped'));else assert.equal(x.writes.length,0);
   buttons.power.onPress({entity:x.entity});x.tick();assert(calls>0);assert(x.energy.value>0);calls=0;
  }
  const hot=setup({data:{state:'off',temperature:300}});hot.tick();new TemperatureStorage(hot.entity).set(500);hot.tick();assert.equal(calls,1);assert(hot.read().temperature<500);assert(hot.read().temperature>300);
  calls=0;const residue=setup({data:{state:'off',temperature:300.0000005}});residue.tick();assert.equal(calls,0);assert.equal(new TemperatureStorage(residue.entity).get(),300);
 } finally {context.simulateNuclearReactor=original;}
});


test('cold stopped Nuclear still accepts fuel without consuming it',()=>{
 const x=setup({data:{state:'off',temperature:300,fuelStored:0,fuelType:'empty'}});x.items.set(21,{typeId:'utilitycraft:enriched_uranium_rod',amount:1});x.tick();near(x.read().fuelStored,1000);near(x.energy.value,0);near(x.entity.waste.value,0);near(x.read().efficiency,config.minimumEfficiency);
});


test('Nuclear reuses data by entity ID and restores persisted state after cache loss', () => {
    const x = setup(); x.tick();
    const data = context.api.getReactorData(x.entity);
    assert.strictEqual(context.api.getReactorData({ ...x.entity }), data);
    assert.equal(data.entity, undefined); assert.equal(data.coolant, undefined);
    assert.equal(data.temperature instanceof TemperatureStorage, false);
    const before = x.read();
    context.runtimes.delete(x.entity.id);
    const restored = context.api.getReactorData(x.entity);
    assert.notStrictEqual(restored, data);
    for (const key of ['fuelStored', 'fuelType', 'wasteRemainder', 'coolantCreditMb', 'temperature']) assert.equal(restored[key], before[key]);
    assert.equal(restored.nextSmokeTick, 0);
    assert.equal(before.nextSmokeTick, undefined);
    buttons.power.onPress({ entity: x.entity });
    assert.equal(restored.state, 'off'); assert.equal(x.read().state, 'off');
    x.entity.setDynamicProperty('dorios:state', 'off'); restored.state = 'on';
    assert.equal(context.api.getReactorData(x.entity).state, 'off');
});

test('Nuclear reads saved data and stats once while cached, with independent machine entries', () => {
    const x = setup(), y = setup({ data: { rate: 0.25 } });
    const counts = new Map(), read = x.entity.getDynamicProperty;
    x.entity.getDynamicProperty = key => { counts.set(key, (counts.get(key) ?? 0) + 1); return read(key); };
    const data = context.api.getReactorData(x.entity);
    for (let i = 0; i < 5; i++) assert.strictEqual(context.api.getReactorData(x.entity), data);
    assert.equal(counts.get('nuclearData'), 1); assert.equal(counts.get('nuclearStats'), 1);
    assert.notStrictEqual(context.api.getReactorData(y.entity), data);
    assert.equal(context.api.getReactorData(y.entity).rate, 0.25);
});
