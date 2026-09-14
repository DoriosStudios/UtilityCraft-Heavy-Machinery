const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {test}=require('node:test');
const root=path.resolve(__dirname,'..');const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const formatter = read('BP/scripts/DoriosCore/machinery/energyStorage.js').match(/static formatEnergyToText\(value\) \{[\s\S]*?\n  \}/)[0];
const resourceLore = read('BP/scripts/DoriosCore/machinery/resourceLore.js').replace(/^import[^\n]*\n/gm, '').replace(/export /g, '') + '\n';
const {ItemEnergyStorage}=vm.runInNewContext('class EnergyStorage {'+formatter+'}\n'+resourceLore+read('BP/scripts/DoriosCore/machinery/itemEnergyStorage.js').replace(/^import[^\n]*\n/gm,'').replace(/export /g,'')+'\n({ItemEnergyStorage})');
function stack(tagged=true,damage=10100,max=10200){return {typeId:'otheraddon:battery',durability:{damage,maxDurability:max},lore:[],hasTag:t=>tagged&&t===ItemEnergyStorage.TAG,getComponent(){return this.durability;},getLore(){return this.lore;},setLore(v){this.lore=v;},clone(){const v=stack(tagged,this.durability.damage,this.durability.maxDurability);v.lore=[...this.lore];return v;}};}
function setup(input,stored=640000000){
 let handler,failSave=false,writes=0;const slots=new Map([[3,input]]);
 const container={getItem:i=>slots.get(i)?.clone(),setItem(i,s){writes++;if(failSave)throw Error('save failed');slots.set(i,s.clone());}};
 const energy={amount:stored,get(){return this.amount;},consume(n){if(n>this.amount)return 0;this.amount-=n;return n;},add(n){this.amount+=n;}};
 const machine={valid:true,container,energy,processingInterval:4,rate:12800,boosts:{speed:1,consumption:1},entity:{},off(){},on(){},displayEnergy(){},showWarning(s){this.status=s;},showStatus(s){this.status=s;}};
 const context={ItemEnergyStorage,Machine:function(){return machine;},registerIOInterface(){},DoriosLib:{registry:{blockComponent(id,h){handler=h;}},item:{durability:{getInfo(s){return {max:s.durability.maxDurability,remaining:s.durability.maxDurability-s.durability.damage};},repair(s,n){s.durability.damage-=n;return n;}}}}};
 const source=read('BP/scripts/machinery/machines/reinforcedInductionAnvil.js').replace(/^import[^\n]*\r?\n/gm,'').replace(/export /g,'');
 vm.runInNewContext(source,context);
 return {machine,container,energy,get writes(){return writes;},tick(){handler.onTick({block:{}},{params:{}});},charge:b=>context.chargeItem(container,energy,b),fail(){failSave=true;}};
}
test('charges an unknown tagged item using its durability capacity, keeping fractional DE in the machine',()=>{
 const h=setup(stack(),250001);assert.equal(h.charge(1e6),200000);assert.equal(h.energy.amount,50001);
 assert.equal(new ItemEnergyStorage(h.container.getItem(3)).get(),200000);
 assert.equal(h.charge(1e6),0);assert.equal(h.energy.amount,50001);
});
test('charging respects shared rate, energy conservation and the full-item cap',()=>{
 const h=setup(stack());h.tick();assert.equal(new ItemEnergyStorage(h.container.getItem(3)).get(),4e6);assert.equal(h.energy.amount,636e6);
 h.container.setItem(3,stack(true,101));h.tick();assert.equal(h.energy.amount,635900000);assert.equal(h.container.getItem(3).durability.damage,100);
 h.tick();assert.equal(h.machine.status,'Fully Charged');assert.equal(h.energy.amount,635900000);
});
test('a failed slot write refunds the machine without updating the original item',()=>{
 const h=setup(stack());h.fail();assert.throws(()=>h.charge(1e6),/save failed/);assert.equal(h.energy.amount,640e6);assert.equal(new ItemEnergyStorage(h.container.getItem(3)).get(),0);
});
test('normal equipment uses fast repair instead of the energy-container formula',()=>{
 const h=setup(stack(false,1500,2000));h.tick();assert.equal(h.container.getItem(3).durability.damage,220);assert.equal(h.energy.amount,640e6-12800);assert.equal(h.machine.status,'Repairing');
});
test('block, UI and both crafting routes register the reinforced machine',()=>{
 const name='reinforced_induction_anvil';const b=JSON.parse(read('BP/blocks/machinery/machines/'+name+'.json'))['minecraft:block'];
 assert.equal(b.components['utilitycraft:'+name].machine.energy_cap,640e6);assert.equal(b.components['utilitycraft:'+name].entity.inventory_size,6);
 const ui=JSON.parse(read('RP/ui/'+name+'.json'));assert.ok(ui.utility_panel);assert.ok(JSON.parse(read('RP/ui/_ui_defs.json')).ui_defs.includes('ui/'+name+'.json'));
 assert.ok(read('RP/ui/chest_screen.json').includes(name+'.utility_panel'));
 const r=JSON.parse(read('BP/recipes/machinery/machines/'+name+'.json'))['minecraft:recipe_shaped'];const slots=[...r.pattern.join('')].map(c=>r.key[c].item.split(':')[1]).join(',');assert.ok(read('BP/scripts/config/recipes/crafter.js').includes(slots));
});

test('full or unpowered inputs never receive redundant slot writes',()=>{
 for(const input of [stack(true,100),stack(false,0,2000)]){
  const h=setup(input);for(let i=0;i<5;i++)h.tick();
  assert.equal(h.writes,0);assert.equal(h.energy.amount,640e6);
  assert.equal(h.machine.status,input.hasTag(ItemEnergyStorage.TAG)?'Fully Charged':'Fully Repaired');
 }
 const full=setup(stack(true,100));assert.equal(full.charge(1e6),0);assert.equal(full.writes,0);
 const empty=setup(stack(),99999);empty.tick();assert.equal(empty.writes,0);assert.equal(empty.energy.amount,99999);
 const finishing=setup(stack(true,101));finishing.tick();assert.equal(finishing.writes,1);
 for(let i=0;i<5;i++)finishing.tick();assert.equal(finishing.writes,1);
});
