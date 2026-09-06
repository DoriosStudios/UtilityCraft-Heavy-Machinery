const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
process.chdir(path.join(__dirname, '..'));
const source = fs.readFileSync('BP/scripts/machinery/generators/nuclear_reactor.js', 'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm, '');
let handler, reactor;
class ItemStack { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } }
const coolant = { setCap() {}, display() {}, getType: () => 'empty', get: () => 0, getCap: () => 64000, consume() {} };
const context = { ItemStack, worldLoaded: true, system: { run() {}, runTimeout() {} },
 EnergyStorage: { formatEnergyToText: n => String(n) }, FluidStorage: { initializeMultiple: () => [coolant], formatFluid: String },
 InterfaceManager: { registerInterface() {}, linkBlockInterface() {} }, Multiblock: {},
 MultiblockGenerator: function () { return reactor; }, registerLinkNodeIO() {}, ensureFluidIOConfig() {}, ensureItemIOConfig() {},
 DoriosLib: { registry: { blockComponent(id, h) { handler = h; } }, text: { formatIdentifier: String } }, coolants: {},
 advanceReactorTemperature: o => ({ temperature: o.temperature, coolantHeatRemoved: 0 }),
 formatReactorOnTime: () => '00:00:00', synchronizeReactorTimer() {}, spawnReactorVentSmoke() {}, setReactorRunning() {},
};
vm.createContext(context);
vm.runInContext(source + '\n globalThis.api = { getReactorData, saveReactorData, loadFuelFromInput, updateFuelBar, config };', context);
const api = context.api;
function setup(data = {}, input) {
 const properties = { nuclearData: JSON.stringify({state:'on',power:100,temperature:1786.575,fuelStored:0,fuelType:'empty',...data}), nuclearStats: JSON.stringify({fuelAssemblies:1,rodControls:1,fuelCapacity:4000,coolantCapacity:64000}) };
 const items = {}; if (input) items[21] = { ...input };
 const entity = { getDynamicProperty: k => properties[k], setDynamicProperty: (k,v) => { properties[k]=v; } };
 const container = { getItem: k => items[k], setItem: (k,v) => { items[k]=v; } };
 const energy = { stored:0,free:1e9, getFreeSpace(){return this.free;}, add(v){assert.ok(Number.isFinite(v));this.stored+=v;this.free-=v;},get(){return this.stored;},getPercent(){return 0;},transferToNetwork(){} };
 reactor = {valid:true,entity,container,energy,processingInterval:1,setRate(){},setLabel(){},displayEnergy(){}};
 return {entity,container,items,energy,read:()=>JSON.parse(properties.nuclearData)};
}
let tests=0;function test(name,fn){fn();console.log('PASS '+name);tests++;}
function near(a,b){assert.ok(Math.abs(a-b)<1e-6,a+' != '+b);}
test('Both rods use the same input and retain unmatched/overflow items',()=>{for(const [id,type,units] of [['uranium_rod','uranium',250],['enriched_uranium_rod','enriched_uranium',1000]]){const x=setup({}, {typeId:'utilitycraft:'+id,amount:20});const d=api.getReactorData(x.entity);api.loadFuelFromInput(x.container,d);assert.equal(d.fuelType,type);assert.equal(d.fuelStored,4000);assert.equal(x.items[21].amount,20-4000/units);api.saveReactorData(x.entity,d);assert.equal(api.getReactorData(x.entity).fuelType,type);}});
test('Different fuel waits while existing fuel continues burning',()=>{const x=setup({fuelStored:1000,fuelType:'enriched_uranium'},{typeId:'utilitycraft:uranium_rod',amount:1});handler.onTick({block:{}});assert.equal(x.read().fuelType,'enriched_uranium');assert.equal(x.read().fuelStored,998);assert.equal(x.items[21].amount,1);assert.ok(x.read().warning.includes('Waiting'));near(x.energy.stored,380000);});
test('Enriched total yield and current burn rate remain unchanged',()=>{const x=setup({}, {typeId:'utilitycraft:enriched_uranium_rod',amount:1});for(let i=0;i<500;i++)handler.onTick({block:{}});near(x.energy.stored,190000000);assert.equal(x.read().fuelStored,0);assert.equal(x.read().fuelType,'empty');});
test('Basic burn speed and efficiency use its profile',()=>{const x=setup({}, {typeId:'utilitycraft:uranium_rod',amount:1});handler.onTick({block:{}});near(x.read().fuelStored,249.3);near(x.read().efficiency,.57);near(x.energy.stored,79800);});
test('Fuel switches automatically only after previous FU reaches zero',()=>{const x=setup({fuelStored:1,fuelType:'enriched_uranium'},{typeId:'utilitycraft:uranium_rod',amount:1});handler.onTick({block:{}});assert.equal(x.read().fuelType,'empty');assert.equal(x.items[21].amount,1);handler.onTick({block:{}});assert.equal(x.read().fuelType,'uranium');assert.equal(x.items[21],undefined);near(x.read().fuelStored,249.3);});
test('Full energy and stopped reactor do not burn stored fuel',()=>{const x=setup({fuelStored:250,fuelType:'uranium'});x.energy.free=0;handler.onTick({block:{}});assert.equal(x.read().fuelStored,250);const y=setup({state:'off',fuelStored:250,fuelType:'uranium'});handler.onTick({block:{}});assert.equal(y.read().fuelStored,250);});
test('Fractional final burn respects remaining energy space',()=>{const x=setup({fuelStored:250,fuelType:'uranium'});x.energy.free=114;handler.onTick({block:{}});near(x.energy.stored,114);near(x.read().fuelStored,249.999);});
test('Unknown items and incomplete rod capacity never consume input',()=>{const x=setup({fuelStored:3900,fuelType:'uranium'},{typeId:'utilitycraft:uranium_rod',amount:1});api.loadFuelFromInput(x.container,api.getReactorData(x.entity));assert.equal(x.items[21].amount,1);x.items[21].typeId='minecraft:stone';assert.ok(api.loadFuelFromInput(x.container,api.getReactorData(x.entity)).includes('Invalid'));assert.equal(x.items[21].amount,1);});
test('Hover reports type and structure-adjusted limits including empty state',()=>{const x=setup({fuelStored:250,fuelType:'uranium'});api.updateFuelBar(x.container,api.getReactorData(x.entity));const text=x.items[3].nameTag;for(const expected of ['Type: Uranium','Max Efficiency: 57.00%','Max Burn: 0.70 FU/t','Max Power: 79800/t'])assert.ok(text.includes(expected),text);api.updateFuelBar(x.container,{fuelStored:0,fuelType:'empty',fuelCapacity:4000,fuelAssemblies:1,rodControls:1});assert.ok(x.items[3].nameTag.includes('Type: Empty'));assert.ok(x.items[3].nameTag.includes('Max Power: 0/t'));});
test('Fuel slot uses the established two-frame one-second flipbook',()=>{const ui=JSON.parse(fs.readFileSync('RP/ui/nuclear_reactor.json'));const a=ui.fuel_flipbook_animation;assert.equal(a.frame_count,2);assert.equal(a.fps,1);const overlay=ui.nuclear_reactor_top.controls.find(c=>c['fuel_overlay@uc.function_panel'])['fuel_overlay@uc.function_panel'];assert.equal(overlay.collection_index,21);const image=overlay.controls[0].fuel_rod_image;assert.equal(image.uv,'@nuclear_reactor.fuel_flipbook_animation');const png=fs.readFileSync('RP/'+image.texture+'.png');assert.equal(png.readUInt32BE(16),32);assert.equal(png.readUInt32BE(20),16);});
test('Coolant registration preserves tiers and accepts addon entries',()=>{
 let receive,registered;
 const source=fs.readFileSync('BP/scripts/config/coolants.js','utf8').replace(/^import[^\n]*\n/gm,'').replace('export const coolants','const coolants');
 const c={system:{afterEvents:{scriptEventReceive:{subscribe(fn){receive=fn;}}}},DoriosLib:{registry:{registerCoolant(v){registered=v;}}}};
 vm.createContext(c);vm.runInContext(source+'\n globalThis.result=coolants;',c);
 receive({id:'utilitycraft:register_coolant',message:JSON.stringify(registered)});
 assert.equal(c.result.heavy_water.tier,2);assert.equal(c.result.heavy_water.efficiency,2*c.result.saline_coolant.efficiency);
 receive({id:'utilitycraft:register_coolant',message:JSON.stringify({'expansion:coolant':{tier:3,efficiency:4}})});
 Object.assign(context.coolants,c.result);
 assert.equal(context.coolants['expansion:coolant'].tier,3);
});
test('Nuclear cooling requires tier 2+, halves Heavy Water usage and accepts addon coolant',()=>{
 const saved={...coolant},thermal=context.advanceReactorTemperature;
 try { let consumed=0,active=false;
 coolant.get=()=>1000;coolant.consume=n=>{consumed+=n;};
 context.advanceReactorTemperature=o=>{active=o.hasCoolant;return {temperature:o.temperature,coolantHeatRemoved:o.hasCoolant?1:0};};
 for(const [type,valid,amount]of [['saline_coolant',false,0],['heavy_water',true,5],['expansion:coolant',true,2.5]]){
 consumed=0;active=false;coolant.getType=()=>type;const x=setup({fuelStored:1000,fuelType:'enriched_uranium'});handler.onTick({block:{}});
 assert.equal(active,valid);near(consumed,amount);near(x.energy.stored,380000);
 if(!valid)assert.ok(x.read().warning.includes('Tier 2+'));else assert.ok(!x.read().warning.includes('Invalid'));
 }
 } finally {Object.assign(coolant,saved);context.advanceReactorTemperature=thermal;}
});
console.log(tests+' reactor fuel checks passed');
