const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {buildSync}=require('esbuild');const root=path.resolve(__dirname,'..');
function load(file,imports={}){const module={exports:{}};const code=buildSync({entryPoints:[path.join(root,file)],bundle:true,write:false,format:'cjs',platform:'node',external:['@minecraft/server']}).outputFiles[0].text;vm.runInNewContext(code,{module,exports:module.exports,require:id=>imports[id]});return module.exports;}
class ItemStack{constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.lore=[];}getLore(){return this.lore;}setLore(v){this.lore=v;}}
const thermal=load('BP/scripts/machinery/generators/thermoSimulation.js');
const {TemperatureStorage}=load('BP/scripts/DoriosCore/machinery/temperatureStorage.js',{'@minecraft/server':{ItemStack}});
let handler,buttons,opened,runtime,activation,explosions=0,deactivations=0;const pending=[];
let entityIds=0;
const context={runtimes:new Map(),...thermal,TemperatureStorage,worldLoaded:true,system:{currentTick:0},
 world:{afterEvents:{entityContainerOpened:{subscribe(fn){opened=fn;}}}},
 EnergyStorage:{formatEnergyToText:String},GasStorage:{initializeMultiple:e=>[e.exhaust],formatGas:String},ensureGasIOConfig(){},FluidStorage:{initializeMultiple(e){e.inits++;return[e.coolant,e.lava];},formatFluid:String},
 InterfaceManager:{registerInterface(id,def){buttons=def.buttons;},linkBlockInterface(){},linkEntityInterface(){},ensureEntityInterfaces(){}},registerLinkNodeIO(){},
 MultiblockGenerator:function(){return runtime;},
 Multiblock:{DeactivationManager:{deactivateMultiblock(){deactivations++;}},EntityManager:{getCenter:()=>({x:0,y:0,z:0}),getVolume:()=>125}},
 coolants:{water:{tier:0,efficiency:0.5},saline_coolant:{tier:0,efficiency:1},heavy_water:{tier:2,efficiency:2}},
 DoriosLib:{registry:{blockComponent(id,h){handler=h;}},text:{formatIdentifier:String},time:{runAfterSeconds(n,fn){pending.push(fn);}},entity:{setNewItem(e,spec){const item=new ItemStack(spec.typeId);item.nameTag=spec.nameTag;e.container.setItem(spec.slot,item);}}},
 synchronizeReactorTimer(){},formatReactorOnTime:()=> '00:00:00',spawnReactorVentSmoke(){},setReactorRunning(data,on){data.state=on?'on':'off';data.startedAtMs=on?1:0;},
};
context.MultiblockGenerator.handlePlayerInteract=(e,config,handlers)=>{activation=handlers.onActivate;};
vm.createContext(context);const source=fs.readFileSync(path.join(root,'BP/scripts/machinery/generators/thermoReactor.js'),'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"]\r?\n/gm,'');
vm.runInContext(source+'\nglobalThis.api={config,getReactorInfo};',context);const {config}=context.api;
function near(a,b,t=1e-8){assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);}
function tank(type,value,cap){return{type,value,cap,capWrites:0,displays:0,get(){return this.value;},getType(){return this.type;},setType(v){this.type=v;},getCap(){return this.cap;},getFreeSpace(){return Math.max(0,this.cap-this.value);},add(n){assert(n<=this.getFreeSpace());this.value+=n;return n;},setCap(v){this.cap=v;this.capWrites++;},consume(v){assert.ok(v<=this.value+1e-8);this.value-=v;return v;},display(){this.displays++;}};}
function setup({data={},stats={},interval=4,open=false,lava=10000,coolant=10000,type='saline_coolant',gas=0,gasType='empty'}={}){
 const values=new Map([['reactorData',JSON.stringify({state:'on',rate:1,temperature:700,...data})],['reactorStats',JSON.stringify({lavaCapacity:256000,coolantCapacity:64000,exhaustCapacity:256000,gasCells:1,heatDissipation:0.1,heatCapacity:120,...stats})]]);
 const items=new Map(),reads=[],writes=[];const container={getItem(slot){reads.push(slot);return items.get(slot);},setItem(slot,item){writes.push(slot);items.set(slot,item);}};
 const entity={id:'thermo-'+(++entityIds),typeId:'utilitycraft:thermo_reactor',isValid:true,container,inits:0,exhaust:tank(gasType,gas,256000),coolant:tank(type,coolant,64000),lava:tank('lava',lava,256000),getDynamicProperty:k=>values.get(k),setDynamicProperty:(k,v)=>values.set(k,v),getComponent:()=>({container}),getProperty:()=>open?1:0,location:{x:0,y:0,z:0},dimension:{playSound(){}}};
 const energy={value:0,cap:1e12,get(){return this.value;},getFreeSpace(){return this.cap-this.value;},getPercent(){return this.value/this.cap*100;},add(v){this.value+=v;},transferToNetwork(){}};
 const r={valid:true,entity,container,energy,processingInterval:interval,shouldUpdateUI:open,setRate(v){this.rate=v*interval;},displayEnergy(){},setLabel(text,slot=1){const item=new ItemStack('utilitycraft:arrow_indicator_90');item.nameTag=text;container.setItem(slot,item);},block:{},dimension:{createExplosion(){explosions++;}}};
 return{entity,reactor:r,energy,items,reads,writes,values,read:()=>JSON.parse(values.get('reactorData')),tick(){runtime=r;context.system.currentTick+=interval;handler.onTick({block:{}});}};
}
function input(overrides={}){return{temperature:700,heatCapacity:120,ticks:80,running:true,rate:1,fuel:1000,energySpace:1e12,conductance:0.4,coolantHeatBudget:400000,...overrides};}

test('Thermo closed UI does no inventory work and creates stores per update without redundant capacity writes',()=>{const x=setup();x.tick();x.tick();assert.equal(x.reads.length,0);assert.equal(x.writes.length,0);assert.equal(x.entity.inits,2);assert.equal(x.entity.lava.capWrites,0);assert.equal(x.entity.lava.displays,0);assert.equal(x.entity.exhaust.displays,0);assert.equal(x.entity.exhaust.capWrites,0);assert.ok(x.energy.value>0);assert.ok(x.read().temperature!==700);assert.equal(x.read().heatCapacity,undefined);assert.equal(x.read().heatDissipation,undefined);});
test('Thermo open UI uses native temperature/fluids and unchanged label layout',()=>{const x=setup({open:true});x.tick();assert.ok(x.items.get(4).typeId.startsWith('utilitycraft:temperature_'));assert.ok(x.items.get(1).nameTag.includes('Producing:'));assert.ok(x.items.get(22).nameTag.includes('Fuel Information'));assert.ok(x.items.get(23).nameTag.includes('mB/t'));assert.ok(x.items.get(25).nameTag.includes('Recommended Rate:'));assert.equal(x.entity.coolant.displays,1);assert.equal(x.entity.lava.displays,1);assert.equal(x.entity.exhaust.displays,1);assert.ok(x.items.get(22).nameTag.includes("Gas Information"));});
test('Thermo buttons operate by callback without simulation',()=>{const x=setup({open:true,data:{state:'off'}});opened({entity:x.entity});buttons.cancel.onPress({entity:x.entity});buttons.keypad_7.onPress({entity:x.entity});buttons.keypad_16.onPress({entity:x.entity});buttons.keypad_11.onPress({entity:x.entity});buttons.accept.onPress({entity:x.entity});near(x.read().rate,7.5);buttons.delete.onPress({entity:x.entity});buttons.power.onPress({entity:x.entity});assert.equal(x.read().state,'on');assert.equal(x.energy.value,0);assert.equal(Object.keys(buttons).length,15);});
test('Thermo migrates old temperature/conductors and restores authoritative storage',()=>{const x=setup({data:{state:'off',temperature:900},stats:{heatCapacity:undefined}});const data=context.api.getReactorInfo(x.entity);near(data.heatConductors,2);near(data.conductance,0.4);x.tick();near(new TemperatureStorage(x.entity).get(),x.read().temperature);new TemperatureStorage(x.entity).set(800);x.tick();near(x.read().temperature,300+500*Math.exp(-0.408*4/data.heatCapacity));});
test('Thermo activation updates filled tank capacities and retains temperature',()=>{const x=setup({data:{state:'off'}});x.tick();const previous=new TemperatureStorage(x.entity).get();handler.onPlayerInteract({});activation({entity:x.entity,components:{air:2,gas_cell:1,fluid_cell:2,thermo_core:1,heat_conductor:4},energyCap:1000,settings:{multiblock:{transfer_rate_ratio:20}},structure:{bounds:{min:{x:0,y:0,z:0},max:{x:4,y:4,z:4}}}});near(x.entity.coolant.cap,128000);near(x.entity.lava.cap,512000);near(new TemperatureStorage(x.entity).get(),previous);assert.ok(x.items.get(6).nameTag.includes('1 mB/t'));});
test('Thermo 4/20/80 tick batches preserve thermal/resource results',()=>{const start=input({coolantHeatBudget:17});const expected=thermal.simulateThermoReactor(start,config);for(const ticks of[4,20]){let current={...start,ticks},burned=0,energy=0,heat=0;for(let n=0;n<80;n+=ticks){const r=thermal.simulateThermoReactor(current,config);burned+=r.consumedLava;energy+=r.producedEnergy;heat+=r.coolantHeatRemoved;current={...current,temperature:r.temperature,fuel:start.fuel-burned,energySpace:start.energySpace-energy,coolantHeatBudget:Math.max(0,start.coolantHeatBudget-heat)};}near(current.temperature,expected.temperature);near(burned,expected.consumedLava);near(energy,expected.producedEnergy);near(heat,expected.coolantHeatRemoved);}});
test('Thermo fractional lava is prepaid and remains consistent across scheduler profiles',()=>{const a=setup({interval:4,data:{rate:0.03}}),b=setup({interval:20,data:{rate:0.03}});for(let i=0;i<5;i++)a.tick();b.tick();near(a.entity.lava.value,b.entity.lava.value);near(a.read().lavaCreditMb,b.read().lavaCreditMb);near(a.energy.value,b.energy.value);near(a.read().temperature,b.read().temperature);near(a.entity.coolant.value,b.entity.coolant.value);near(a.read().coolantCreditMb,b.read().coolantCreditMb);});
test('Thermo empty fuel/full energy/zero rate cool without burning; producing resets',()=>{for(const opts of[{lava:0},{data:{rate:0}},{data:{state:'off'}}]){const x=setup(opts);x.tick();near(x.energy.value,0);near(x.read().producing,0);assert.ok(x.read().temperature<700);}const x=setup();x.energy.cap=0;x.tick();near(x.read().producing,0);assert.ok(x.read().warning.includes('Energy Full'));});
test('Thermo finite coolant cannot cool for free; Heavy Water absorbs twice the heat per mB',()=>{for(const type of['saline_coolant','heavy_water']){const x=setup({type,coolant:1,interval:80,data:{state:'off',temperature:900}});x.tick();near(x.entity.coolant.value,0);assert.ok(x.read().coolantCreditMb<1e-6);}const r=thermal.simulateThermoReactor(input({running:false,coolantHeatBudget:1}),config);near(r.coolantHeatRemoved,1);const dry=thermal.simulateThermoReactor(input({running:false,coolantHeatBudget:0}),config);assert.ok(r.temperature<dry.temperature);const a=setup({type:'saline_coolant',data:{state:'off'}}),b=setup({type:'heavy_water',data:{state:'off'}});a.tick();b.tick();near(a.read().temperature,b.read().temperature);const used=x=>10000-x.entity.coolant.value-x.read().coolantCreditMb;near(used(a),used(b)*2);});
test('Thermo meltdown stops fuel at threshold and schedules one explosion',()=>{const x=setup({data:{temperature:1199,rate:100},coolant:0,interval:80});x.tick();assert.equal(x.read().meltdownPending,true);near(x.read().temperature,1200);assert.ok(10000-x.entity.lava.value<8000);assert.equal(x.read().state,'off');const count=deactivations;x.tick();assert.equal(deactivations,count);buttons.power.onPress({entity:x.entity});assert.equal(x.read().state,'off');pending.splice(0).forEach(fn=>fn());assert.ok(explosions>0);});
test('Thermo thermal mass excludes air and maximum efficiency remains 80%',()=>{const bounds={min:{x:0,y:0,z:0},max:{x:4,y:4,z:4}};near(thermal.getThermoHeatCapacity(bounds,{thermo_core:1,air:20}),thermal.getThermoHeatCapacity(bounds,{thermo_core:1,air:200}));const ideal=config.ambientTemperatureK+(config.maximumTemperatureK-config.ambientTemperatureK)*0.5;near(thermal.getThermoEfficiency(ideal,config),0.8);const low=thermal.simulateThermoReactor(input({ticks:2000,rate:0.01,coolantHeatBudget:0}),config);assert.equal(low.meltdown,false);assert.ok(low.temperature<700);});


test('Water and Heavy Water create the same Steam per removed HU, with fourfold coolant efficiency',()=>{
 const a=setup({type:'water',data:{state:'off'}}),b=setup({type:'heavy_water',data:{state:'off'}});a.tick();b.tick();near(a.read().temperature,b.read().temperature);
 const used=x=>10000-x.entity.coolant.value-x.read().coolantCreditMb;
 const output=x=>x.entity.exhaust.get()+x.read().exhaustCreditMb;
 near(used(a),used(b)*4);near(output(a),output(b));near(output(a)*8,used(a)*20);assert.equal(a.entity.exhaust.type,'steam');
 const c=setup({data:{state:'off'}});c.tick();near(output(c)*16,used(c)*40);assert.equal(c.entity.exhaust.type,'heated_saline_coolant_gas');
});
test('Full or incompatible exhaust blocks active cooling without consuming coolant or deleting gas',()=>{
 const dry=setup({coolant:0});dry.tick();
 for(const opts of[{gas:256000,gasType:'heated_saline_coolant_gas'},{gas:100,gasType:'steam'}]){
 const x=setup(opts);x.tick();near(x.read().temperature,dry.read().temperature);near(x.entity.coolant.value,10000);near(x.entity.exhaust.value,opts.gas);assert(x.energy.value>0);assert.match(x.read().warning,/Gas Tank Full|Drain Output/);
 }
});
test('Limited exhaust space bounds actual removed heat, with no gas overflow',()=>{
 const x=setup({gas:255999,gasType:'steam',type:'water',data:{state:'off'}});x.tick();near(x.entity.exhaust.value,256000);near((10000-x.entity.coolant.value-x.read().coolantCreditMb)*20,8);near(x.read().exhaustCreditMb,0);
});
test('Fractional gas production persists and is invariant across refresh intervals',()=>{
 const a=setup({interval:4,type:'water',data:{rate:.03}}),b=setup({interval:20,type:'water',data:{rate:.03}});for(let i=0;i<5;i++)a.tick();b.tick();near(a.entity.exhaust.value,b.entity.exhaust.value);near(a.read().exhaustCreditMb,b.read().exhaustCreditMb);
});
test('Legacy reactors require rescanning with Gas Cells before burning',()=>{
 const x=setup({stats:{exhaustCapacity:undefined,gasCells:undefined,steamCapacity:64000}});x.tick();near(x.energy.value,0);near(x.entity.exhaust.cap,0);assert.match(x.read().warning,/Gas Cells/);
});
test('Output can switch only after draining; residual fraction cannot become a different gas',()=>{
 const x=setup({gas:1,gasType:'steam',data:{exhaustCreditType:'steam',exhaustCreditMb:.7}});x.tick();near(x.read().exhaustCreditMb,.7);x.entity.exhaust.value=0;x.tick();assert.equal(x.entity.exhaust.type,'heated_saline_coolant_gas');assert.equal(x.read().exhaustCreditType,'heated_saline_coolant_gas');
});
test('Reactivation refuses capacity reduction that would discard stored gas',()=>{
 const x=setup({gas:300000,stats:{exhaustCapacity:512000,gasCells:2}});handler.onPlayerInteract({});const before=x.values.get('reactorStats');const result=activation({entity:x.entity,components:{gas_cell:1},energyCap:1000,settings:{multiblock:{transfer_rate_ratio:20}},structure:{bounds:{}}});assert.equal(result,false);assert.equal(x.values.get('reactorStats'),before);near(x.entity.exhaust.value,300000);
});
test('Thermal direct output is nerfed 25 percent; recovered gases share the same DE/HU',()=>{
 near(config.energyPerLavaUnit,1500);near(256/thermal.THERMO_OUTPUT_HEAT.steam,512/thermal.THERMO_OUTPUT_HEAT.heated_saline_coolant_gas);
});


test('Empty coolant tanks release their type while preserving the dedicated lava tank',()=>{
 const x=setup({coolant:0,type:'saline_coolant'});x.tick();assert.equal(x.entity.coolant.type,'empty');assert.equal(x.entity.lava.type,'lava');
 const y=setup({coolant:1,type:'water',interval:80,data:{state:'off'}});y.tick();assert.equal(y.entity.coolant.type,'empty');assert.equal(y.entity.exhaust.type,'steam');
});
test('Heated Saline native bar assets retain the empty background and have one UC owner',()=>{
 const uc=path.resolve(root,'../UtilityCraft'),type='heated_saline_coolant_gas';const {decode}=require('../tools/gasTexturePng.cjs');
 const read=p=>decode(fs.readFileSync(path.join(uc,p)));
 const bg=read('RP/textures/ui/nuclear_waste_gas_bar/nuclear_waste_gas_00.png');
 const full=read('RP/textures/ui/'+type+'_bar/'+type+'_48.png');
 const atlas=JSON.parse(fs.readFileSync(path.join(uc,'RP/textures/item_texture.json'))).texture_data;
 for(let n=0;n<=48;n++){
  const id=type+'_'+String(n).padStart(2,'0'),frame=read('RP/textures/ui/'+type+'_bar/'+id+'.png');assert.equal(frame.width,48);assert.equal(frame.height,48);
  const item=JSON.parse(fs.readFileSync(path.join(uc,'BP/items/ui/'+type+'/utilitycraft_'+id+'.json')));assert.equal(item['minecraft:item'].description.identifier,'utilitycraft:'+id);assert(atlas['utilitycraft:'+id]);
  for(let y=0;y<48;y++)for(let x=0;x<48;x++){const i=(y*48+x)*4;assert.deepEqual(frame.pixels.subarray(i,i+4),(x>=16&&x<32&&y>=48-n?full:bg).pixels.subarray(i,i+4));}
 }
 for(const p of ['RP/textures/entity/'+type+'.png','RP/textures/static/images/'+type+'.png']){const sprite=read(p);assert.equal(sprite.width,16);assert.equal(sprite.height,16);}
 const creative='BP/blocks/machinery/tanks/creative_heated_saline_coolant_tank.json';assert(fs.existsSync(path.join(uc,creative)));assert(!fs.existsSync(path.join(root,creative)));
 const entity=JSON.parse(fs.readFileSync(path.join(root,'BP/entities/thermo_reactor.json')));assert(entity['minecraft:entity'].components['minecraft:type_family'].family.includes('dorios:gas_container'));
 const ui=JSON.parse(fs.readFileSync(path.join(root,'RP/ui/thermo_reactor.json')));assert(ui.reactor_page.controls.some(c=>Object.values(c)[0].collection_index===24));
});


test('Thermal skips cold stopped simulation, keeps UI/export and resumes on restart or heat change',()=>{
 const original=context.simulateThermoReactor;let calls=0;context.simulateThermoReactor=(...args)=>{calls++;return original(...args);};
 try {
  for(const open of [false,true]){
   const x=setup({open,data:{state:'off',temperature:300,producing:100,activeRate:5}});let exports=0;x.energy.transferToNetwork=()=>{exports++;};
   x.tick();x.tick();assert.equal(calls,0);assert.equal(exports,2);near(x.read().temperature,300);near(x.read().producing,0);near(x.read().activeRate,0);near(x.entity.coolant.value,10000);
   if(open)assert(x.items.get(1).nameTag.includes('Stopped'));else assert.equal(x.writes.length,0);
   buttons.power.onPress({entity:x.entity});x.tick();assert(calls>0);assert(x.energy.value>0);calls=0;
  }
  const hot=setup({data:{state:'off',temperature:300}});hot.tick();new TemperatureStorage(hot.entity).set(500);hot.tick();assert.equal(calls,1);assert(hot.read().temperature<500);assert(hot.read().temperature>300);
  calls=0;const residue=setup({data:{state:'off',temperature:300.0000005}});residue.tick();assert.equal(calls,0);assert.equal(new TemperatureStorage(residue.entity).get(),300);
 } finally {context.simulateThermoReactor=original;}
});


test('all HM ticking blocks use the shared four-tick callback cadence',()=>{
 let count=0;function scan(value){if(!value||typeof value!=='object')return;for(const [key,item]of Object.entries(value)){if(key==='minecraft:tick'){assert.deepEqual(item.interval_range,[4,4]);count++;}else scan(item);}}
 function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(file.endsWith('.json'))scan(JSON.parse(fs.readFileSync(file)));}}
 visit(path.join(root,'BP/blocks'));assert(count>=16);
});


test('Thermo restores fractions from DP after cache loss without resetting tanks or temperature',()=>{
 const x=setup({data:{rate:.03}});x.tick();const data=context.api.getReactorInfo(x.entity),before=x.read(),temperature=new TemperatureStorage(x.entity).get();
 assert.strictEqual(context.api.getReactorInfo({...x.entity}),data);assert.equal(data.entity,undefined);assert.equal(data.lava,undefined);
 context.runtimes.delete(x.entity.id);const restored=context.api.getReactorInfo(x.entity);assert.notStrictEqual(restored,data);
 for(const key of ['lavaCreditMb','coolantCreditMb','exhaustCreditMb','exhaustCreditType','temperature','rate'])assert.equal(restored[key],before[key]);
 near(new TemperatureStorage(x.entity).get(),temperature);assert.equal(restored.nextSoundTick,0);assert.equal(before.nextSoundTick,undefined);
 buttons.power.onPress({entity:x.entity});assert.equal(restored.state,'off');assert.equal(x.read().state,'off');
});

test('Thermo reads state and structural DP only when loading its runtime',()=>{
 const x=setup(),counts=new Map(),read=x.entity.getDynamicProperty;
 x.entity.getDynamicProperty=key=>{counts.set(key,(counts.get(key)??0)+1);return read(key);};
 const data=context.api.getReactorInfo(x.entity);for(let i=0;i<5;i++)assert.strictEqual(context.api.getReactorInfo(x.entity),data);
 assert.equal(counts.get('reactorData'),1);assert.equal(counts.get('reactorStats'),1);
});
