const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const rotorDefinition = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../BP/entities/gas_turbine_rotor.json'), 'utf8'))['minecraft:entity'];
const gasDefinition = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../BP/entities/gas_turbine_gas.json'), 'utf8'))['minecraft:entity'];
const folder = path.resolve(__dirname, '../BP/scripts/machinery/generators');
function load(file, context, exposed) {
    const source = fs.readFileSync(path.join(folder, file), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/\bexport /g, '');
    vm.runInContext(source + '\nthis.api = {' + exposed.join(',') + '};', context);
    return context.api;
}
const math = load('gasTurbineSimulation.js', vm.createContext({ Math, Number, Object }), ['TURBINE_GASES','GAS_TURBINE','getTurbineStructure','getTurbineMaxRate','simulateGasTurbine']);
const visualConfig = load('gasTurbineVisuals.js', vm.createContext({ Object }), ['TURBINE_GAS_VISUALS','DEFAULT_TURBINE_GAS_VISUAL']);
const near = (a,b,tolerance=1e-6) => assert.ok(Math.abs(a-b)<tolerance, a+' != '+b);
const bounds = {min:{x:0,y:0,z:0},max:{x:4,y:3,z:4}};
const stats = () => math.getTurbineStructure(bounds,{air:17,energy_cell:1});

function setup({ui=false,interval=4,gasAmount=200,gasType='heated_saline_coolant_gas',energy=0,cap=4e6}={}) {
    const entities=new Map(), callbacks={}, intervals=[], blocks=new Map();let ids=0;
    const dimension={spawnEntity(type,location){return makeEntity(type,location);},getEntities({type}){return [...entities.values()].filter(e=>e.typeId===type);},getBlock(p){return blocks.get(p.x+','+p.y+','+p.z) ?? {typeId:'minecraft:air'};}};
    function makeEntity(typeId,location={x:0,y:1,z:2}) {
        const data=new Map(),properties=new Map(),items=new Map();
        const definitions=typeId==='utilitycraft:gas_turbine_rotor' ? rotorDefinition.description.properties : typeId==='utilitycraft:gas_turbine_gas' ? gasDefinition.description.properties : {};
        for(const [key,value] of Object.entries(definitions))properties.set(key,value.default);
        const e={id:'entity-'+(++ids),typeId,location,dimension,isValid:true,items,data,properties,writes:0,
            getDynamicProperty:k=>data.get(k),setDynamicProperty(k,v){if(v===undefined)data.delete(k);else data.set(k,v);},
            getProperty:k=>properties.get(k),setProperty(k,v){
                const definition=definitions[k];
                assert(definition && properties.has(k),'Missing property: '+k);
                if(definition.type==='enum')assert(definition.values.includes(v),'Invalid gas type: '+v);
                else assert(typeof v==='number' && v>=definition.range[0] && v<=definition.range[1],'Invalid property value: '+k);
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
    const gasSystem={currentTick:0,runInterval(fn){intervals.push(fn);}};
    const gasVisual=load('gasTurbineGas.js',vm.createContext({...math,...visualConfig,world,system:gasSystem,Math,WeakMap}),['syncTurbineGas','removeTurbineGas','getTurbineGasOpacity']);
    class ItemStack {constructor(typeId){this.typeId=typeId;this.nameTag='';}}
    class GasStorage {constructor(e){this.entity=e;}static initializeSingle(e){return new GasStorage(e);}static initializeMultiple(e){return [new GasStorage(e)];}static formatGas(n){return (n/1000).toFixed(1)+' B';}get(){return this.entity.gas.value;}getType(){return this.entity.gas.type;}getCap(){return this.entity.gas.cap;}setCap(n){this.entity.gas.cap=n;}consume(n){this.entity.gas.value-=n;counters.gasWrites++;}display(){counters.gasDisplay++;}}
    class EnergyStorage {constructor(e){this.entity=e;}static formatEnergyToText(n){return n.toFixed(0)+' DE';}get(){return this.entity.energy.value;}getFreeSpace(){return this.entity.energy.cap-this.get();}add(n){assert(n<=this.getFreeSpace());this.entity.energy.value+=n;counters.energyWrites++;}transferToNetwork(){return 0;}}
    const block={owner,dimension,location:owner.location};let buttons,handler,ioConfig;
    const Multiblock={EntityManager:{getControllerEntityFromBlock:b=>b?.owner,getEntityFromBlock:b=>b?.owner},DeactivationManager:{deactivateEntity(e){e.setDynamicProperty('dorios:state','off');e.setDynamicProperty('dorios:bounds',undefined);},handleBreakController(b){this.deactivateEntity(b.owner);b.owner.remove();}}};
    class MultiblockGenerator {constructor(b){this.valid=!!b.owner?.isValid;this.entity=b.owner;this.energy=new EnergyStorage(b.owner);this.processingInterval=interval;this.shouldUpdateUI=ui;}processIO(){counters.io++;}displayEnergy(){counters.energyDisplay++;}static handlePlayerInteract(e,c,h){return h.onActivate({entity:owner,structure:{bounds},components:{air:17,energy_cell:1},energyCap:cap});}}
    const runtimes=new Map();
    const context=vm.createContext({runtimes,...math,...rotor,...gasVisual,world,ItemStack,GasStorage,EnergyStorage,Multiblock,MultiblockGenerator,Math,Number,Object,JSON,WeakMap,
        InterfaceManager:{registerInterface(id,config){buttons=config.buttons;},linkBlockInterface(){},linkEntityInterface(){},ensureEntityInterfaces(){}},
        registerLinkNodeIO(id,config){ioConfig=config;},DoriosLib:{registry:{blockComponent(id,h){handler=h;}},entity:{getEquipment(){return {typeId:'utilitycraft:wrench'};}}}});
    const api=load('gasTurbine.js',context,['tickTurbine','activateTurbine','getTurbineState','hasRotorClearance']);
    owner.setDynamicProperty('dorios:state','on');owner.setDynamicProperty('dorios:bounds',JSON.stringify(bounds));
    api.activateTurbine({entity:owner,components:{air:17,energy_cell:1},structure:{bounds},energyCap:cap});
    owner.writes=0;buttons.power.onPress({entity:owner});
    return {runtimes,owner,block,api,buttons,handler,ioConfig,world,entities,callbacks,intervals,rotor,gasVisual,gasSystem,blocks,counters,dimension,tick:()=>api.tickTurbine(block),state:()=>api.getTurbineState(owner)};
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
    const x=setup();for(let i=0;i<20;i++)x.tick();assert(x.owner.gas.value<200);assert.equal(x.owner.energy.value,(200-x.owner.gas.value)*512);assert.equal(x.owner.writes,0);assert.equal(x.counters.gasDisplay,0);assert.equal(x.counters.energyDisplay,0);assert(x.counters.io>0);assert.equal(x.ioConfig.gases.inputs[0].id,'fuel');
});
test('open UI displays native storage and bounded labels',()=>{const x=setup({ui:true});x.tick();assert.equal(x.counters.gasDisplay,1);assert.equal(x.counters.energyDisplay,1);for(const slot of[1,22,23,25,4])assert(x.owner.items.get(slot).nameTag.length<255);});
test('events handle keypad, apply, clear, delete and power without polling slots',()=>{const x=setup();x.buttons.clear.onPress({entity:x.owner});x.buttons.key_7.onPress({entity:x.owner});x.buttons.apply.onPress({entity:x.owner});near(x.state().rate,3.6);x.buttons.clear.onPress({entity:x.owner});x.buttons.key_17.onPress({entity:x.owner});x.buttons.key_16.onPress({entity:x.owner});x.buttons.key_11.onPress({entity:x.owner});x.buttons.apply.onPress({entity:x.owner});near(x.state().rate,.5);x.buttons.delete.onPress({entity:x.owner});x.buttons.power.onPress({entity:x.owner});assert.equal(x.state().enabled,false);assert.equal(x.owner.energy.value,0);});
test('runtime rejects invalid gas and conserves all registered gas values',()=>{
    for(const type of['steam','heated_saline_coolant_gas','hydrogen_gas','methane_gas','nuclear_waste_gas']){const x=setup({gasType:type});for(let i=0;i<20;i++)x.tick();assert.equal(x.owner.energy.value,(200-x.owner.gas.value)*(math.TURBINE_GASES[type]?.energy??0));if(!math.TURBINE_GASES[type])assert.equal(x.owner.gas.value,200);}
});
test('fractional progress resets when changing gas types',()=>{const x=setup({gasType:'steam'});x.tick();assert(x.state().progress>0);x.owner.gas.type='heated_saline_coolant_gas';const before=x.owner.energy.value;x.tick();assert.equal(x.state().fuelType,'heated_saline_coolant_gas');assert.equal((x.owner.energy.value-before)%512,0);});
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
        near(rotor.getProperty('utilitycraft:speed'),Math.round(x.state().speed*1000)/1000);
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


test('empty gas preserves physical rotor speed while coasting',()=>{
    const x=setup({gasType:'heated_saline_coolant_gas'});for(let i=0;i<20;i++)x.tick();
    const rotor=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineRotor'));
    const before=rotor.getProperty('utilitycraft:speed');x.owner.gas.value=0;x.owner.gas.type='empty';
    x.tick();const after=rotor.getProperty('utilitycraft:speed');assert(after>0&&after<before);
    near(after,Math.round(x.state().speed*1000)/1000);
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


test('gas fills the complete inset volume and only opacity changes with tank contents',()=>{
    const x=setup({gasType:'steam'}),id=x.owner.getDynamicProperty('hm:turbineGasVisual'),v=x.world.getEntity(id);
    assert(v);for(const [key,n]of Object.entries({width:3,height:2,depth:3}))assert.equal(v.getProperty('utilitycraft:'+key),n);
    for(const [fill,alpha]of [[0,0],[.1,.19],[.5,.424],[1,.6]]){
        x.gasVisual.syncTurbineGas(x.owner,stats(),'steam',stats().gasCapacity*fill,stats().gasCapacity);
        near(v.getProperty('utilitycraft:opacity'),alpha);
        assert.equal(v.getProperty('utilitycraft:height'),2);
    }
});
test('gas switching selects each visual and unknown gas falls back to Steam',()=>{
    const x=setup(),v=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineGasVisual'));
    for(const type of Object.keys(visualConfig.TURBINE_GAS_VISUALS)){
        x.gasVisual.syncTurbineGas(x.owner,stats(),type,100,100);assert.equal(v.getProperty('utilitycraft:gas_type'),Object.keys(visualConfig.TURBINE_GAS_VISUALS).indexOf(type));near(v.getProperty('utilitycraft:opacity'),visualConfig.TURBINE_GAS_VISUALS[type].maxOpacity);
    }
    x.gasVisual.syncTurbineGas(x.owner,stats(),'third_party_gas',100,100);assert.equal(v.getProperty('utilitycraft:gas_type'),0);near(v.getProperty('utilitycraft:opacity'),.6);
});
test('steady gas opacity does not repeat property writes and persists through reload',()=>{
    const x=setup(),id=x.owner.getDynamicProperty('hm:turbineGasVisual'),v=x.world.getEntity(id);
    x.gasVisual.syncTurbineGas(x.owner,stats(),'steam',100,100);const set=v.setProperty;let writes=0;v.setProperty=(...args)=>{writes++;set(...args);};
    for(let i=0;i<20;i++)x.gasVisual.syncTurbineGas(x.owner,stats(),'steam',100,100);assert.equal(writes,0);
    const reload=load('gasTurbineGas.js',vm.createContext({...math,...visualConfig,world:x.world,system:x.gasSystem,Math,WeakMap}),['syncTurbineGas']);
    assert.equal(reload.syncTurbineGas(x.owner,stats(),'steam',100,100).id,id);
});
test('gas visuals disappear on controller break, interior edits and shared deactivation',()=>{
    for(const mode of ['break','interior','shared']){
        const x=setup(),id=x.owner.getDynamicProperty('hm:turbineGasVisual');
        if(mode==='break')x.handler.onPlayerBreak({block:x.block});
        if(mode==='interior')x.callbacks.playerPlaceBlock[0]({block:x.block});
        if(mode==='shared'){x.owner.setDynamicProperty('dorios:state','off');x.intervals[1]();}
        assert(!x.world.getEntity(id));
    }
});
test('a failed visual spawn is throttled and does not stop gas generation',()=>{
    const x=setup();x.gasVisual.removeTurbineGas(x.owner);const spawn=x.dimension.spawnEntity;let attempts=0;
    x.dimension.spawnEntity=(type,pos)=>{if(type==='utilitycraft:gas_turbine_gas'){attempts++;throw Error('Unloaded center');}return spawn(type,pos);};
    for(let i=0;i<20;i++)x.tick();assert.equal(attempts,1);assert(x.owner.energy.value>0);
    x.dimension.spawnEntity=spawn;x.gasSystem.currentTick=20;x.tick();assert(x.owner.getDynamicProperty('hm:turbineGasVisual'));
});


test('gas shell has six faces with axis-specific UV repetition and a fixed inset',()=>{
    const rp=path.resolve(__dirname,'../RP');
    const geometries=JSON.parse(fs.readFileSync(path.join(rp,'models/entity/gas_turbine_gas.geo.json'),'utf8'))['minecraft:geometry'];
    const controllers=JSON.parse(fs.readFileSync(path.join(rp,'render_controllers/gas_turbine_gas.json'),'utf8')).render_controllers;
    assert.equal(geometries.reduce((n,g)=>n+Object.keys(g.bones[0].cubes[0].uv).length,0),6);
    const expected={x:['v.gas_depth','v.gas_height'],y:['v.gas_width','v.gas_depth'],z:['v.gas_width','v.gas_height']};
    for(const [axis,scale]of Object.entries(expected)){
        const c=controllers['controller.render.utilitycraft.gas_turbine_gas_'+axis];assert.deepEqual(c.uv_anim.scale,scale);
        assert.equal(c.color,undefined);assert(c.textures[0].includes('v.gas_type * 65'));assert(c.textures[0].includes('math.clamp(v.gas_opacity, 0.0, 1.0)'));assert.deepEqual(c.uv_anim.offset,[.0625,.0625]);
    }
    const client=JSON.parse(fs.readFileSync(path.join(rp,'entity/gas_turbine_gas.json'),'utf8'))['minecraft:client_entity'].description;
    assert.deepEqual(gasDefinition.description.properties['utilitycraft:gas_type'],{type:'int',range:[0,Object.keys(visualConfig.TURBINE_GAS_VISUALS).length-1],default:0,client_sync:true});
    for(const texture of Object.values(client.textures))assert(fs.existsSync(path.join(rp,texture+'.png')));
    const mat=JSON.parse(fs.readFileSync(path.join(rp,'materials/entity.material'),'utf8')).materials['hm_turbine_gas:entity_alphablend'];
    assert.equal(mat.samplerStates[0].textureWrap,'Repeat');assert(mat['+defines'].includes('USE_UV_ANIM'));
    for(const size of[2,3,5,197]){
        const span=size-.125;near((size-span)/2,1/16);
        near((span*16)/span,16); // A repeated 16px tile occupies exactly one block.
    }
});

test('gas property failures remove the visual without interrupting the machine',()=>{
    const x=setup();x.gasVisual.removeTurbineGas(x.owner);const spawn=x.dimension.spawnEntity;
    x.dimension.spawnEntity=(type,pos)=>{const e=spawn(type,pos);if(type==='utilitycraft:gas_turbine_gas')e.properties.clear();return e;};
    assert.doesNotThrow(x.tick);for(let i=0;i<20;i++)x.tick();assert(x.owner.energy.value>0);
    assert(!x.owner.getDynamicProperty('hm:turbineGasVisual'));
});


test('gas PNGs preserve source colors and encode monotonic transparency for every density',()=>{
    const {decode}=require('../tools/gasTexturePng.cjs');
    const rp=path.resolve(__dirname,'../RP');
    const client=JSON.parse(fs.readFileSync(path.join(rp,'entity/gas_turbine_gas.json'),'utf8'))['minecraft:client_entity'].description;
    const controllers=JSON.parse(fs.readFileSync(path.join(rp,'render_controllers/gas_turbine_gas.json'),'utf8')).render_controllers;
    const aliases=[];
    for(const [gas,config]of Object.entries(visualConfig.TURBINE_GAS_VISUALS)){
        const source=decode(fs.readFileSync(path.resolve(rp,'../../UtilityCraft/RP',config.texture+'.png')));
        let previous=Buffer.alloc(source.pixels.length);
        for(let level=0;level<=64;level++){
            const alias=gas+'_'+level;aliases.push('Texture.'+alias);
            const frame=decode(fs.readFileSync(path.join(rp,client.textures[alias]+'.png')));
            assert.equal(frame.width,16);assert.equal(frame.height,16);
            for(let i=0;i<frame.pixels.length;i++){
                if(i%4!==3)assert.equal(frame.pixels[i],source.pixels[i]);
                else{
                    assert.equal(frame.pixels[i],Math.round(source.pixels[i]*level/64));
                    assert(frame.pixels[i]>=previous[i]);
                    if(level===64)assert.equal(frame.pixels[i],source.pixels[i],'Full opacity must preserve source alpha');
                }
            }
            previous=frame.pixels;
        }
    }
    for(const controller of Object.values(controllers))assert.deepEqual(controller.arrays.textures['array.gases'],aliases);
    const mat=JSON.parse(fs.readFileSync(path.join(rp,'materials/entity.material'),'utf8')).materials['hm_turbine_gas:entity_alphablend'];
    assert(!mat['+defines'].includes('ENABLE_CURRENT_ALPHA_MULTIPLY'));
});


test('client maps synchronized gas integers to the correct texture at every opacity level',()=>{
    const rp=path.resolve(__dirname,'../RP');
    const client=JSON.parse(fs.readFileSync(path.join(rp,'entity/gas_turbine_gas.json'),'utf8'))['minecraft:client_entity'].description;
    const controllers=JSON.parse(fs.readFileSync(path.join(rp,'render_controllers/gas_turbine_gas.json'),'utf8')).render_controllers;
    for(const type of Object.keys(visualConfig.TURBINE_GAS_VISUALS))for(let level=0;level<=64;level++){
        const properties={'utilitycraft:gas_type':Object.keys(visualConfig.TURBINE_GAS_VISUALS).indexOf(type),'utilitycraft:opacity':level/64,'utilitycraft:width':3,'utilitycraft:height':5,'utilitycraft:depth':7};
        const context=vm.createContext({v:{},q:{has_property:key=>key in properties,property:key=>properties[key]},math:{max:Math.max,ceil:Math.ceil,clamp:(x,a,b)=>Math.min(b,Math.max(a,x))}});
        for(const expression of client.scripts.pre_animation)vm.runInContext(expression,context);
        assert.equal(typeof context.v.gas_type,'number');
        for(const controller of Object.values(controllers)){
            context.array={gases:controller.arrays.textures['array.gases']};
            const selected=vm.runInContext(controller.textures[0],context);
            assert.equal(selected,'Texture.'+type+'_'+level);
        }
    }
    const missing=vm.createContext({v:{},q:{has_property:()=>false,property:()=>{throw Error('Missing property was read');}},math:{max:Math.max}});
    for(const expression of client.scripts.pre_animation)vm.runInContext(expression,missing);
    assert.equal(missing.v.gas_type,0);assert.equal(missing.v.gas_opacity,0);
});


test('gas particle speed follows the rotor, coasts down and avoids unchanged writes',()=>{
    const x=setup({gasType:'steam'});
    for(let i=0;i<20;i++)x.tick();
    const gas=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineGasVisual'));
    const rotor=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineRotor'));
    assert(gas.getProperty('utilitycraft:speed')>0);
    near(gas.getProperty('utilitycraft:speed'),rotor.getProperty('utilitycraft:speed'));
    const before=gas.getProperty('utilitycraft:speed');x.buttons.power.onPress({entity:x.owner});x.tick();
    assert(gas.getProperty('utilitycraft:speed')<before);
    near(gas.getProperty('utilitycraft:speed'),rotor.getProperty('utilitycraft:speed'));
    x.gasVisual.syncTurbineGas(x.owner,stats(),'steam',100,100,.5);
    const set=gas.setProperty;let writes=0;gas.setProperty=(...args)=>{writes++;set(...args);};
    for(let i=0;i<10;i++)x.gasVisual.syncTurbineGas(x.owner,stats(),'steam',100,100,.5);
    assert.equal(writes,0);
    x.gasVisual.syncTurbineGas(x.owner,stats(),'steam',100,100,0);assert.equal(gas.getProperty('utilitycraft:speed'),0);
});

test('gas streaks stay sparse, stop at rest and remain inside every supported interior',()=>{
    const rp=path.resolve(__dirname,'../RP'),read=file=>JSON.parse(fs.readFileSync(path.join(rp,file),'utf8'));
    const client=read('entity/gas_turbine_gas.json')['minecraft:client_entity'].description;
    const controller=read('animation_controllers/gas_turbine_flow.json').animation_controllers[client.animations.flow_controller];
    const animations=read('animations/gas_turbine_flow.animation.json').animations;
    const calc=(expr,v={},q={})=>vm.runInNewContext(expr,{v,q,math:{min:Math.min,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),cos:x=>Math.cos(x*Math.PI/180),sin:x=>Math.sin(x*Math.PI/180)}});
    for(const [index,type]of Object.keys(visualConfig.TURBINE_GAS_VISUALS).entries()){
        const alias='flow_'+type,animation=animations[client.animations[alias]],effect=read('particles/gas_turbine_'+type+'_flow.json').particle_effect,c=effect.components;
        assert.equal(client.particle_effects[alias],effect.description.identifier);
        assert.equal(animation.particle_effects['0.0'].bind_to_actor,undefined,'Use default actor binding; explicit true prevents animation loading');
        assert.equal(effect.description.basic_render_parameters.texture,'textures/particle/particles');
        const billboard=c['minecraft:particle_appearance_billboard'];
        assert.equal(billboard.facing_camera_mode,'lookat_xyz');
        assert.deepEqual(billboard.uv.flipbook.base_UV,[56,0]);
        assert.deepEqual(billboard.uv.flipbook.step_UV,[-8,0]);
        assert.equal(billboard.uv.flipbook.max_frame,8);
        assert.equal(billboard.size[0],billboard.size[1]);
        for(const value of c['minecraft:particle_appearance_tinting'].color.slice(0,3))assert(value>=0&&value<=1);
        for(const [speed,opacity,active]of [[0,1,false],[.02,1,false],[.5,0,false],[.5,.1,true],[4,1,true]]){
            const v={gas_type:index,gas_speed:speed,gas_opacity:opacity};
            const condition=controller.states.idle.transitions[index][alias];assert.equal(Boolean(calc(condition,v)),active);
            const advance=calc(animation.anim_time_update,v,{anim_time:0,delta_time:1});
            near(advance/animation.animation_length, Math.min(speed,1.5)*7.5);
        }
        assert.equal(c['minecraft:emitter_rate_instant'].num_particles,1);
        const life=c['minecraft:particle_lifetime_expression'].max_lifetime;assert(life<=.65);
        for(const width of[3,7,197])for(const height of[2,8,197])for(const depth of[3,11,197]){
            const props={'utilitycraft:speed':4,'utilitycraft:width':width,'utilitycraft:height':height,'utilitycraft:depth':depth};
            const v={};calc(animation.particle_effects['0.0'].pre_effect_script,v,{property:key=>props[key]});
            for(const random of[0,.5,1])for(const age of[0,.3,life]){
                Object.assign(v,{particle_random_1:random,particle_random_2:random,particle_random_3:random,particle_age:age});
                const [x,y,z]=c['minecraft:particle_motion_parametric'].relative_position.map(e=>calc(e,v));
                const margin=.125;assert(Math.abs(x)+margin<width/2);assert(Math.abs(z)+margin<depth/2);assert(y-margin>0&&y+margin<height);
            }
        }
    }
});


test('gas-specific flow limits reach 240 RPM with unchanged energy per mB',()=>{
    const limits={steam:4.5,heated_saline_coolant_gas:3.6};
    for(const [type,limit]of Object.entries(limits)){
        const fuel=math.TURBINE_GASES[type];near(math.getTurbineMaxRate(4.5,type),limit);
        for(const fraction of [.1,.5,1,2]){
            const target=Math.min(1,fraction);
            const r=math.simulateGasTurbine({ticks:200,enabled:true,rate:limit*fraction,maxRate:4.5,impulse:fuel.impulse,speed:target,gas:100000,energySpace:1e12,energyPerMb:fuel.energy});
            near(r.speed*math.GAS_TURBINE.rotorRpm,240*target);near(r.flowRate,limit*target);
            assert.equal(r.energy,r.consumed*fuel.energy);near(r.consumed+r.progress,limit*target*200);
        }
    }
});

test('selected flow and impulse determine steady RPM, stored quantity does not',()=>{
    const base={ticks:1000,enabled:true,rate:1,maxRate:4.5,energySpace:1e12,energyPerMb:256};
    for(const fuel of Object.values(math.TURBINE_GASES)){
        const a=math.simulateGasTurbine({...base,impulse:fuel.impulse,gas:10000});
        const b=math.simulateGasTurbine({...base,impulse:fuel.impulse,gas:1000000});
        near(a.speed,b.speed);near(a.speed,1*fuel.impulse/4.5);
    }
});

test('flow changes and shutdown preserve scheduler-independent consumption and RPM',()=>{
    for(const impulse of [1,1.25,1.5]){
        const run=step=>{let speed=0,progress=0,gas=100000,energy=0;
            for(const [rate,enabled,duration]of [[.5,true,160],[3,true,160],[.25,true,160],[.25,false,80],[1,true,80]])for(let t=0;t<duration;t+=step){
                const r=math.simulateGasTurbine({ticks:step,enabled,rate,maxRate:4.5,impulse,speed,progress,gas,energySpace:1e12-energy,energyPerMb:256});
                assert(r.consumed<=Math.ceil(rate*step),'Consumption exceeds selected flow');
                speed=r.speed;progress=r.progress;gas-=r.consumed;energy+=r.energy;
            }return{speed,progress,gas,energy};
        };
        const expected=run(4);for(const step of [20,80])for(const [key,value]of Object.entries(run(step)))near(value,expected[key]);
    }
});

test('partial-speed gas and energy exhaustion are consistent across tick batches',()=>{
    for(const scarceGas of [true,false]){
        const run=step=>{let speed=0,progress=0,gas=scarceGas?13:10000,energy=0;const cap=scarceGas?1e9:13*1536;
            for(let t=0;t<160;t+=step){const r=math.simulateGasTurbine({ticks:step,enabled:true,rate:1,maxRate:4.5,impulse:1.25,speed,progress,gas,energySpace:cap-energy,energyPerMb:1536});speed=r.speed;progress=r.progress;gas-=r.consumed;energy+=r.energy;}
            return{speed,progress,gas,energy};
        };
        const expected=run(4);assert.equal(expected.energy,13*1536);for(const step of [20,80])for(const [key,value]of Object.entries(run(step)))near(value,expected[key]);
    }
});

test('changing gas clamps saved rate and updates the Control maximum',()=>{
    const x=setup({gasType:'steam',ui:true});x.buttons.clear.onPress({entity:x.owner});x.buttons.key_7.onPress({entity:x.owner});x.buttons.apply.onPress({entity:x.owner});near(x.state().rate,4.5);
    x.owner.gas.type='heated_saline_coolant_gas';x.tick();near(x.state().rate,3.6);assert(x.owner.items.get(25).nameTag.includes('3.60 mB/t'));
    x.owner.gas.type='steam';x.buttons.clear.onPress({entity:x.owner});x.buttons.key_7.onPress({entity:x.owner});x.buttons.apply.onPress({entity:x.owner});near(x.state().rate,4.5);
});

test('legacy saved RPM migrates once and native rotation never exceeds 240 RPM',()=>{
    const x=setup();x.owner.setDynamicProperty('hm:gasTurbine',JSON.stringify({enabled:true,rate:1,speed:.8,rotorMultiplier:1.25,progress:.4}));
    x.runtimes.delete(x.owner.id);const state=x.state();near(state.speed*240,.8*1.25*150);assert.equal(state.version,2);near(state.progress,.4);assert.equal(state.rotorMultiplier,undefined);
    x.owner.setDynamicProperty('hm:gasTurbine',JSON.stringify(state));near(x.state().speed,state.speed);
    x.rotor.setTurbineRotorSpeed(x.owner,stats(),4);const rotor=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineRotor'));assert.equal(rotor.getProperty('utilitycraft:speed'),1);
    const client=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../RP/entity/gas_turbine_rotor.json'),'utf8'))['minecraft:client_entity'].description;
    assert(client.scripts.pre_animation.some(e=>e.includes('v.turbine_speed * '+(math.GAS_TURBINE.rotorRpm*6).toFixed(1))));
});


test('formation reports the gas-specific maximum to the activating player',()=>{
    const x=setup({gasType:'heated_saline_coolant_gas'}),messages=[];
    assert.doesNotThrow(()=>x.api.activateTurbine({entity:x.owner,components:{air:17,energy_cell:1},structure:{bounds},energyCap:4e6,player:{sendMessage:m=>messages.push(m)}}));
    assert(messages.some(m=>m.includes('Max rate: 3.60 mB/t')));
});


test('removed combustible gases preserve stored gas, produce no energy and allow draining',()=>{
 for(const gasType of ['hydrogen_gas','methane_gas']){
  const x=setup({gasType,ui:true});x.owner.setDynamicProperty('hm:gasTurbine',JSON.stringify({version:2,enabled:true,rate:1,speed:1,progress:.7,fuelType:gasType}));
  x.runtimes.delete(x.owner.id);x.tick();assert.equal(x.owner.gas.value,200);assert.equal(x.owner.energy.value,0);assert(x.state().speed<1);assert(x.owner.items.get(1).nameTag.includes('Unsupported Gas'));assert(x.ioConfig.gases.anyOutputIndices.includes(0));
 }
 assert.deepEqual(Object.keys(math.TURBINE_GASES),['steam','heated_saline_coolant_gas']);
});


test('visual registry covers gas tank textures from both packs independently of generation',()=>{
 const hm=path.resolve(__dirname,'..'),uc=path.resolve(hm,'../UtilityCraft');
 for(const pack of[uc,hm]){
  const dir=path.join(pack,'RP/entity/gases');if(!fs.existsSync(dir))continue;
  for(const file of fs.readdirSync(dir).filter(n=>n.startsWith('gas_tank_')&&n.endsWith('.json'))){
   const d=JSON.parse(fs.readFileSync(path.join(dir,file)))['minecraft:client_entity'].description;
   const type=d.identifier.replace('utilitycraft:gas_tank_','');assert(visualConfig.TURBINE_GAS_VISUALS[type],type+' has no turbine visual');assert.equal(visualConfig.TURBINE_GAS_VISUALS[type].texture,d.textures.default);
  }
 }
 for(const gasType of [...Object.keys(visualConfig.TURBINE_GAS_VISUALS),'addon_unknown_gas']){
  const x=setup({gasType});for(let i=0;i<20;i++)x.tick();
  const visual=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineGasVisual'));assert(visual);assert(visual.getProperty('utilitycraft:opacity')>0);
  assert.equal(visual.getProperty('utilitycraft:gas_type'),Math.max(0,Object.keys(visualConfig.TURBINE_GAS_VISUALS).indexOf(gasType)));assert.equal(x.owner.gas.type,gasType);
  if(!math.TURBINE_GASES[gasType]){assert.equal(x.owner.energy.value,0);assert.equal(x.owner.gas.value,200);assert.equal(x.state().speed,0);}
 }
});
test('unknown-gas fallback caches the resolved visual and empty contents remain invisible',()=>{
 const x=setup({gasType:'addon_unknown_gas'}),v=x.world.getEntity(x.owner.getDynamicProperty('hm:turbineGasVisual'));
 x.gasVisual.syncTurbineGas(x.owner,stats(),'addon_unknown_gas',100,100);
 const set=v.setProperty;let writes=0;v.setProperty=(...args)=>{writes++;set(...args);};
 for(let i=0;i<10;i++)x.gasVisual.syncTurbineGas(x.owner,stats(),'different_unknown_gas',100,100);assert.equal(writes,0);
 x.gasVisual.syncTurbineGas(x.owner,stats(),'different_unknown_gas',0,100);assert.equal(v.getProperty('utilitycraft:opacity'),0);
 assert.equal(x.gasVisual.getTurbineGasOpacity('empty',100,100),0);
});


test('Turbine shares button state, restores progress after cache loss and keeps stores out of cache',()=>{
 const x=setup();x.tick();const data=x.state(),saved=JSON.parse(x.owner.getDynamicProperty('hm:gasTurbine'));
 assert.strictEqual(x.api.getTurbineState({...x.owner}),data);assert.equal(data.entity,undefined);assert.equal(data.gas,undefined);assert.equal(saved.stats,undefined);
 x.runtimes.clear();const restored=x.state();assert.notStrictEqual(restored,data);for(const key of ['enabled','rate','speed','progress','fuelType'])assert.equal(restored[key],saved[key]);
 x.buttons.power.onPress({entity:x.owner});assert.equal(restored.enabled,false);assert.equal(JSON.parse(x.owner.getDynamicProperty('hm:gasTurbine')).enabled,false);
 const rotorId=x.owner.getDynamicProperty('hm:turbineRotor');x.tick();assert.equal(x.owner.getDynamicProperty('hm:turbineRotor'),rotorId);
});
