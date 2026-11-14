// Offline bake. All measurements and pixels use the same sampled skin and camera.
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { AnimationMixer, Vector3, Box3, Quaternion } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import sharp from 'sharp'
import { renderPose, makeSheet } from './pose-image.mjs'

const width = 640, height = 320, count = 24, columns = 6
const output = 'art/horse/gallop'
const review = 'docs/review'
const clipName = 'AnimalArmature|Gallop'
const source = await readFile('tools/bake-horse/source/quaternius-horse.glb')
const sha256 = createHash('sha256').update(source).digest('hex')
if (sha256 !== 'fbddb2c97179eca896ec69c985cd9cc74540484510776c400df64e088e9f2414')
  throw Error('Unexpected source model. Verify its rig and provenance before baking.')
const gltf = await new GLTFLoader().parseAsync(
  source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength), '')
const scene = gltf.scene
const clip = gltf.animations.find(animation => animation.name === clipName)
if (!clip) throw Error('The required gallop clip is missing.')
const mixer = new AnimationMixer(scene)
const meshes = []
scene.traverse(object => { if (object.isSkinnedMesh) {
    meshes.push(object)
  } })

const point = name => scene.getObjectByName(name).getWorldPosition(new Vector3())
const axisAngle = (a, b) => Math.atan2(b.y - a.y, b.z - a.z) * 180 / Math.PI
const torsoBones = new Set(['Body', 'Back', 'Torso', 'Torso2', 'Torso3'])
const torsoFaces = new Map()
for (const mesh of meshes) {
  const { skinIndex, skinWeight } = mesh.geometry.attributes
  const influence = Array.from({ length: skinIndex.count }, (_, i) => {
    let sum = 0
    for (let j = 0; j < 4; j++) {
      const bone = mesh.skeleton.bones[skinIndex.getComponent(i, j)]
      if (torsoBones.has(bone.name)) sum += skinWeight.getComponent(i, j)
    }
    return sum
  })
  // Fixed anatomical selection avoids sweeping legs or mane moving the centroid.
  const indices = mesh.geometry.index.array
  const faces = []
  for (let i = 0; i < indices.length; i += 3) {
    const weight = (influence[indices[i]] + influence[indices[i+1]] + influence[indices[i+2]]) / 3
    if (weight >= .75 && mesh.material.name !== 'Hair') faces.push(i)
  }
  torsoFaces.set(mesh, faces)
}

const rest = []
scene.traverse(node => {
  if (node.isBone) rest.push([node, node.position.clone(), node.quaternion.clone(), node.scale.clone()])
})
const tau = 2*Math.PI
const flightPhase = 21/count
const worldX = new Vector3(1,0,0)
function turn(boneName, degrees) {
  const bone = scene.getObjectByName(boneName)
  const parent = bone.parent.getWorldQuaternion(new Quaternion())
  const delta = new Quaternion().setFromAxisAngle(worldX, degrees*Math.PI/180)
  bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent))
  bone.updateMatrixWorld(true)
}

// Periodic steady-state response of a damped angular spring to the pitching neck.
// Sampling the analytic solution keeps the first and last poses on the same cycle.
function follow(phase, frequencyRatio, damping) {
  const a = 1-frequencyRatio**2, b = 2*damping*frequencyRatio
  return Math.sin(tau*phase - Math.atan2(b,a))/Math.hypot(a,b)
}
function stageFlight(phase) {
  scene.updateMatrixWorld(true)
  // The hooves have separate animated IK chains outside Body. Transport each
  // chain by its lower leg's world-space correction so the fetlock stays closed.
  const feet = []
  for (const side of ['L','R']) for (const end of ['Front','Back']) {
    const shin = scene.getObjectByName(end+'LowerLeg'+side)
    const foot = scene.getObjectByName('IK'+end+'Leg'+side)
    feet.push({shin,foot,relative:shin.matrixWorld.clone().invert().multiply(foot.matrixWorld)})
  }
  const theta = tau*(phase-flightPhase)
  // Two brief lifts, with the stronger suspension at maximum leg extension.
  const extended = Math.max(0, Math.cos(theta))**2
  const gathered = Math.max(0, -Math.cos(theta))**2
  scene.position.y = .24*extended + .06*gathered
  turn('Body', -1.8*extended + 1.1*gathered)
  turn('Head', -2.4*Math.sin(theta-.25))
  turn('FrontShoulderL', -10*extended)
  turn('FrontShoulderR', -17*extended)
  turn('BackLegL', 15*extended)
  turn('BackLegR', 7*extended)
  for (let j=2; j<=7; j++) turn('Tail'+j, 1.25*follow(phase-.04*j,.40+.045*j,.74))
  // The mane is weighted to the neck chain on this rig; it has no separate joints.
  turn('Neck2', .9*follow(phase-.03,.63,.74))
  turn('Neck3', .8*follow(phase-.07,.71,.76))
  scene.updateMatrixWorld(true)
  for (const {shin,foot,relative} of feet) {
    const local=foot.parent.matrixWorld.clone().invert().multiply(shin.matrixWorld).multiply(relative)
    local.decompose(foot.position,foot.quaternion,foot.scale)
    foot.updateMatrixWorld(true)
  }
}

function sample(index, corrected) {
  // Reset mixer's cached track bindings as well as each untracked joint before
  // sampling a new pose. No corrective rotation carries across samples.
  mixer.stopAllAction()
  for (const [node,position,rotation,scale] of rest) {
    node.position.copy(position); node.quaternion.copy(rotation); node.scale.copy(scale)
  }
  scene.position.set(0,0,0)
  mixer.clipAction(clip).reset().play()
  mixer.setTime(clip.duration * index / count)
  if (corrected) stageFlight(index/count)
  scene.updateMatrixWorld(true)
  const parts = [], bounds = new Box3(), hoofBounds = new Box3()
  let areaSum = 0, moment = 0
  for (const mesh of meshes) {
    const triangles = mesh.geometry.index.array
    const vertices = Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => {
      const vertex = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld)
      bounds.expandByPoint(vertex)
      if (mesh.material.name === 'Hooves') hoofBounds.expandByPoint(vertex)
      return vertex
    })
    for (const offset of torsoFaces.get(mesh)) {
      const [a, b, c] = [0, 1, 2].map(k => vertices[triangles[offset+k]])
      const area = b.clone().sub(a).cross(c.clone().sub(a)).length() * .5
      areaSum += area
      moment += area * (a.y+b.y+c.y) / 3
    }
    parts.push({ material: mesh.material.name, vertices, triangles })
  }
  const back = point('Back'), withers = point('Torso3'), poll = point('Head')
  const muzzle = parts.find(p => p.material === 'Muzzle').vertices
  const nose = muzzle.reduce((sum, v) => sum.add(v), new Vector3()).divideScalar(muzzle.length)
  const torsoPitch = axisAngle(back, withers)
  const neckPitch = axisAngle(point('Neck1'), poll)
  return { parts, bounds, measurements: {
    frame: index+1, timeSeconds: clip.duration*index/count,
    torsoCentroidY: moment/areaSum, horseHeight: bounds.max.y-bounds.min.y,
    torsoPitch, neckPitch, neckRelativeToTorso: neckPitch-torsoPitch,
    headPitch: axisAngle(poll, nose), hoofSpan: hoofBounds.max.z-hoofBounds.min.z,
    lowestHoofY: hoofBounds.min.y,
  } }
}

const native = Array.from({ length: count }, (_, i) => sample(i, false).measurements)
const poses = Array.from({ length: count }, (_, i) => sample(i, true))
const bounds = poses.reduce((box, p) => box.union(p.bounds), new Box3())
const padding = { left: Math.ceil(width*.12), right: 12, top: 12, bottom: 12 }
const scale = Math.min((width-padding.left-padding.right)/(bounds.max.z-bounds.min.z),
  (height-padding.top-padding.bottom)/(bounds.max.y-bounds.min.y))
// Anchor the leftmost tail to the reserved smear margin. Preserve one ground line.
const camera = {
  scale, x: padding.left - bounds.min.z*scale,
  y: (height + (bounds.max.y+bounds.min.y)*scale)/2,
}
const samples = poses.map(p => p.measurements)
function measure(sequence) {
  const values = key => sequence.map(p => p[key])
  const range = key => Math.max(...values(key)) - Math.min(...values(key))
  const maxHorseHeight = Math.max(...values('horseHeight'))
  return {
  maxHorseHeightPx: maxHorseHeight*scale, torsoBobPx: range('torsoCentroidY')*scale,
  torsoBobPercent: 100*range('torsoCentroidY')/maxHorseHeight,
  torsoPitchSwingDeg: range('torsoPitch'), neckSwingDeg: range('neckPitch'),
  neckSwingRelativeToTorsoDeg: range('neckRelativeToTorso'), headSwingDeg: range('headPitch'),
}
}
const summary = measure(samples)
const nativeSummary = measure(native)
console.log({ native:nativeSummary, baked:summary })
if (summary.torsoBobPercent < 4 || summary.torsoPitchSwingDeg < 6 ||
    summary.neckSwingDeg < 10 || summary.headSwingDeg < 10)
  throw Error('The source motion is below threshold. Adjust the source before publishing a sheet.')

await Promise.all([mkdir(output, { recursive:true }), mkdir(review, { recursive:true })])
const ground = Math.min(...samples.map(p=>p.lowestHoofY))
const extended = samples.reduce((best,p) => p.hoofSpan>best.hoofSpan ? p : best)
const collected = samples.reduce((best,p) => p.hoofSpan<best.hoofSpan ? p : best)
const tiles = [], previews = [], masks = []
for (const [i, pose] of poses.entries()) {
  const { png, preview, mask } = await renderPose(pose.parts, camera, width, height)
  tiles.push({ input:png, left:(i%columns)*width, top:Math.floor(i/columns)*height })
  previews.push(preview)
  masks.push(mask)
}
let intersection = 0, union = 0
for (let i=0; i<width*height; i++) {
  const a = masks[extended.frame-1][i] >= 128, b = masks[collected.frame-1][i] >= 128
  intersection += Number(a && b)
  union += Number(a || b)
}
const keyPoses = { extended:extended.frame, collected:collected.frame,
  extendedHoofSpreadPx:extended.hoofSpan*scale, collectedHoofSpreadPx:collected.hoofSpan*scale,
  extendedClearancePx:(extended.lowestHoofY-ground)*scale, silhouetteIoU:intersection/union }
await sharp({create:{width:columns*width,height:Math.ceil(count/columns)*height,channels:3,background:'#000'}})
  .composite(tiles).removeAlpha().png().toFile(output+'/poses.png')
await makeSheet(previews, keyPoses, review+'/pose-sheet.png')
await writeFile(output+'/poses.json', JSON.stringify({
  model:'Quaternius Horse', sha256, clip:clipName, durationSeconds:clip.duration,
  poseCount:count, frameWidth:width, frameHeight:height, columns, rows:count/columns,
  order:'row-major', channels:{ R:'ink density, unassociated', G:'silhouette coverage', B:'unused' },
  camera:{...camera, projection:'orthographic, +Z right, +Y up, camera at +X', leftPaddingPx:padding.left,
    groundY:camera.y-ground*scale }, proceduralMotion:true, nativeSummary, summary, keyPoses, samples
},null,2)+'\n')
console.log(keyPoses)
