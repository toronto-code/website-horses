import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import modelUrl from '../assets/horse.glb?url'
import { addHair } from './horse-hair'
import { smoothGallop } from './gallop'

export const horseViews = {
  near: { columns: 148, rows: 66, yaw: .18, neckPitch: -.036, lift: .028 },
  mid: { columns: 86, rows: 40, yaw: .09, neckPitch: .046, lift: .043 },
  far: { columns: 64, rows: 32, yaw: .04, neckPitch: .014, lift: .022 },
} as const
export type HorseView = keyof typeof horseViews
export const studyPoses = [
  { phase: 0, name: 'Fore support' },
  { phase: .25, name: 'Gathered suspension' },
  { phase: .50, name: 'Hind support' },
  { phase: .8125, name: 'Fore reach' },
] as const

const symbols = " .,:;'-=+*ox%#@MWmHB8&Q/\\|_"
const cellW = 4, cellH = 6
const tones = 16
const cycleSteps = 144

function makeAtlas() {
  const atlas = document.createElement('canvas')
  atlas.width = cellW * symbols.length
  atlas.height = cellH * tones
  const pen = atlas.getContext('2d')!
  const family = getComputedStyle(document.documentElement).getPropertyValue('--type').trim()
  pen.font = `bold 8px ${family}`
  pen.fillStyle = pen.strokeStyle = '#0a0a0a'
  pen.lineWidth = .55
  pen.lineJoin = 'round'
  for (let glyph = 0; glyph < symbols.length; glyph++) {
    const char = symbols[glyph]
    const measure = pen.measureText(char)
    const inkW = measure.actualBoundingBoxLeft + measure.actualBoundingBoxRight
    const scale = Math.min(1, cellW / Math.max(1,inkW))
    const inkH = measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent
    for (let tone = 0; tone < tones; tone++) {
      pen.save()
      pen.translate(glyph*cellW, tone*cellH)
      pen.beginPath()
      pen.rect(0,0,cellW,cellH)
      pen.clip()
      pen.translate(cellW/2,cellH/2)
      pen.scale(scale, Math.min(1,cellH/Math.max(1,inkH)))
      pen.globalAlpha = (tone+1)/tones
      const x = (measure.actualBoundingBoxLeft-measure.actualBoundingBoxRight)/2
      const y = (measure.actualBoundingBoxAscent-measure.actualBoundingBoxDescent)/2
      if (glyph < symbols.length-4) pen.strokeText(char,x,y)
      pen.fillText(char,x,y)
      pen.restore()
    }
  }
  const ink = pen.getImageData(0,0,atlas.width,atlas.height)
  const coverage = [...symbols].slice(0,-4).map((_, glyph) => {
    let sum = 0
    for (let y=atlas.height-cellH; y<atlas.height; y++) {
      for (let x=glyph*cellW; x<(glyph+1)*cellW; x++) sum += ink.data[(y*atlas.width+x)*4+3]
    }
    return { glyph, ink: sum/(255*cellW*cellH) }
  }).sort((a,b)=>a.ink-b.ink)
  const ramp = Uint8Array.from({length:256}, (_, i) => {
    const target = i/255
    return coverage.reduce((best,item) => Math.abs(item.ink-target)<Math.abs(best.ink-target) ? item : best).glyph
  })
  return { width:atlas.width, pixels:new Uint32Array(ink.data.buffer), ramp }
}

export async function createHorseRenderer() {
  const model = await new GLTFLoader().loadAsync(modelUrl)
  const clip = model.animations.find(a => a.name.endsWith('|Gallop'))
  if (!clip) throw new Error('The horse model has no gallop clip.')
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' })
  const scene = new THREE.Scene()
  const materialMap = new Map<string, THREE.MeshLambertMaterial>()
  model.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const name = object.material.name
    if (!materialMap.has(name)) {
      const dark = /Hooves|Hair|Eye_Black/.test(name)
      materialMap.set(name, new THREE.MeshLambertMaterial({
        color: dark ? 0x292929 : 0x545454,
      }))
    }
    object.material.dispose()
    object.material = materialMap.get(name)!
    object.frustumCulled = false
  })
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2)
  keyLight.position.set(-4,7,4)
  scene.add(model.scene, keyLight, new THREE.HemisphereLight(0xffffff,0x999999, .85))
  const mixer = new THREE.AnimationMixer(model.scene)
  const hair = addHair(scene,model.scene)
  mixer.clipAction(smoothGallop(clip)).play()
  const neck = model.scene.getObjectByName('Neck2')!
  const nod = new THREE.Quaternion()
  const pitchAxis = new THREE.Vector3(1, 0, 0)
  const camera = new THREE.OrthographicCamera(-4.3,4.3,2.45,-2.45,.1,50)
  const targets = Object.fromEntries(Object.entries(horseViews).map(([name, view]) =>
    [name, new THREE.WebGLRenderTarget(view.columns, view.rows, { samples: 4 })]
  )) as Record<HorseView, THREE.WebGLRenderTarget>
  renderer.setClearColor(0x000000, 0)
  const atlas = makeAtlas()
  // Keep compact glyph/tone pairs for all phases. Only the current pose in
  // each view needs a full-size RGBA surface.
  const cache = new Map<string, Uint16Array>()
  const surfaces = new Map<HorseView, { canvas: HTMLCanvasElement; pen: CanvasRenderingContext2D; output: ImageData; last: number }>()
  let pixels = new Uint8Array(148 * 66 * 4)

  function frame(view: HorseView, phase: number) {
    const step = Math.round(((phase % 1 + 1) % 1) * cycleSteps) % cycleSteps
    const key = view + step
    const {columns, rows, yaw, neckPitch, lift} = horseViews[view]
    let surface = surfaces.get(view)
    if (!surface) {
      const canvas = document.createElement('canvas')
      canvas.width = columns * cellW
      canvas.height = rows * cellH
      const pen = canvas.getContext('2d')!
      surface = { canvas, pen, output: pen.createImageData(canvas.width, canvas.height), last: -1 }
      surfaces.set(view, surface)
    }
    if (surface.last === step) return surface.canvas
    let cells = cache.get(key)
    if (!cells) {
      cells = new Uint16Array(columns * rows)
      const aspect = columns * cellW / (rows * cellH)
      const halfH = Math.max(2.43, 4.05 / aspect)
      camera.left = -halfH * aspect
      camera.right = -camera.left
      camera.top = halfH
      camera.bottom = -halfH
      camera.position.set(-12,2.83, .14 + yaw * 12)
      camera.lookAt(0,2.2,.14)
      camera.updateProjectionMatrix()
      mixer.setTime(step / cycleSteps * clip!.duration)
      const baseNeck = neck.quaternion.clone()
      neck.quaternion.multiply(nod.setFromAxisAngle(pitchAxis, neckPitch + lift*Math.sin(step/cycleSteps*2*Math.PI)))
      model.scene.updateMatrixWorld(true)
      hair.update(step/cycleSteps)
      const target = targets[view]
      renderer.setRenderTarget(target)
      renderer.render(scene,camera)
      renderer.readRenderTargetPixels(target,0,0,columns,rows,pixels)
      neck.quaternion.copy(baseNeck)
      const alpha = (x:number,y:number) => x < 0 || x >= columns || y < 0 || y >= rows ? 0 : pixels[(y*columns+x)*4+3] / 255
      for (let y=0;y<rows;y++) for (let x=0;x<columns;x++) {
        if (alpha(x,y) < .3) continue
        const i = (y*columns+x)*4
        const luminance = (.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255
        const light = Math.min(1, 2.8*Math.sqrt(luminance))
        const gx = alpha(x+1,y-1)+2*alpha(x+1,y)+alpha(x+1,y+1)-alpha(x-1,y-1)-2*alpha(x-1,y)-alpha(x-1,y+1)
        const gy = alpha(x-1,y+1)+2*alpha(x,y+1)+alpha(x+1,y+1)-alpha(x-1,y-1)-2*alpha(x,y-1)-alpha(x+1,y-1)
        const density = Math.max(.6, .97-.38*light)
        let glyph = atlas.ramp[Math.round(255*density)]
        let intensity = 1
        if (gx*gx + gy*gy > 3.5) {
          const edge = Math.abs(gx)>2*Math.abs(gy) ? '|' : Math.abs(gy)>2*Math.abs(gx) ? '_' : gx*gy>0 ? '\\' : '/'
          glyph = symbols.indexOf(edge)
          intensity = (.99-.45*light)*alpha(x,y)
        }
        cells[(rows-1-y)*columns+x] = Math.round(intensity*(tones-1)) * symbols.length + glyph
      }
      cache.set(key, cells)
    }
    const words = new Uint32Array(surface.output.data.buffer)
    const result = surface.canvas
    words.fill(0)
    for (let i=0; i<cells.length; i++) {
      const code = cells[i]
      if (!code) continue
      let src = Math.floor(code/symbols.length)*cellH*atlas.width + (code%symbols.length)*cellW
      let dst = Math.floor(i/columns)*cellH*result.width + (i%columns)*cellW
      for (let line=0; line<cellH; line++) {
        for (let pixel=0; pixel<cellW; pixel++) words[dst+pixel] = atlas.pixels[src+pixel]
        src += atlas.width
        dst += result.width
      }
    }
    surface.pen.putImageData(surface.output, 0, 0)
    surface.last = step
    return result
  }
  return { frame, dispose() {
    cache.clear()
    mixer.stopAllAction()
    model.scene.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
    materialMap.forEach(m => m.dispose())
    hair.dispose()
    Object.values(targets).forEach(target => target.dispose())
    surfaces.clear()
    renderer.dispose()
    renderer.forceContextLoss()
    pixels = new Uint8Array(0)
  } }
}
export type HorseRenderer = Awaited<ReturnType<typeof createHorseRenderer>>
