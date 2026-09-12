const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
class ItemStack {constructor(typeId){assert(!/NaN|Infinity/.test(typeId));this.typeId=typeId;}}
const Constants={EMPTY_FLUID_TYPE:'empty',EMPTY_GAS_TYPE:'empty',EMPTY_FLUID_BAR_ITEM_ID:'utilitycraft:empty_fluid',EMPTY_GAS_BAR_ITEM_ID:'utilitycraft:empty_gas',FLUID_BAR_FRAME_COUNT:48,GAS_BAR_FRAME_COUNT:48,ENERGY_BAR_FRAME_COUNT:48,ENERGY_BAR_ITEM_PREFIX:'utilitycraft:energy_'};
function load(file,name){const ctx=vm.createContext({ItemStack,Constants,DoriosLib:{text:{formatIdentifier:s=>s}}});const source=fs.readFileSync(path.join(root,'BP/scripts/DoriosCore/machinery',file),'utf8').replace(/^import .*;\r?$/gm,'').replace('export class ','class ');vm.runInContext(source+'\nthis.Storage='+name,ctx);return ctx.Storage;}
for(const [file,name,type] of [['fluidStorage.js','FluidStorage','lava'],['gasStorage.js','GasStorage','steam']]){
 const Storage=load(file,name);
 for(const [amount,capacity,frame,percent]of [[0,0,0,'0.00'],[50,0,0,'0.00'],[0,100,0,'0.00'],[50,100,24,'50.00'],[100,100,48,'100.00'],[200,100,48,'100.00'],[-1,100,0,'0.00']])test(name+' display amount='+amount+' capacity='+capacity,()=>{let item;const storage=Object.create(Storage.prototype);Object.defineProperties(storage,{entity:{value:{getComponent:()=>({container:{setItem:(slot,value)=>item=value}})}},shouldUpdateUI:{value:true},cap:{value:capacity,writable:true},get:{value:()=>amount},getCap:{value:()=>capacity},getType:{value:()=>type}});storage.display(0);assert(item.typeId.endsWith('_'+String(frame).padStart(2,'0')),item.typeId);assert(item.nameTag.includes('Percentage: '+percent+'%'),item.nameTag);if(name==='EnergyStorage')assert.equal(storage.getPercent(),Number(percent));});
}
