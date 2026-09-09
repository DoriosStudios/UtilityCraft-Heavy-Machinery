// Rebuild the native Bedrock rotor assets: node tools/generateGasTurbineRotor.cjs
// Flat steel palette from textures/blocks/multiblock/steel/steel_plated_block.png.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
const writeJSON = (file, value) => fs.writeFileSync(path.join(root,file), JSON.stringify(value,null,4)+'\n');
const round = value => Math.round(value*1e6)/1e6;
const face = (x,y,w,h) => ({uv:[x,y],uv_size:[w,h]});
const metalUV = () => Object.fromEntries(['north','south','east','west','up','down'].map(side=>[side,face(side==='up'?24:16,0,8,32)]));
const bones = [
    {name:'rotor',pivot:[0,0,0]},
    {name:'shaft',parent:'rotor',pivot:[0,0,0],cubes:[{origin:[-1,0,-1],size:[2,16,2],uv:metalUV()}]},
    {name:'lower_bearing',parent:'rotor',pivot:[0,0,0],cubes:[{origin:[-1.75,0,-1.75],size:[3.5,2.5,3.5],uv:metalUV()}]},
    {name:'upper_bearing',parent:'rotor',pivot:[0,0,0],cubes:[{origin:[-1.75,0,-1.75],size:[3.5,2.5,3.5],uv:metalUV()}]},
    {name:'blades',parent:'rotor',pivot:[0,0,0]},
];
// Two opposing half-cylinder scoops make an S in top view. Eight thin native
// cubes per scoop approximate the curve without experimental mesh features.
for(let blade=0;blade<2;blade++){
    const cubes=[];
    for(let segment=0;segment<8;segment++){
        const a=segment*Math.PI/8,b=(segment+1)*Math.PI/8,r=6.9;
        const p=[r+r*Math.cos(a),r*Math.sin(a)],q=[r+r*Math.cos(b),r*Math.sin(b)];
        const x=(p[0]+q[0])/2,z=(p[1]+q[1])/2;
        const width=Math.hypot(q[0]-p[0],q[1]-p[1])+0.08;
        cubes.push({origin:[round(x-width/2),0,round(z-0.3)],size:[round(width),16,0.6],pivot:[round(x),0,round(z)],rotation:[0,round(-Math.atan2(q[1]-p[1],q[0]-p[0])*180/Math.PI),0],uv:{
            north:face(segment+8,0,1,32),south:face(segment,0,1,32),
            east:face(24,0,1,32),west:face(24,0,1,32),up:face(25,0,1,1),down:face(26,0,1,1),
        }});
    }
    bones.push({name:blade?'blade_right':'blade_left',parent:'blades',pivot:[0,0,0],rotation:[0,blade*180,0],cubes});
}
writeJSON('RP/models/entity/gas_turbine_rotor.geo.json',{format_version:'1.12.0','minecraft:geometry':[{description:{identifier:'geometry.utilitycraft.gas_turbine_rotor',texture_width:32,texture_height:32,visible_bounds_width:202,visible_bounds_height:400,visible_bounds_offset:[0,99,0]},bones}]});
writeJSON('RP/animations/gas_turbine_rotor.animation.json',{format_version:'1.8.0',animations:{'animation.utilitycraft.gas_turbine.rotor':{loop:true,bones:{
    rotor:{rotation:[0,'v.turbine_angle',0]},shaft:{scale:[1,'v.turbine_height',1]},
    upper_bearing:{position:[0,'v.turbine_height * 16.0 - 2.5',0]},
    blades:{position:[0,3,0],scale:['v.turbine_radius','math.max(0.0, v.turbine_height - 0.375)','v.turbine_radius']},
}}}});
const clientPath=path.join(root,'RP/entity/gas_turbine_rotor.json');
const client=JSON.parse(fs.readFileSync(clientPath,'utf8'));
client['minecraft:client_entity'].description.textures.default='textures/entity/gas_turbine_rotor';
writeJSON('RP/entity/gas_turbine_rotor.json',client);
// Small deterministic PNG encoder, with no image-processing dependencies.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([type,data])));return Buffer.concat([len,type,data,crc]);}
const pixels=Buffer.alloc(32*(1+32*4));
const outer=[0x7a,0x85,0x85,0x9e,0x85,0x7a,0x7a,0x6a],inner=[0x6a,0x7a,0x7a,0x85,0x7a,0x6a,0x6a,0x57];
for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    let gray=x<8?outer[x]:x<16?inner[x-8]:x<24?[0x51,0x6a,0x85,0x9e,0x85,0x7a,0x6a,0x57][x-16]:[0x6a,0x9e,0x51,0x85,0x7a,0x6a,0x57,0x51][x-24];
    if(x<16&&(y===0||y===31))gray=0x6a;
    if(x<16&&y===1)gray=0x9e;
    const i=y*129+1+x*4;pixels[i]=pixels[i+1]=pixels[i+2]=gray;pixels[i+3]=255;
}
const header=Buffer.alloc(13);header.writeUInt32BE(32,0);header.writeUInt32BE(32,4);header[8]=8;header[9]=6;
fs.mkdirSync(path.join(root,'RP/textures/entity'),{recursive:true});
fs.writeFileSync(path.join(root,'RP/textures/entity/gas_turbine_rotor.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
console.log('Built steel rotor: two vertical scoops, 19 cubes, 32x32 texture.');
