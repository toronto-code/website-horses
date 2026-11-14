import sharp from 'sharp'
import { Vector3 } from 'three'

const light = new Vector3(.49,.76,.42).normalize()
const dark = new Set(['Hair','Hooves','Muzzle','Eye_Black'])

export async function renderPose(parts, camera, width, height) {
  const aa = 3, w = width*aa, h = height*aa
  const depth = new Float32Array(w*h).fill(-Infinity)
  const rgba = Buffer.alloc(w*h*4)
  for (const {material,vertices,triangles} of parts) {
    const xy = vertices.map(v => [(camera.x+v.z*camera.scale)*aa, (camera.y-v.y*camera.scale)*aa])
    for (let k=0;k<triangles.length;k+=3) {
      const i=triangles[k], j=triangles[k+1], l=triangles[k+2]
      const [x1,y1]=xy[i], [x2,y2]=xy[j], [x3,y3]=xy[l]
      const dx2=x2-x1, dy2=y2-y1, dx3=x3-x1, dy3=y3-y1
      const det=dx2*dy3-dx3*dy2
      if (Math.abs(det)<1e-6) continue
      const a=vertices[i], b=vertices[j], c=vertices[l]
      const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize()
      const lighting=Math.max(0,normal.dot(light))
      const base=dark.has(material) ? .96-.17*lighting : .89-.59*lighting
      const ink=Math.round(255 * Math.max(.22,base-(material==='Main_Light'?.07:0)))
      const minX=Math.max(0,Math.floor(Math.min(x1,x2,x3)))
      const maxX=Math.min(w-1,Math.ceil(Math.max(x1,x2,x3)))
      const minY=Math.max(0,Math.floor(Math.min(y1,y2,y3)))
      const maxY=Math.min(h-1,Math.ceil(Math.max(y1,y2,y3)))
      for (let y=minY; y<=maxY; y++) {
        for (let x=minX; x<=maxX; x++) {
          const dx=x+.5-x1, dy=y+.5-y1
          const u=(dx*dy3-dy*dx3)/det, v=(dy*dx2-dx*dy2)/det
          if (u<0 || v<0 || u+v>1) continue
          const z=a.x+u*(b.x-a.x)+v*(c.x-a.x), pixel=y*w+x
          if(z<=depth[pixel]) continue
          depth[pixel]=z
          rgba[pixel*4]=ink
          rgba[pixel*4+3]=255
        }
      }
    }
  }
  // Average coverage separately from covered-sample ink. Edges survive a single
  // multiplication by G when the subsequent drawing stage consumes the atlas.
  const mask=Buffer.alloc(width*height), rgb=Buffer.alloc(width*height*3)
  const visible=Buffer.alloc(width*height*4)
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    let hits=0, sum=0
    for(let j=0;j<aa;j++) for(let i=0;i<aa;i++){
      const k=((y*aa+j)*w+x*aa+i)*4
      if(rgba[k+3]) { hits++;sum+=rgba[k] }
    }
    if(!hits)continue
    const p=y*width+x, ink=Math.round(sum/hits)
    mask[p]=rgb[p*3+1]=Math.round(255*hits/(aa*aa));rgb[p*3]=ink
    // A dark matte proof keeps the limb contours legible even at thumbnail size.
    const shade=Math.round(125-.43*ink)
    visible.fill(shade,p*4,p*4+3);visible[p*4+3]=mask[p]
  }
  return {png:await sharp(rgb,{raw:{width,height,channels:3}}).png().toBuffer(),
    preview:await sharp(visible,{raw:{width,height,channels:4}}).png().toBuffer(),mask}
}

export async function makeSheet(previews, key, destination) {
  const width=1680, height=1212, paper='#f1efe8', overlays=[]
  const svg=[]
  function label(text,x,y,size,options='') {
    svg.push(`<text x="${x}" y="${y}" font-size="${size}" ${options}>${text}</text>`)
  }
  function rule(x,y,end,color='#bab8b1') {
    svg.push(`<path d="M${x},${y} H${end}" stroke="${color}" stroke-width="1"/>`)
  }
  label('Gallop',44,79,64,'font-family="Times New Roman, serif"')
  label('Quaternius  /  Ultimate Animated Animal Pack',284,72,24)
  label('POSE STUDY     /     24 FRAMES',1635,72,17,'text-anchor="end" letter-spacing="1.4"')
  rule(44,103,1636)
  const examples=[['Extended flight',key.extended],['Collected',key.collected]]
  for(const [i,[name,frame]] of examples.entries()){
    const x=44+i*810
    label(name,x,150,32,'font-family="Times New Roman, serif"')
    label('Frame '+String(frame).padStart(2,'0'),x+229,148,19)
    overlays.push({input:await sharp(previews[frame-1]).resize(480,240).png().toBuffer(),left:x+92,top:160})
  }
  rule(44,422,1636)
  label('One complete stride',44,467,32,'font-family="Times New Roman, serif"')
  label('Fixed camera and scale throughout',1636,465,18,'text-anchor="end"')
  for(const [i,input] of previews.entries()){
    const x=44+(i%6)*267,y=485+Math.floor(i/6)*169
    const n=String(i+1).padStart(2,'0')
    label(n,x+5,y+16,18)
    if(i+1===key.extended || i+1===key.collected)
      label(i+1===key.extended?'Flight':'Collected',x+41,y+16,17,'font-style="italic"')
    overlays.push({input:await sharp(input).resize(265,133).png().toBuffer(),left:x,top:y+21})
  }
  rule(44,1162,1636)
  label('AnimalArmature | Gallop',44,1191,17)
  label('640 × 320 px per pose',1636,1191,17,'text-anchor="end"')
  const text=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${paper}"/><g fill="#262622" font-family="Arial, sans-serif">${svg.join('')}</g></svg>`)
  await sharp(text).composite(overlays).png().toFile(destination)
}
