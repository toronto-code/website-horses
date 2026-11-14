import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { poseAt, layerOf, displacement } from './gait.mjs'

const width = 990, height = 582
const output = 'public/horse'
const work = 'art/horse'
await Promise.all([mkdir(output, { recursive: true }), mkdir(work + '/frames', { recursive: true })])
const source = await sharp('reference/horse-scratch.png').resize(width, height)
  .flatten({ background: '#fff' }).greyscale().raw().toBuffer()
const density = source.map(v => Math.round(255 * Math.max(0, Math.min(1, (234 - v) / 229))))
const lowpass = await sharp(density, { raw: { width, height, channels: 1 } })
  .blur(7).greyscale().raw().toBuffer()

const layers = new Map(['body','tail','hind','fore','fold'].map(name => [name, []]))
const stamp = Buffer.alloc(width * height)
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = y * width + x
    const gain = Math.min(1, Math.max(0, (lowpass[i] - 11) / 17))
    const ink = Math.round(density[i] * gain * gain * (3 - 2 * gain))
    if (!ink || y > 553 || (y > 370 && (x < 350 || x > 850))) continue
    stamp[i] = ink
    layers.get(layerOf(x, y)).push(x, y, ink)
  }
}

const size = 48
const layerNames = ['tail','hind','fold','fore','body']
function writeInk(alpha, w, h, path) {
  const rgba = Buffer.alloc(w*h*4, 5)
  for (let i=0; i<alpha.length; i++) rgba[4*i+3] = alpha[i]
  return sharp(rgba, { raw:{ width:w, height:h, channels:4 } }).png().toFile(path)
}
await writeInk(stamp, width, height, work + '/held.png')
await sharp(work + '/held.png').webp({ lossless:true }).toFile(output + '/held.webp')
const matte = new Float32Array(width * height)
for (let frame=0; frame<size; frame++) {
  const pose = poseAt(frame / size)
  const combined = Buffer.alloc(width*height)
  for (const name of layerNames) {
    matte.fill(0)
    const pixels = layers.get(name)
    for (let i=0; i<pixels.length; i+=3) {
      const x = pixels[i], y = pixels[i+1], alpha = pixels[i+2]
      const [dx,dy] = displacement(name, x, y, pose)
      const fx = x+dx, fy = y+dy, ix=Math.floor(fx), iy=Math.floor(fy)
      if (ix<0 || ix+1>=width || iy<0 || iy+1>=height) continue
      const u=fx-ix, v=fy-iy, index=iy*width+ix
      matte[index] += alpha*(1-u)*(1-v)
      matte[index+1] += alpha*u*(1-v)
      matte[index+width] += alpha*(1-u)*v
      matte[index+width+1] += alpha*u*v
    }
    for (let i=0; i<combined.length; i++) {
      const a = Math.min(255, matte[i])
      combined[i] = Math.round(combined[i] + a * (1-combined[i]/255))
    }
  }
  const path = work+'/frames/'+String(frame).padStart(2,'0')+'.png'
  await writeInk(combined, width, height, path)
}
console.log('Rendered all 48 individual poses')

// Pack just the changing limbs. This exact RGBA decomposition recovers each
// complete frame by drawing its moving leg tile followed by its common torso.
const line = 303
const left = 178, top = line, w = 758, h = 273
const rest = Buffer.from(stamp)
for (let y=top; y<top+h; y++) rest.fill(0, y*width+left, y*width+left+w)
await writeInk(rest,width,height,work+'/torso.png')
await sharp(work+'/torso.png').webp({ lossless:true }).toFile(output+'/torso.webp')
const columns=4, rows=3, perSheet=columns*rows
for (let sheet=0; sheet<size/perSheet; sheet++) {
  const tiles=[]
  for (let n=0; n<perSheet; n++) {
    const id = sheet*perSheet+n
    const tileHeight = 219, tileWidth = 607
    const tile = await sharp(work+'/frames/'+String(id).padStart(2,'0')+'.png')
      .extract({ left, top, width:w, height:h }).resize(tileWidth,tileHeight,{fit:"fill"}).png().toBuffer()
    tiles.push({input:tile,left:n%columns*tileWidth,top:Math.floor(n/columns)*tileHeight})
  }
  await sharp({create:{width:607*columns,height:219*rows,channels:4,background:{r:5,g:5,b:5,alpha:0}}})
    .composite(tiles).webp({lossless:true,effort:6}).toFile(output+'/stride-'+sheet+'.webp')
}
await writeFile('src/scene/stride.json', JSON.stringify({
  width,height,count:size,columns,rows,encodedWidth:607,encodedHeight:219,tile:{left,top,width:w,height:h},
  stride:240, baseline:547
},null,2)+'\n')
