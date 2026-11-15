import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {AnimationMixer,Vector3,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import sharp from 'sharp';
import {renderPose} from './pose-image.mjs';

const project=fileURLToPath(new URL('../../',import.meta.url)),root=new URL('../../art/horse/collected/',import.meta.url);
await mkdir(root,{recursive:true});
const bytes=await readFile(project+'/tools/bake-horse/source/quaternius-horse.glb');
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const scene=gltf.scene,clip=gltf.animations.find(a=>a.name==='AnimalArmature|Gallop');
const mixer=new AnimationMixer(scene),meshes=[],rest=[];
scene.traverse(n=>{if(n.isSkinnedMesh)meshes.push(n);if(n.isBone)rest.push([n,n.position.clone(),n.quaternion.clone(),n.scale.clone()]);});
const camera=JSON.parse(await readFile(project+'/art/horse/gallop/poses.json','utf8')).camera;
const bone=name=>scene.getObjectByName(name),point=name=>bone(name).getWorldPosition(new Vector3());
const X=new Vector3(1,0,0),V=new Vector3(),count=60,columns=10,tau=Math.PI*2;
function turn(name,theta){const n=bone(name),parent=n.parent.getWorldQuaternion(new Quaternion());n.quaternion.premultiply(parent.clone().invert().multiply(new Quaternion().setFromAxisAngle(X,theta)).multiply(parent));scene.updateMatrixWorld(true);}
function pose(i){
 const phase=i/count;
 mixer.stopAllAction();for(const [n,p,q,s]of rest){n.position.copy(p);n.quaternion.copy(q);n.scale.copy(s);}scene.position.set(0,0,0);
 // Start from the rig's authored footfall sequence. The previous manually
 // aimed knees and hocks are not used in this new gait.
 const timing=phase-.18/tau*Math.sin(tau*phase);
 mixer.clipAction(clip).reset().play();mixer.setTime(clip.duration*timing);scene.updateMatrixWorld(true);
 const feet=[];
 for(const side of ['L','R']){
  const shin=bone('BackLowerLeg'+side),foot=bone('IKBackLeg'+side);
  feet.push({shin,foot,relative:shin.matrixWorld.clone().invert().multiply(foot.matrixWorld)});
  const hip=point('BackLeg'+side),knee=point('BackUpperLeg'+side),v=knee.sub(hip);
  const angle=Math.atan2(v.z,-v.y);
  // Compress only the backward hip swing, keeping the authored knee/hock fold.
  // The gain approaches zero smoothly at vertical so the recovery has no snap.
  if(angle<0){const reduction=.34*(1-Math.exp(-((angle/.45)**2)));turn('BackLeg'+side,angle-angle*(1-reduction));}
 }
 for(const {shin,foot,relative}of feet){const local=foot.parent.matrixWorld.clone().invert().multiply(shin.matrixWorld).multiply(relative);local.decompose(foot.position,foot.quaternion,foot.scale);scene.updateMatrixWorld(true);}
}
function lowestHoof(){let y=Infinity;for(const m of meshes)if(m.material.name==='Hooves')for(let j=0;j<m.geometry.attributes.position.count;j++)y=Math.min(y,m.getVertexPosition(j,V).applyMatrix4(m.matrixWorld).y);return y;}
// One floor offset for the entire stride retains the authored body's smooth bob;
// no frame-by-frame root fitting is allowed to make the torso pop up and down.
let lowest=Infinity;
for(let i=0;i<count;i++){pose(i);lowest=Math.min(lowest,lowestHoof());}
const groundWorld=(camera.y-308)/camera.scale,groundOffset=groundWorld-lowest;
const tiles=[],proofs=[],samples=[];
for(let i=0;i<count;i++){
 pose(i);scene.position.y=groundOffset;scene.updateMatrixWorld(true);
 const maxHeight=()=>{let top=-Infinity;for(const m of meshes)for(let j=0;j<m.geometry.attributes.position.count;j++)top=Math.max(top,m.getVertexPosition(j,V).applyMatrix4(m.matrixWorld).y);return top;};
 let correction=0;while(correction<30&&maxHeight()>(camera.y-12)/camera.scale){turn('Neck1',Math.PI/720);correction+=.25;}
 const parts=meshes.map(m=>({material:m.material.name,triangles:m.geometry.index.array,vertices:Array.from({length:m.geometry.attributes.position.count},(_,j)=>m.getVertexPosition(j,new Vector3()).applyMatrix4(m.matrixWorld))}));
 const {png,preview}=await renderPose(parts,camera,640,320);
 tiles.push({input:png,left:i%columns*640,top:Math.floor(i/columns)*320});proofs.push(preview);
 samples.push({frame:i+1,phase:i/count,lowestHoof:lowestHoof(),hips:['L','R'].map(s=>{const v=point('BackUpperLeg'+s).sub(point('BackLeg'+s));return Math.atan2(v.z,-v.y);}),feet:['FFL','FFR','FFBL','FFBR'].map(n=>{const p=point(n);return {y:p.y,z:p.z};})});
}
const contactSpeeds=[];
for(let leg=0;leg<4;leg++){
 const low=Math.min(...samples.map(s=>s.feet[leg].y));
 for(let i=0;i<count;i++){const a=samples[i].feet[leg],b=samples[(i+1)%count].feet[leg];const speed=-(b.z-a.z)*count;if(a.y<low+.12&&b.y<low+.12&&speed>1&&speed<12)contactSpeeds.push(speed*camera.scale);}
}
contactSpeeds.sort((a,b)=>a-b);
const stridePx=Math.max(270,Math.min(400,contactSpeeds[Math.floor(contactSpeeds.length/2)]||330));
await sharp({create:{width:columns*640,height:Math.ceil(count/columns)*320,channels:3,background:'#000'}}).composite(tiles).png().toFile(fileURLToPath(new URL('./poses.png',root)));
const sheet=[];for(let i=0;i<16;i++)sheet.push({input:await sharp(proofs[Math.floor(i*count/16)]).resize(384,192).png().toBuffer(),left:i%4*384,top:Math.floor(i/4)*216+22});
const labels=Array.from({length:16},(_,i)=>`<text x="${i%4*384+12}" y="${Math.floor(i/4)*216+19}">${String(i+1).padStart(2,'0')}</text>`).join('');
const paper=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="864"><rect width="100%" height="100%" fill="#c0c1bd"/><g font-family="Arial" font-size="15" fill="#222">${labels}</g></svg>`);
await sharp(paper).composite(sheet).jpeg({quality:95}).toFile(fileURLToPath(new URL('./key-poses.jpg',root)));
const metadata={name:'Collected gallop',method:'Authored gallop footfalls with compressed rear hip extension, longer load timing and one constant ground offset',count,columns,fps:60,cycleSeconds:1,stridePx,groundOffset,samples};
await writeFile(new URL('./motion.json',root),JSON.stringify(metadata,null,2));
console.log({gait:metadata.name,poses:count,cycleSeconds:1,stridePx:stridePx.toFixed(1),groundOffset:groundOffset.toFixed(3)});
