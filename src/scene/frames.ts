import atlasUrl from '../../art/horse/gallop/poses.png'
import nibUrl from './assets/ink-nib.png'

export const POSE_COUNT = 24
export const FRAME_WIDTH = 640
export const FRAME_HEIGHT = 320
export const FLIGHT_POSE = 21
export const GROUND_Y = 308
export const HORSE_LENGTH = 490
export const DRAWN_FPS = 10
export const STRIDE_LENGTH = .74 * HORSE_LENGTH
export const IDLE_POSE_STEP = 3
export const SCROLL_POSE_STEP = 4
export const SEED_CYCLE = 24

export function drawingRate(value: string | null) {
  const rate = Number(value)
  return value && Number.isFinite(rate) ? Math.min(12, Math.max(8, Math.round(rate))) : DRAWN_FPS
}

interface InkRun {
  left: number
  right: number
  density: Uint8Array
}
interface InkPose {
  rows: InkRun[][]
  tail: { x: number; y: number }
}
export interface DrawingMaterials {
  poses: InkPose[]
  nib: HTMLImageElement
}

async function loadImage(url: string) {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

// Store only occupied spans, with lighting smoothed over the plane boundaries
// of the low-poly rig. Coverage remains separate and retains the sharp hooves.
function readPose(pixels: Uint8ClampedArray): InkPose {
  const rows: InkRun[][] = []
  let tail = { x: FRAME_WIDTH, y: 0 }
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    const runs: InkRun[] = []
    rows.push(runs)
    let x = 0
    while (x < FRAME_WIDTH) {
      if (pixels[(y*FRAME_WIDTH+x)*4+1] < 55) { x++; continue }
      const left = x
      while (x < FRAME_WIDTH && pixels[(y*FRAME_WIDTH+x)*4+1] >= 55) x++
      const right = x
      if (left < tail.x && y < FRAME_HEIGHT*.65) tail = { x:left, y }
      const density = new Uint8Array(right-left)
      for (let i=left; i<right; i++) {
        let ink=0, weight=0
        for (const oy of [-3,0,3]) for (const ox of [-5,0,5]) {
          const sy=y+oy, sx=i+ox
          if (sy<0 || sy>=FRAME_HEIGHT || sx<0 || sx>=FRAME_WIDTH) continue
          const k=(sy*FRAME_WIDTH+sx)*4
          const w=(ox===0?2:1)*(oy===0?2:1)*pixels[k+1]
          ink+=pixels[k]*w; weight+=w
        }
        density[i-left] = ink / (weight || 1)
      }
      runs.push({ left, right, density })
    }
  }
  return {rows,tail}
}
export async function loadMaterials(): Promise<DrawingMaterials> {
  const [atlas,nib] = await Promise.all([loadImage(atlasUrl),loadImage(nibUrl)])
  const buffer = document.createElement('canvas')
  buffer.width=FRAME_WIDTH; buffer.height=FRAME_HEIGHT
  const ctx=buffer.getContext('2d',{willReadFrequently:true})!
  const poses: InkPose[]=[]
  for(let p=0;p<POSE_COUNT;p++){
    ctx.drawImage(atlas,(p%6)*FRAME_WIDTH,Math.floor(p/6)*FRAME_HEIGHT,
      FRAME_WIDTH,FRAME_HEIGHT,0,0,FRAME_WIDTH,FRAME_HEIGHT)
    poses.push(readPose(ctx.getImageData(0,0,FRAME_WIDTH,FRAME_HEIGHT).data))
  }
  return {poses,nib}
}

function hash(a: number, b: number, c: number) {
  let h=Math.imul(a+31,0x9e3779b1)^Math.imul(b+97,0x85ebca6b)^Math.imul(c+53,0xc2b2ae35)
  h=Math.imul(h^(h>>>16),0x7feb352d)
  h=Math.imul(h^(h>>>15),0x846ca68b)
  return ((h^(h>>>16))>>>0)/4294967296
}

export function drawHorse(canvas: HTMLCanvasElement, materials: DrawingMaterials,
  poseIndex: number, drawIndex: number, horseSeed: number) {
  const ctx=canvas.getContext('2d')!
  const pose=materials.poses[poseIndex]
  const seed=horseSeed*SEED_CYCLE + (drawIndex%SEED_CYCLE)
  const variation=(k:number)=>hash(seed,-1,k)
  const bias=.92+.16*variation(0), length=.8+.45*variation(1)
  const smear=.75+.50*variation(2), darkness=.94+.12*variation(3)
  const spacing=2.3, rowPhase=spacing*variation(4)
  const dx=(variation(5)-.5)*3, dy=(variation(6)-.5)*3
  const angle=(variation(7)-.5)*.8*Math.PI/180
  const scale=canvas.width/FRAME_WIDTH
  ctx.setTransform(1,0,0,1,0,0)
  ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.setTransform(scale,0,0,canvas.height/FRAME_HEIGHT,0,0)
  ctx.translate(FRAME_WIDTH/2+dx,FRAME_HEIGHT/2+dy)
  ctx.rotate(angle)
  ctx.translate(-FRAME_WIDTH/2,-FRAME_HEIGHT/2)
  const stamp = (x:number,y:number,w:number,h:number,alpha:number) => {
    ctx.globalAlpha=Math.min(1,Math.max(0,alpha))
    ctx.drawImage(materials.nib,x,y-h/2,w,h)
  }
  let lineY=rowPhase
  for (let row=0;lineY<FRAME_HEIGHT-1;row++){
    const y=lineY
    lineY+=spacing*(.68+.64*hash(seed,row,0))
    const sampleY=Math.max(0,Math.min(FRAME_HEIGHT-1,Math.round(y)))
    const pressure=.70+.52*hash(seed,row,1)
    for (const run of pose.rows[sampleY]) {
      const width=run.right-run.left
      if (width<2) continue
      const thin=width<6*spacing
      const rowY=y+(thin?(hash(seed,row,run.left)-.5)*spacing*.22:0)
      const trailingHair = (run.left<218 && y<155) || (run.left>310 && y<76)
      const lag=smear*(trailingHair?35:thin?5:14)
      let cursor=run.left
      let stroke=run.left*8
      while(cursor<run.right) {
        const key=stroke++
        const r=hash(seed,row,key+11), s=hash(seed,row,key+79)
        const t=hash(seed,row,key+163), u=hash(seed,row,key+251)
        const nibWidth=(22+88*r*r)*length
        const advance=Math.max(3,Math.min(run.right-cursor,nibWidth*(.54+.21*s)))
        const mid=Math.min(width-1,Math.floor(cursor-run.left+advance*.48))
        const raw=run.density[mid]/255
        // A softer shoulder and flank separate the darker neck from the barrel.
        // Retain the lighting of the moving rig underneath the graphite.
        const poll=Math.max(0,Math.min(1,(cursor+advance*.5-405)/111))
        const tone=Math.min(1,Math.max(.035,(raw*bias-.335)/.48 + poll*.27))
        const strength=thin?Math.max(.64,tone):tone
        const markY=rowY+(s-.5)*(thin?spacing*.90:1.36)
        const previous=cursor===run.left
        const trail=previous?lag*(.14+1.30*t*t):Math.min(cursor-run.left,advance*(.40+.32*s))
        const lead=cursor+advance>=run.right?1.2+2*u:Math.min(run.right-cursor-advance,advance*.34)
        const w=Math.max(thin?8:4,advance+trail+lead)
        if (u < .72+.28*strength || thin) {
          stamp(cursor-trail,markY,w,(3.5+5.8*strength)*pressure*(.79+.44*r),
            (.18+.90*strength)*darkness*(.80+.20*t))
        }
        if (previous && raw>.15 && t>.78 && (trailingHair || width>25)) {
          const reach=lag*(1.0+u*.75)
          stamp(run.left-reach,markY-.7,reach+advance,.95+s*1.45,Math.min(.25,strength*.23))
        }
        cursor+=advance
      }
    }
  }
  for(let i=0;i<13;i++){
    const x=pose.tail.x-42+hash(seed,-2,i)*60, y=pose.tail.y+(hash(seed,-3,i)-.5)*32
    const size=.45+hash(seed,-4,i)*.7
    stamp(x,y,size*2.1,size,.08+.19*hash(seed,-5,i))
  }
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1
}
