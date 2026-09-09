// Rebuild visual properties and texture selection after changing TURBINE_GAS_VISUALS.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root,'BP/scripts/machinery/generators/gasTurbineVisuals.js'),'utf8').replace(/\bexport /g,'')+';this.gases=TURBINE_GAS_VISUALS;this.defaultGas=DEFAULT_TURBINE_GAS_VISUAL;',context);
const gases=Object.entries(context.gases);
const {decode,encode}=require('./gasTexturePng.cjs');
const opacitySteps=64, textures={}, textureArray=[], particleColors={};
// Alpha lives in the PNG, rather than relying on renderer-specific entity tint.
const sourceRoot=process.env.UC_RESOURCE_PACK || path.resolve(root,'../UtilityCraft/RP');
for(const [key,value] of gases){
    const localSource=path.join(root,'RP',value.texture+'.png');
    const source=decode(fs.readFileSync(fs.existsSync(localSource)?localSource:path.join(sourceRoot,value.texture+'.png')));
    if(source.width!==16||source.height!==16)throw Error('Expected 16x16 gas sprite: '+key);
    // Tint the vanilla falling-dust sprite with this gas's existing palette.
    const rgb=[0,0,0];let weight=0;
    for(let i=0;i<source.pixels.length;i+=4){const alpha=source.pixels[i+3]/255;weight+=alpha;for(let c=0;c<3;c++)rgb[c]+=source.pixels[i+c]*alpha;}
    particleColors[key]=rgb.map(value=>weight?Math.round(value/weight/255*10000)/10000:1);
    for(let level=0;level<=opacitySteps;level++){
        const alias=key+'_'+level, texture='textures/entity/gas_turbine_gas/'+alias;
        const pixels=Buffer.from(source.pixels);
        for(let i=3;i<pixels.length;i+=4)pixels[i]=Math.round(source.pixels[i]*level/opacitySteps);
        const file=path.join(root,'RP',texture+'.png');fs.mkdirSync(path.dirname(file),{recursive:true});
        fs.writeFileSync(file,encode({...source,pixels}));
        textures[alias]=texture;textureArray.push('Texture.'+alias);
    }
}
if(!gases.length||gases.length>16)throw Error('The gas visual supports 1-16 gas types.');
const write=(file,data)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify(data,null,4)+'\n');};
const visual=JSON.parse(fs.readFileSync(path.join(root,'BP/entities/gas_turbine_rotor.json'),'utf8'));
const entity=visual['minecraft:entity'];entity.description.identifier='utilitycraft:gas_turbine_gas';
entity.description.properties=Object.fromEntries(['width','height','depth'].map(key=>['utilitycraft:'+key,{type:'int',range:[1,197],default:1,client_sync:true}]));
entity.description.properties['utilitycraft:gas_type']={type:'enum',values:gases.map(([key])=>key),default:context.defaultGas,client_sync:true};
entity.description.properties['utilitycraft:opacity']={type:'float',range:[0,1],default:0,client_sync:true};
entity.description.properties['utilitycraft:speed']={type:'float',range:[0,4],default:0,client_sync:true};
entity.components['minecraft:type_family'].family=['inanimate','utilitycraft:gas_turbine_gas_visual'];
write('BP/entities/gas_turbine_gas.json',visual);
// Keep explicit float literals, matching the working rotor entity declaration.
const bp=path.join(root,'BP/entities/gas_turbine_gas.json');let text=fs.readFileSync(bp,'utf8');
text=text.replace(/("utilitycraft:opacity": \{[\s\S]*?"range": \[\s*)0,([\s]*)1([\s]*\],[\s]*"default": )0,/,'$10.0,$21.0$30.0,');text=text.replace(/("utilitycraft:speed": \{[\s\S]*?"range": \[\s*)0,([\s]*)4([\s]*\],[\s]*"default": )0,/,'$10.0,$24.0$30.0,');fs.writeFileSync(bp,text);
const groups={x:['west','east'],y:['up','down'],z:['north','south']};
const geometry=[];const render={};
for(const [axis,faces]of Object.entries(groups)){
    geometry.push({description:{identifier:'geometry.utilitycraft.gas_turbine_gas_'+axis,texture_width:16,texture_height:16,visible_bounds_width:202,visible_bounds_height:202,visible_bounds_offset:[0,99,0]},bones:[{name:'gas',pivot:[0,0,0],cubes:[{origin:[-8,0,-8],size:[16,16,16],uv:Object.fromEntries(faces.map(face=>[face,{uv:[0,0],uv_size:[16,16]}]))}]}]});
    const scales=axis==='x'?['v.gas_depth','v.gas_height']:axis==='y'?['v.gas_width','v.gas_depth']:['v.gas_width','v.gas_height'];
    render['controller.render.utilitycraft.gas_turbine_gas_'+axis]={arrays:{textures:{'array.gases':textureArray}},geometry:'Geometry.'+axis,materials:[{'*':'Material.default'}],textures:['array.gases[v.gas_type * 65 + math.ceil(math.clamp(v.gas_opacity, 0.0, 1.0) * 64)]'],part_visibility:[{'*':'v.gas_opacity > 0.0'}],uv_anim:{offset:[0.0625,0.0625],scale:scales}};
}
write('RP/models/entity/gas_turbine_gas.geo.json',{format_version:'1.12.0','minecraft:geometry':geometry});
write('RP/render_controllers/gas_turbine_gas.json',{format_version:'1.8.0',render_controllers:render});
write('RP/animations/gas_turbine_gas.animation.json',{format_version:'1.8.0',animations:{'animation.utilitycraft.gas_turbine.gas':{loop:true,bones:{gas:{position:[0,1,0],scale:['v.gas_width','v.gas_height','v.gas_depth']}}}}});
const scripts={initialize:['v.gas_width = 0.0;','v.gas_height = 0.0;','v.gas_depth = 0.0;','v.gas_type = 0.0;','v.gas_opacity = 0.0;'],pre_animation:[],animate:['gas']};
for(const name of['width','height','depth'])scripts.pre_animation.push("v.gas_"+name+" = q.has_property('utilitycraft:"+name+"') ? math.max(0.0, q.property('utilitycraft:"+name+"') - 0.125) : 0.0;");
// Enum properties return their string value in Molang, not their array index.
const gasIndex=gases.map(([key],index)=>"q.property('utilitycraft:gas_type') == '"+key+"' ? "+index+" : ").join('')+'0';
scripts.pre_animation.push("v.gas_type = q.has_property('utilitycraft:gas_type') ? ("+gasIndex+") : 0.0;");
scripts.pre_animation.push("v.gas_speed = q.has_property('utilitycraft:speed') ? q.property('utilitycraft:speed') : 0.0;");
scripts.pre_animation.push("v.gas_opacity = q.has_property('utilitycraft:opacity') ? q.property('utilitycraft:opacity') : 0.0;");

const particleAnimations={},particleEffects={},states={idle:{transitions:[]}};
const flowAnimations={gas:'animation.utilitycraft.gas_turbine.gas',flow_controller:'controller.animation.utilitycraft.gas_turbine.flow'};
const running='v.gas_speed > 0.02 && v.gas_opacity > 0.0';
for(const [index,[key]]of gases.entries()){
    const alias='flow_'+key, animation='animation.utilitycraft.gas_turbine.'+alias;
    particleEffects[alias]='utilitycraft:gas_turbine_'+key+'_flow';flowAnimations[alias]=animation;
    states.idle.transitions.push({[alias]:running+' && v.gas_type == '+index});
    states[alias]={animations:[alias],transitions:[{idle:'!('+running+') || v.gas_type != '+index}]};
    // Particle effects bind to the actor by default; explicit true is rejected by Bedrock.
    particleAnimations[animation]={loop:true,animation_length:0.4,anim_time_update:'q.anim_time + q.delta_time * math.clamp(v.gas_speed, 0.0, 1.5) * 3.0',particle_effects:{'0.0':{effect:alias,pre_effect_script:"v.flow_speed = math.clamp(q.property('utilitycraft:speed'), 0.0, 2.0); v.flow_radius = math.min(q.property('utilitycraft:width'), q.property('utilitycraft:depth')) * 0.5 - 0.35; v.flow_height = q.property('utilitycraft:height');"}}};
    write('RP/particles/gas_turbine_'+key+'_flow.json',{format_version:'1.10.0',particle_effect:{description:{identifier:particleEffects[alias],basic_render_parameters:{material:'particles_blend',texture:'textures/particle/particles'}},components:{
        'minecraft:emitter_local_space':{position:true,rotation:false},
        'minecraft:emitter_rate_instant':{num_particles:1},
        'minecraft:emitter_lifetime_once':{active_time:0.01},
        'minecraft:emitter_shape_point':{offset:[0,0,0]},
        'minecraft:particle_lifetime_expression':{max_lifetime:0.65},
        'minecraft:particle_motion_parametric':{relative_position:[
            'v.flow_radius * (0.7 + 0.3 * v.particle_random_2) * math.cos(v.particle_random_1 * 360.0 - v.particle_age * v.flow_speed * 160.0)',
            '0.3 + v.particle_random_3 * (v.flow_height - 0.6) + v.particle_age * 0.08',
            'v.flow_radius * (0.7 + 0.3 * v.particle_random_2) * math.sin(v.particle_random_1 * 360.0 - v.particle_age * v.flow_speed * 160.0)'
        ],rotation:'v.particle_random_4 * 360.0'},
        'minecraft:particle_appearance_billboard':{size:['0.075 + v.particle_random_3 * 0.045','0.075 + v.particle_random_3 * 0.045'],facing_camera_mode:'lookat_xyz',uv:{texture_width:128,texture_height:128,flipbook:{base_UV:[56,0],size_UV:[8,8],step_UV:[-8,0],frames_per_second:8,max_frame:8,stretch_to_lifetime:true}}},
        'minecraft:particle_appearance_tinting':{color:[...particleColors[key],'0.75 * math.clamp(v.particle_age / 0.1, 0.0, 1.0) * math.clamp((0.65 - v.particle_age) / 0.2, 0.0, 1.0)']}
    }}});
}
write('RP/animations/gas_turbine_flow.animation.json',{format_version:'1.8.0',animations:particleAnimations});
write('RP/animation_controllers/gas_turbine_flow.json',{format_version:'1.10.0',animation_controllers:{'controller.animation.utilitycraft.gas_turbine.flow':{initial_state:'idle',states}}});
scripts.animate.push('flow_controller');

write('RP/entity/gas_turbine_gas.json',{format_version:'1.10.0','minecraft:client_entity':{description:{identifier:'utilitycraft:gas_turbine_gas',materials:{default:'hm_turbine_gas'},textures,geometry:Object.fromEntries(Object.keys(groups).map(axis=>[axis,'geometry.utilitycraft.gas_turbine_gas_'+axis])),animations:flowAnimations,particle_effects:particleEffects,scripts,render_controllers:Object.keys(render)}}});
const materialsPath=path.join(root,'RP/materials/entity.material');
const materials=fs.existsSync(materialsPath)?JSON.parse(fs.readFileSync(materialsPath,'utf8')):{materials:{version:'1.0.0'}};
materials.materials['hm_turbine_gas:entity_alphablend']={'+defines':['USE_UV_ANIM'],'+states':['DisableDepthWrite'],'samplerStates':[{'samplerIndex':0,textureFilter:'Point',textureWrap:'Repeat'}]};
write('RP/materials/entity.material',materials);
console.log('Built gas shell: six faces, three UV orientations, 65 baked alpha levels per gas.');
