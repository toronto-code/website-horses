import sharp from 'sharp'
import { readFile, mkdir } from 'node:fs/promises'

// Isolate the uninterrupted mark at the tip of the tail. Keep its asymmetric
// edges and its variation in pressure. The brush mask carries no paper colour.
const reference = await readFile('reference/horse-scratch.png')
const width = 72, height = 13
const data = await sharp(reference).extract({left:28,top:244,width,height})
  .removeAlpha().greyscale().raw().toBuffer()
const rgba = Buffer.alloc(width*height*4, 5)
for (let y=0;y<height;y++) for(let x=0;x<width;x++) {
  const edge = Math.min(1,(x/17)**.78,((width-1-x)/15)**.78,y/3,(height-1-y)/3)
  rgba[(y*width+x)*4+3] = Math.round(255*edge*Math.max(0,Math.min(1,(231-data[y*width+x])/162)))
}
await mkdir('src/scene/assets',{recursive:true})
await sharp(rgba,{raw:{width,height,channels:4}}).png().toFile('src/scene/assets/ink-nib.png')
