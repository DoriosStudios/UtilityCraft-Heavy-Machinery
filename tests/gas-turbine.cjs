const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const rotorDefinition = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../BP/entities/gas_turbine_rotor.json'), 'utf8'))['minecraft:entity'];
const folder = path.resolve(__dirname, '../BP/scripts/machinery/generators');
function load(file, context, exposed) {
    const source = fs.readFileSync(path.join(folder, file), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/\bexport /g, '');
    vm.runInContext(source + '\nthis.api = {' + exposed.join(',') + '};', context);
    return context.api;
}
const math = load('gasTurbineSimulation.js', vm.createContext({ Math, Number, Object }), ['TURBINE_GASES','GAS_TURBINE','getTurbineStructure','simulateGasTurbine']);
const near = (a,b,tolerance=1e-6) => assert.ok(Math.abs(a-b)<tolerance, a+' != '+b);
const bounds = {min:{x:0,y:0,z:0},max:{x:4,y:3,z:4}};
const stats = () => math.getTurbineStructure(bounds,{air:17,energy_cell:1});

function setup({ui=false,interval=4,gasAmount=200,gasType='methane_gas',energy=0,cap=4e6}={}) {
    const entities=new Map(), callbacks={}, intervals=[], blocks=new Map();let ids=0;
    const dimension={spawnEntity(type,location){return makeEntity(type,location);},getEntities({type}){return [...entities.values()].filter(e=>e.typeId===type);},getBlock(p){return blocks.get(p.x+','+p.y+','+p.z) ?? {typeId:'minecraft:air'};}};
    function makeEntity(typeId,location={x:0,y:1,z:2}) {
        const data=new Map(),properties=new Map(),items=new Map();
        const definitions=typeId==='utilitycraft:gas_turbine_rotor' ? rotorDefinition.description.properties : {};
        for(const [key,value] of Object.entries(definitions))properties.set(key,value.default);
        const e={id:'entity-'+(++ids),typeId,location,dimension,isValid:true,items,data,properties,writes:0,
            getDynamicProperty:k=>data.get(k),setDynamicProperty(k,v){if(v===undefined)data.delete(k);else data.set(k,v);},
            getProperty:k=>properties.get(k),setProperty(k,v){
                const definition=definitions[k];
                assert(definition && properties.has(k),'Missing property: '+k);
                assert(typeof v==='number' && v>=definition.range[0] && v<=definition.range[1],'Invalid property value: '+k);
                if(definition.type==='int')assert(Number.isInteger(v));
                properties.set(k,v);
            },
            getComponent(){return {container:{getItem:k=>items.get(k),setItem(k,v){e.writes++;items.set(k,v);}}};},
            remove(){e.isValid=false;entities.delete(e.id);}};entities.set(e.id,e);return e;
    }
    const owner=makeEntity('utilitycraft:gas_turbine');
    const counters={gasWrites:0,energyWrites:0,gasDisplay:0,energyDisplay:0,io:0,activation:0};
    owner.gas={value:gasAmount,cap:64000,type:gasType};owner.energy={value:energy,cap};
    const signal=name=>({subscribe(fn){(callbacks[name]??=[]).push(fn);}});
    const world={getEntity:id=>entities.get(id),getDimension:()=>dimension,afterEvents:Object.fromEntries(['entityContainerOpened','playerBreakBlock','playerPlaceBlock','blockExplode'].map(n=>[n,signal(n)]))};
    const rotorContext=vm.createContext({world,system:{runInterval(fn){intervals.push(fn);}},Math,WeakMap});
    const rotor=load('gasTurbineRotor.js',rotorContext,['ensureTurbineRotor','removeTurbineRotor','setTurbineRotorSpeed']);
    class ItemStack {constructor(typeId){this.typeId=typeId;this.nameTag='';}}
    class GasStorage {constructor(e){this.entity=e;}static initializeSingle(e){return new GasStorage(e);}static initializeMultiple(e){return [new GasStorage(e)];}static formatGas(n){return (n/1000).toFixed(1)+' B';}get(){return this.entity.gas.value;}getType(){return this.entity.gas.type;}getCap(){return this.entity.gas.cap;}setCap(n){this.entity.gas.cap=n;}consume(n){this.entity.gas.value-=n;counters.gasWrites++;}display(){counters.gasDisplay++;}}
    class EnergyStorage {constructor(e){this.entity=e;}static formatEnergyToText(n){return n.toFixed(0)+' DE';}get(){return this.entity.energy.value;}getFreeSpace(){return this.entity.energy.cap-this.get();}add(n){assert(n<=this.getFreeSpace());this.entity.energy.value+=n;counters.energyWrites++;}transferToNetwork(){return 0;}}
    const block={owner,dimension,location:owner.location};let buttons,handler,ioConfig;
    const Multiblock={EntityManager:{getControllerEntityFromBlock:b=>b?.owner,getEntityFromBlock:b=>b?.owner},DeactivationManager:{deactivateEntity(e){e.setDynamicProperty('dorios:state','off');e.setDynamicProperty('dorios:bounds',undefined);},handleBreakController(b){this.deactivateEntity(b.owner);b.owner.remove();}}};
    class MultiblockGenerator {constructor(b){this.valid=!!b.owner?.isValid;this.entity=b.owner;this.energy=new EnergyStorage(b.owner);this.processingInterval=interval;this.shouldUpdateUI=ui;}processIO(){counters.io++;}displayEnergy(){counters.energyDisplay++;}static handlePlayerInteract(e,c,h){return h.onActivate({entity:owner,structure:{bounds},components:{air:17,energy_cell:1},energyCap:cap});}}
    const context=vm.createContext({...math,...rotor,world,ItemStack,GasStorage,EnergyStorage,Multiblock,MultiblockGenerator,Math,Number,Object,JSON,WeakMap,
        InterfaceManager:{registerInterface(id,config){buttons=config.buttons;},linkBlockInterface(){},linkEntityInterface(){},ensureEntityInterfaces(){}},
        registerLinkNodeIO(id,config){ioConfig=config;},DoriosLib:{registry:{blockComponent(id,h){handler=h;}},entity:{getEquipment(){return {typeId:'utilitycraft:wrench'};}}}});
    const api=load('gasTurbine.js',context,['tickTurbine','activateTurbine','getTurbineState','hasRotorClearance']);
    owner.setDynamicProperty('dorios:state','on');owner.setDynamicProperty('dorios:bounds',JSON.stringify(bounds));
    api.activateTurbine({entity:owner,components:{air:17,energy_cell:1},structure:{bounds},energyCap:cap});
    owner.writes=0;buttons.power.onPress({entity:owner});
    return {owner,block,api,buttons,handler,ioConfig,world,entities,callbacks,intervals,rotor,blocks,counters,dimension,tick:()=>api.tickTurbine(block),state:()=>api.getTurbineState(owner)};
}

test('capacity uses only air; structural volume controls maximum burn rate',()=>{
    const s=stats();assert.equal(s.gasCapacity,17*64000);assert.equal(s.maxRate,18*.25);near(s.origin.x,2.5);near(s.radius,.65);
    assert(math.getTurbineStructure(bounds,{air:18}).error);
    assert(math.getTurbineStructure(bounds,{air:16,energy_cell:1,gas_cell:1}).error);
    assert(math.getTurbineStructure(bounds,{air:16,energy_cell:1}).error); // liquids are not air
});
test('startup and consumption are invariant across 4/20/80-tick batches',()=>{
    const run=step=>{let speed=0,progress=0,gas=1000,energy=0;for(let t=0;t<400;t+=step){const r=math.simulateGasTurbine({ticks:step,enabled:true,rate:2,maxRate:4.5,speed,progress,gas,energySpace:1e9-energy,energyPerMb:4096});speed=r.speed;progress=r.progress;gas-=r.consumed;energy+=r.energy;}return{speed,progress,gas,energy};};const expected=run(4);for(const step of[20,80]){const actual=run(step);for(const key of Object.keys(expected))near(actual[key],expected[key]);}
});
test('gas and buffer exhaustion stop conversion and coast during the remaining time',()=>{
    for(const limited of [{gas:1,energySpace:1e6},{gas:100,energySpace:4096}]){const r=math.simulateGasTurbine({ticks:80,enabled:true,rate:10,maxRate:10,speed:1,progress:0,energyPerMb:4096,...limited});assert.equal(r.consumed,1);assert.equal(r.energy,4096);assert(r.speed<.2);assert(r.activeTicks<1);}
});
test('zero rate, disabled, invalid fuel and full storage never consume gas',()=>{
    const base={ticks:80,enabled:true,rate:1,maxRate:4.5,speed:1,progress:.5,gas:100,energySpace:1e6,energyPerMb:4096};for(const change of[{enabled:false},{rate:0},{gas:0},{energySpace:4095},{energyPerMb:0}]){const r=math.simulateGasTurbine({...base,...change});assert.equal(r.consumed,0);assert.equal(r.energy,0);assert(r.speed<1);}
});
test('runtime uses gas IO, conserves energy and avoids display writes with UI closed',()=>{
    const x=setup();for(let i=0;i<20;i++)x.tick();assert(x.owner.gas.value<200);assert.equal(x.owner.energy.value,(200-x.owner.gas.value)*4096);assert.equal(x.owner.writes,0);assert.equal(x.counters.gasDisplay,0);assert.equal(x.counters.energyDisplay,0);assert(x.counters.io>0);assert.equal(x.ioConfig.gases.inputs[0].id,'fuel');
});
test('open UI displays native storage and bounded labels',()=>{const x=setup({ui:true});x.tick();assert.equal(x.counters.gasDisplay,1);assert.equal(x.counters.energyDisplay,1);for(const slot of[1,22,23,25,4])assert(x.owner.items.get(slot).nameTag.length<255);});
test('events handle keypad, apply, clear, delete and power without polling slots',()=>{const x=setup();x.buttons.clear.onPress({entity:x.owner});x.buttons.key_7.onPress({entity:x.owner});x.buttons.apply.onPress({entity:x.owner});near(x.state().rate,4.5);x.buttons.clear.onPress({entity:x.owner});x.buttons.key_17.onPress({entity:x.owner});x.buttons.key_16.onPress({entity:x.owner});x.buttons.key_11.onPress({entity:x.owner});x.buttons.apply.onPress({entity:x.owner});near(x.state().rate,.5);x.buttons.delete.onPress({entity:x.owner});x.buttons.power.onPress({entity:x.owner});assert.equal(x.state().enabled,false);assert.equal(x.owner.energy.value,0);});
test('runtime rejects invalid gas and conserves all registered gas values',()=>{
    for(const type of['steam','hydrogen_gas','methane_gas','nuclear_waste_gas']){const x=setup({gasType:type});for(let i=0;i<20;i++)x.tick();assert.equal(x.owner.energy.value,(200-x.owner.gas.value)*(math.TURBINE_GASES[type]?.energy??0));if(type==='nuclear_waste_gas')assert.equal(x.owner.gas.value,200);}
});
test('fractional progress resets when changing gas types',()=>{const x=setup({gasType:'hydrogen_gas'});x.tick();assert(x.state().progress>0);x.owner.gas.type='methane_gas';const before=x.owner.energy.value;x.tick();assert.equal(x.state().fuelType,'methane_gas');assert.equal((x.owner.energy.value-before)%4096,0);});
test('one persistent rotor per owner, reuses existing entities after cache loss',()=>{const x=setup();const id=x.owner.getDynamicProperty('hm:turbineRotor');for(let i=0;i<8;i++)x.tick();assert.equal(x.owner.getDynamicProperty('hm:turbineRotor'),id);assert.equal([...x.entities.values()].filter(e=>e.typeId.endsWith('_rotor')).length,1);assert(x.world.getEntity(id).getProperty('utilitycraft:speed')>0);});
test('rotor removed after casing deactivation and interior edits; no further generation',()=>{
    for(const event of['playerBreakBlock','playerPlaceBlock','blockExplode']){const x=setup();x.tick();const id=x.owner.getDynamicProperty('hm:turbineRotor'),energy=x.owner.energy.value;x.callbacks[event][0]({block:x.block});assert(!x.world.getEntity(id));x.tick();assert.equal(x.owner.energy.value,energy);}
    const x=setup();const id=x.owner.getDynamicProperty('hm:turbineRotor');x.owner.setDynamicProperty('dorios:state','off');x.intervals[0]();assert(!x.world.getEntity(id));
});
test('orphaned and duplicate rotor entities are cleaned up',()=>{const x=setup();const id=x.owner.getDynamicProperty('hm:turbineRotor');x.owner.remove();x.intervals[0]();assert(!x.world.getEntity(id));});
test('activation rejects blocked rotor and insufficient space without losing stored gas',()=>{
    const x=setup();x.blocks.set('2,1,2',{typeId:'utilitycraft:energy_cell'});assert.equal(x.api.hasRotorClearance(x.dimension,stats()),false);assert.equal(x.api.activateTurbine({entity:x.owner,components:{air:17,energy_cell:1},structure:{bounds},energyCap:4e6}),false);x.blocks.clear();x.owner.gas.value=2e6;assert.equal(x.api.activateTurbine({entity:x.owner,components:{air:17,energy_cell:1},structure:{bounds},energyCap:4e6}),false);assert.equal(x.owner.gas.value,2e6);
});
test('Power ignores unformed machines and breaking the controller removes its rotor',()=>{const x=setup();const id=x.owner.getDynamicProperty('hm:turbineRotor');x.handler.onPlayerBreak({block:x.block});assert(!x.world.getEntity(id));assert(!x.owner.isValid);});

test('reload reuses the serialized rotor reference rather than spawning a duplicate',()=>{const x=setup();const id=x.owner.getDynamicProperty('hm:turbineRotor');const context=vm.createContext({world:x.world,system:{runInterval(){}},Math,WeakMap});const reloaded=load('gasTurbineRotor.js',context,['ensureTurbineRotor']);assert.equal(reloaded.ensureTurbineRotor(x.owner,stats()).id,id);assert.equal([...x.entities.values()].filter(e=>e.typeId.endsWith('_rotor')).length,1);});
test('an unloaded rotor chunk does not break generator ticks and is retried later',()=>{const x=setup();x.rotor.removeTurbineRotor(x.owner);const spawn=x.dimension.spawnEntity;x.dimension.spawnEntity=()=>{throw new Error('Unloaded chunk');};assert.doesNotThrow(x.tick);assert(!x.owner.getDynamicProperty('hm:turbineRotor'));x.dimension.spawnEntity=spawn;x.tick();assert(x.owner.getDynamicProperty('hm:turbineRotor'));});
test('interior events outside the turbine do not deactivate it',()=>{const x=setup();x.callbacks.playerPlaceBlock[0]({block:{dimension:x.dimension,location:{x:40,y:1,z:2}}});assert.equal(x.owner.getDynamicProperty('dorios:state'),'on');});


test('a stale rotor without properties is replaced before being reused',()=>{
    const x=setup();const oldId=x.owner.getDynamicProperty('hm:turbineRotor');
    x.world.getEntity(oldId).properties.clear();
    const reloaded=load('gasTurbineRotor.js',vm.createContext({world:x.world,system:{runInterval(){}},Math,WeakMap}),['ensureTurbineRotor']);
    const rotor=reloaded.ensureTurbineRotor(x.owner,stats());
    assert(rotor);assert.notEqual(rotor.id,oldId);assert(!x.world.getEntity(oldId));
    assert.equal(rotor.getProperty('utilitycraft:height'),stats().inner.y);
    near(rotor.getProperty('utilitycraft:radius'),stats().radius);
});

test('missing native properties reject activation without an orphan or thrown promise',()=>{
    const x=setup();const spawn=x.dimension.spawnEntity;
    x.dimension.spawnEntity=(...args)=>{const rotor=spawn(...args);rotor.properties.clear();return rotor;};
    assert.equal(x.api.activateTurbine({entity:x.owner,components:{air:17,energy_cell:1},structure:{bounds},energyCap:4e6}),false);
    assert(!x.owner.getDynamicProperty('hm:turbineRotor'));
    assert.equal([...x.entities.values()].filter(e=>e.typeId.endsWith('_rotor')).length,0);
});

test('ticks deactivate an unavailable property definition without consuming gas or retrying each tick',()=>{
    const x=setup();x.rotor.removeTurbineRotor(x.owner);const spawn=x.dimension.spawnEntity;let spawned=0;
    x.dimension.spawnEntity=(...args)=>{spawned++;const rotor=spawn(...args);rotor.properties.clear();return rotor;};
    const amount=x.owner.gas.value;assert.doesNotThrow(x.tick);
    assert.equal(x.owner.getDynamicProperty('dorios:state'),'off');
    assert.equal(x.owner.gas.value,amount);assert.equal(x.owner.energy.value,0);
    for(let i=0;i<8;i++)x.tick();assert.equal(spawned,1);
});

test('only the rotor has client visuals and each queried property is synchronized',()=>{
    const rp=path.resolve(__dirname,'../RP');
    assert(!fs.existsSync(path.join(rp,'entity/gas_turbine.json')));
    assert(!fs.existsSync(path.join(rp,'models/entity/gas_turbine_controller.geo.json')));
    const client=JSON.parse(fs.readFileSync(path.join(rp,'entity/gas_turbine_rotor.json'),'utf8'))['minecraft:client_entity'].description;
    assert.equal(client.identifier,rotorDefinition.description.identifier);
    for(const expression of client.scripts.pre_animation){
        for(const [,key] of expression.matchAll(/q\.property\('([^']+)'\)/g)){
            assert.equal(rotorDefinition.description.properties[key]?.client_sync,true);
            assert(expression.includes("q.has_property('"+key+"')"));
        }
    }
});


test('failed native property writes clean up before publishing the rotor reference',()=>{
    const x=setup();const spawn=x.dimension.spawnEntity;
    x.dimension.spawnEntity=(...args)=>{const rotor=spawn(...args);rotor.setProperty=()=>{throw new Error('Native property write failed');};return rotor;};
    assert.equal(x.api.activateTurbine({entity:x.owner,components:{air:17,energy_cell:1},structure:{bounds},energyCap:4e6}),false);
    assert(!x.owner.getDynamicProperty('hm:turbineRotor'));
    assert.equal([...x.entities.values()].filter(e=>e.typeId.endsWith('_rotor')).length,0);
});


test('each gas drives its configured rotor speed without changing the selected intake rate',()=>{
    const states=[];
    for(const [type,gas] of Object.entries(math.TURBINE_GASES)){
        const x=setup({gasType:type,ui:true});for(let i=0;i<20;i++)x.tick();
        const rotor=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineRotor'));
        near(rotor.getProperty('utilitycraft:speed'),Math.round(x.state().speed*gas.speedMultiplier*1000)/1000);
        assert(x.owner.items.get(4).nameTag.includes('RPM'));
        assert(x.owner.items.get(22).nameTag.includes(gas.name));
        states.push(x.owner.gas.value);
    }
    assert(states.every(amount=>amount===states[0]));
});

test('Steam respects buffer exhaustion and never generates while stopped',()=>{
    const energy=math.TURBINE_GASES.steam.energy;
    const x=setup({gasType:'steam',gasAmount:1,cap:energy});
    for(let i=0;i<40;i++)x.tick();assert.equal(x.owner.gas.value,0);assert.equal(x.owner.energy.value,energy);
    const y=setup({gasType:'steam',cap:energy-1});for(let i=0;i<40;i++)y.tick();
    assert.equal(y.owner.gas.value,200);assert.equal(y.owner.energy.value,0);
    y.buttons.power.onPress({entity:y.owner});y.owner.energy.cap=4e6;
    for(let i=0;i<40;i++)y.tick();assert.equal(y.owner.gas.value,200);
});


test('empty gas type preserves the previous rotor multiplier while coasting',()=>{
    const x=setup({gasType:'methane_gas'});for(let i=0;i<20;i++)x.tick();
    const rotor=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineRotor'));
    const before=rotor.getProperty('utilitycraft:speed');x.owner.gas.value=0;x.owner.gas.type='empty';
    x.tick();const after=rotor.getProperty('utilitycraft:speed');assert(after>0&&after<before);
    near(after,Math.round(x.state().speed*math.TURBINE_GASES.methane_gas.speedMultiplier*1000)/1000);
});

test('steel scoop geometry and UVs stay inside the reserved rotor sweep at every size',()=>{
    const geo=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../RP/models/entity/gas_turbine_rotor.geo.json'),'utf8'))['minecraft:geometry'][0];
    const bones=new Map(geo.bones.map(b=>[b.name,b]));
    const anim=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../RP/animations/gas_turbine_rotor.animation.json'),'utf8')).animations['animation.utilitycraft.gas_turbine.rotor'];
    for(const name of Object.keys(anim.bones))assert(bones.has(name));
    const rotate=(p,angle)=>{const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];};
    for(const bone of geo.bones)for(const cube of bone.cubes??[]){
        for(const uv of Object.values(cube.uv))for(let i=0;i<2;i++)assert(uv.uv[i]>=0&&uv.uv[i]+uv.uv_size[i]<=32);
        if(!bone.name.startsWith('blade_'))continue;
        for(const x of[0,1])for(const y of[0,1])for(const z of[0,1]){
            const p=[x,y,z].map((n,i)=>cube.origin[i]+cube.size[i]*n-cube.pivot[i]);
            const r=rotate(p,cube.rotation[1]).map((n,i)=>n+cube.pivot[i]);
            const v=rotate(r,bone.rotation[1]);
            assert(Math.hypot(v[0],v[2])<16,'Blade exceeds reserved radius');
            for(const h of[2,5,197])assert(v[1]*(h-.375)+3>0&&v[1]*(h-.375)+3<16*h);
        }
    }
});
