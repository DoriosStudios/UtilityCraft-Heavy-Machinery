const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
function load(relative, imports = {}) {
  const source = buildSync({ entryPoints: [path.join(root, relative)], bundle: true,
    write: false, format: 'cjs', platform: 'node', external: ['@minecraft/server'] }).outputFiles[0].text;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (!(name in imports)) throw Error('Unexpected import: ' + name);
    return imports[name];
  }});
  return module.exports;
}
const { advanceTemperature: advance } = load('BP/scripts/DoriosCore/machinery/temperatureModel.js');
class ItemStack { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } }
const { TemperatureStorage } = load('BP/scripts/DoriosCore/machinery/temperatureStorage.js', {
  '@minecraft/server': { ItemStack },
});
function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}
function entity() {
  const properties = new Map(), items = new Map();
  const e = { properties, items, open: 1, writes: 0, itemWrites: 0,
    getDynamicProperty: key => properties.get(key),
    setDynamicProperty(key, value) { properties.set(key, value); this.writes++; },
    getProperty() { return this.open; },
    getComponent() { return { container: {
      getItem: slot => items.get(slot),
      setItem(slot, item) { items.set(slot, item); e.itemWrites++; },
    }}; },
  };
  return e;
}

test('single hot/cold contacts approach their source without overshoot', () => {
  const g = -Math.log(0.9) * 100;
  const first = advance({ temperature: 300, heatCapacity: 100, contacts: [{ temperature: 900, conductance: g }] });
  near(first.temperature, 360);
  near(advance({ temperature: first.temperature, heatCapacity: 100, contacts: [{ temperature: 900, conductance: g }] }).temperature, 414);
  for (const start of [100, 1200]) for (const ticks of [0, 1, 20, 100000]) {
    const r = advance({ temperature: start, heatCapacity: 100, ticks, contacts: [{ temperature: 300, conductance: 2 }] });
    assert.ok(r.temperature >= Math.min(start, 300) - 1e-10 && r.temperature <= Math.max(start, 300) + 1e-10);
    near(r.generatedHeat + r.contacts[0].heat, r.netHeat, 1e-7);
  }
});

test('isolated heating/cooling is linear and has no machine or ambient clamp', () => {
  near(advance({ temperature: 300, heatCapacity: 100, heatRate: 600, ticks: 20 }).temperature, 420);
  const r = advance({ temperature: 300, heatCapacity: 1, heatRate: 1000, ticks: 20 });
  near(r.temperature, 20300); assert.equal(r.equilibriumTemperature, null);
  near(advance({ temperature: 300, heatCapacity: 1, heatRate: -1000 }).temperature, -700);
  near(advance({ temperature: 123.456, heatCapacity: 10, ticks: 1000 }).temperature, 123.456);
});

test('simultaneous contacts produce weighted equilibrium independent of order', () => {
  const contacts = [{ id: 'hot', temperature: 900, conductance: 2 }, { id: 'cold', temperature: 300, conductance: 1 }];
  const r = advance({ temperature: 700, heatCapacity: 100, ticks: 20, contacts });
  near(r.temperature, 700); near(r.equilibriumTemperature, 700);
  near(r.contacts[0].heat, 8000); near(r.contacts[1].heat, -8000);
  const options = { temperature: 1000, heatCapacity: 300, heatRate: 400, ticks: 20 };
  const a = advance({ ...options, contacts }), b = advance({ ...options, contacts: [...contacts].reverse() });
  near(a.temperature, b.temperature); near(a.contacts[0].heat, b.contacts[1].heat);
});

test('ticks 1, 4 and 20 preserve temperature AND individual heat accounting', () => {
  const contacts = [{ temperature: 1400, conductance: 3 }, { temperature: 280, conductance: 2 }];
  const base = { temperature: 320, heatCapacity: 125, heatRate: 73, contacts };
  const expected = advance({ ...base, ticks: 200 });
  for (const interval of [1, 4, 20]) {
    let temperature = base.temperature, generated = 0;
    const heat = [0, 0];
    for (let tick = 0; tick < 200; tick += interval) {
      const r = advance({ ...base, temperature, ticks: interval });
      temperature = r.temperature; generated += r.generatedHeat;
      r.contacts.forEach((c, i) => { heat[i] += c.heat; });
    }
    near(temperature, expected.temperature); near(generated, expected.generatedHeat);
    heat.forEach((q, i) => near(q, expected.contacts[i].heat));
  }
});

test('energy conservation over weak/strong contacts and zero-duration steps', () => {
  for (const g of [0, 1e-12, 0.01, 1, 1000]) for (const ticks of [0, 0.25, 4, 20]) {
    const r = advance({ temperature: 451, heatCapacity: 800, heatRate: 57, ticks,
      contacts: [{ temperature: 1800, conductance: g }, { temperature: 300, conductance: g * 3 }] });
    near(r.netHeat, r.generatedHeat + r.contacts.reduce((sum, c) => sum + c.heat, 0), 1e-8);
    near(r.netHeat, 800 * (r.temperature - 451), 1e-8);
    if (!ticks) { near(r.temperature, 451); near(r.netHeat, 0); }
  }
});

test('doubling thermal capacity doubles response time without changing equilibrium', () => {
  const options = { temperature: 300, heatCapacity: 100, heatRate: 600, ticks: 20,
    contacts: [{ temperature: 300, conductance: 1 }] };
  const a = advance(options), b = advance({ ...options, heatCapacity: 200, ticks: 40 });
  near(a.temperature, b.temperature); near(a.equilibriumTemperature, b.equilibriumTemperature);
});

test('analytical result agrees with independent small-step heat balance integration', () => {
  const options = { temperature: 333, heatCapacity: 100, heatRate: 60, ticks: 4,
    contacts: [{ temperature: 1300, conductance: 2 }, { temperature: 250, conductance: 1 }] };
  let t = options.temperature;
  const dt = 0.0001;
  for (let i = 0; i < 40000; i++) {
    t += (options.heatRate + options.contacts.reduce((q, c) => q + c.conductance * (c.temperature - t), 0)) / options.heatCapacity * dt;
  }
  near(advance(options).temperature, t, 1e-6);
});

test('storage persists fractional values, isolates indices and avoids stale instances', () => {
  const e = entity();
  const a = new TemperatureStorage(e, 0, { initialTemperature: 300.25, heatCapacity: 100 });
  const b = new TemperatureStorage(e, 0, { initialTemperature: 900, heatCapacity: 1 });
  const other = new TemperatureStorage(e, 1);
  near(b.get(), 300.25); near(b.getHeatCapacity(), 100);
  a.addHeat(25); b.addHeat(50); near(a.get(), 301);
  a.removeHeat(50); near(b.get(), 300.5); near(other.get(), 300);
  a.setHeatCapacity(200); near(b.getHeatCapacity(), 200); near(b.get(), 300.5);
  const r = b.transfer(900, 4, 2);
  near(new TemperatureStorage(e).get(), r.temperature);
  a.set(20000); near(b.get(), 20000);
  a.set(-5); near(b.get(), -5);
});

test('invalid math is rejected without corrupting persisted state', () => {
  const e = entity(), t = new TemperatureStorage(e);
  const before = e.getDynamicProperty(t.propertyId);
  for (const action of [() => t.set(NaN), () => t.set(Infinity), () => t.setHeatCapacity(0),
    () => t.advance({ ticks: -1 }), () => t.advance({ heatRate: NaN }),
    () => t.advance({ contacts: [{ temperature: 900, conductance: -1 }] }),
    () => t.advance({ contacts: [{ temperature: Infinity, conductance: 1 }] }),
    () => t.removeHeat(-1), () => t.addHeat(Infinity)]) {
    assert.throws(action); assert.equal(e.getDynamicProperty(t.propertyId), before);
  }
  const writes = e.writes;
  t.advance({ ticks: 0, heatRate: 600 }); assert.equal(e.writes, writes);
});

test('display clamps ONLY frames, preserves actual K, and skips unchanged/closed UIs', () => {
  const e = entity(), t = new TemperatureStorage(e);
  t.set(5000);
  assert.equal(t.display(), true); assert.equal(e.items.get(4).typeId, 'utilitycraft:temperature_31');
  assert.ok(e.items.get(4).nameTag.includes('5000.00 K')); near(t.get(), 5000);
  const writes = e.itemWrites; assert.equal(t.display(), false); assert.equal(e.itemWrites, writes);
  t.set(-100); t.display(); assert.equal(e.items.get(4).typeId, 'utilitycraft:temperature_00'); near(t.get(), -100);
  t.set(500); t.display(6, { minimum: 300, maximum: 700 }); assert.equal(e.items.get(6).typeId, 'utilitycraft:temperature_15');
  e.open = 0; t.set(600); assert.equal(t.display(), false);
  assert.equal(t.display(4, { force: true }), true);
  assert.throws(() => t.display(4, { minimum: 1, maximum: 1 }));
});
