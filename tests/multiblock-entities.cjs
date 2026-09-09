const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const folder = process.env.DORIOS_TEST_CORE || path.resolve(__dirname,'../BP/scripts/DoriosCore/multiblock');
const bounds = {min:{x:0,y:0,z:0},max:{x:4,y:4,z:4}};
function setup() {
  const context = vm.createContext({JSON});
  const source = file => fs.readFileSync(path.join(folder,file),'utf8').replace(/^import .*;\r?$/gm,'').replace(/\bexport /g,'');
  const constants = fs.readFileSync(path.join(folder,'constants.js'),'utf8');
  const names = [...constants.matchAll(/export const (\w+)/g)].map(m=>m[1]);
  vm.runInContext(source('constants.js')+'\nthis.Constants={'+names.join(',')+'};',context);
  const pending=[];
  context.system={run(fn){pending.push(fn);},runTimeout(fn){pending.push(fn);}};
  context.isLinkNode=()=>false;context.parseLinkNodeTag=()=>undefined;context.setTaggedBlocksWaterlogged=()=>{};
  vm.runInContext(source('entityManager.js')+'\nthis.EntityManager=EntityManager;',context);
  vm.runInContext(source('deactivationManager.js')+'\nthis.DeactivationManager=DeactivationManager;',context);
  const dimension={direct:[],nearby:[],getEntitiesAtBlockLocation(){return this.direct;},getEntities(){return this.nearby;}};
  const block={dimension,location:{x:1,y:1,z:1},permutation:{hasTag:()=>true}};
  function actor(typeId,family=false){
    const data=new Map([[context.Constants.STATE_PROPERTY_ID,context.Constants.ACTIVE_STATE_VALUE],[context.Constants.BOUNDS_PROPERTY_ID,JSON.stringify(bounds)]]);
    return {typeId,isValid:true,dimension,events:[],writes:[],data,
      getComponent(){return {hasTypeFamily:name=>family&&name===context.Constants.MULTIBLOCK_FAMILY};},
      getDynamicProperty:key=>data.get(key),setDynamicProperty(key,value){this.writes.push(key);data.set(key,value);},
      triggerEvent(event){this.events.push(event);},getTags:()=>[],remove(){this.removed=true;},
    };
  }
  const controller=actor('utilitycraft:gas_turbine',true),player=actor('minecraft:player'),item=actor('minecraft:item'),rotor=actor('utilitycraft:gas_turbine_rotor');
  dimension.direct=[player,item,rotor,controller];dimension.nearby=[player,item,rotor,controller];
  return {context,dimension,block,actor,controller,player,item,rotor,pending,E:context.EntityManager,D:context.DeactivationManager};
}

test('player/item/rotor before the controller cannot win either lookup',()=>{
  const x=setup();assert.equal(x.E.getEntityFromBlock(x.block),x.controller);
  if(x.E.getControllerEntityFromBlock)assert.equal(x.E.getControllerEntityFromBlock(x.block),x.controller);
});
test('deactivation hides only the owning controller and preserves unrelated entities',()=>{
  const x=setup();assert.equal(x.D.deactivateMultiblock(x.block),x.controller);
  assert.deepEqual(x.controller.events,['utilitycraft:hide']);
  assert.equal(x.controller.data.get(x.context.Constants.STATE_PROPERTY_ID),x.context.Constants.INACTIVE_STATE_VALUE);
  for(const e of[x.player,x.item,x.rotor]){assert.deepEqual(e.events,[]);assert.deepEqual(e.writes,[]);}
});
test('non-controllers with matching bounds still cannot be deactivated',()=>{
  const x=setup();x.dimension.direct=[x.player,x.item,x.rotor];x.dimension.nearby=x.dimension.direct;
  assert.equal(x.D.deactivateMultiblock(x.block),undefined);
  for(const e of x.dimension.direct)assert.deepEqual(e.events,[]);
});
test('the deactivation boundary rejects a bad resolver result and direct callers',()=>{
  const x=setup();x.E.getEntityFromBlock=()=>x.player;
  assert.equal(x.D.deactivateMultiblock(x.block),undefined);
  if(x.D.deactivateEntity)for(const e of[x.player,x.item,x.rotor])assert.equal(x.D.deactivateEntity(e),undefined);
  assert.deepEqual(x.player.events,[]);assert.deepEqual(x.player.writes,[]);
});
test('invalid controllers are skipped without accessing their components',()=>{
  const x=setup();x.controller.isValid=false;x.controller.getComponent=()=>{throw Error('Invalid entity accessed');};
  assert.equal(x.D.deactivateMultiblock(x.block),undefined);
});
test('breaking a block cannot remove the player or a visual rotor',()=>{
  const x=setup();x.dimension.direct=[x.player,x.rotor];x.dimension.nearby=x.dimension.direct;
  assert.equal(x.D.handleBreakController(x.block),undefined);assert.equal(x.pending.length,0);
});
test('fallback ownership ignores malformed bounds and unrelated controllers',()=>{
  const x=setup();x.dimension.direct=[x.player];
  const invalid=x.actor('utilitycraft:thermo_reactor',true),outside=x.actor('utilitycraft:nuclear_reactor',true);
  invalid.data.set(x.context.Constants.BOUNDS_PROPERTY_ID,'broken');outside.data.set(x.context.Constants.BOUNDS_PROPERTY_ID,JSON.stringify({min:{x:20,y:20,z:20},max:{x:24,y:24,z:24}}));
  x.dimension.nearby=[invalid,outside,x.controller];assert.equal(x.E.getEntityFromBlock(x.block),x.controller);
});
