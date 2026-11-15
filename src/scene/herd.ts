import {
  drawHorse, drawingRate, loadMaterials, FLIGHT_POSE, FRAME_WIDTH, FRAME_HEIGHT,
  GROUND_Y, HORSE_LENGTH, IDLE_POSE_STEP, POSE_COUNT, SCROLL_POSE_STEP, STRIDE_LENGTH,
} from './frames'

const lanes = [
  { name:'far', size:.22, baseline:.44, alpha:.60, start:.58, pose:0, seed:17 },
  { name:'mid', size:.40, baseline:.60, alpha:.81, start:-.06, pose:19, seed:31 },
  { name:'near', size:.62, baseline:.84, alpha:1, start:.27, pose:38, seed:47 },
] as const

export async function mountHerd(stage: HTMLElement, hero: HTMLElement) {
  const materials = await loadMaterials()
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const fps = drawingRate(new URLSearchParams(location.search).get('drawnFps'))
  const interval = 1000/fps
  // Randomise once, in separate thirds of a drawing interval so simultaneous
  // initialization cannot put all three horses on the same exposure.
  const random = crypto.getRandomValues(new Uint32Array(lanes.length+1))
  const offset = random[0]/2**32
  const tracks = lanes.map((lane,i) => {
    const canvas=document.createElement('canvas')
    canvas.className='horse'
    canvas.dataset.lane=lane.name
    canvas.style.opacity=String(lane.alpha)
    stage.append(canvas)
    return {lane,canvas,pose:Number(lane.pose),drawIndex:0,x:0,y:0,scale:1,visible:true,
      start:0,span:1,clockPhase:(offset+(i+random[i+1]/2**32)/3)%1,next:0,laidOut:false}
  })
  type Track = typeof tracks[number]
  let previousWidth=0, request=0, last=0, scroll=window.scrollY, velocity=0, heroHeight=1, previousOpacity=-1

  function paint(track:Track) {
    drawHorse(track.canvas,materials,track.pose,track.drawIndex,track.lane.seed)
    track.canvas.style.transform='translate3d('+track.x+'px,'+track.y+'px,0)'
    track.canvas.dataset.pose=String(track.pose)
    track.canvas.dataset.drawing=String(track.drawIndex)
  }
  function fade(dt:number) {
    const target=window.scrollY, displacement=scroll-target, omega=12
    const b=velocity+omega*displacement, decay=Math.exp(-omega*dt)
    scroll=motion.matches?target:target+(displacement+b*dt)*decay
    velocity=motion.matches?0:(velocity-b*omega*dt)*decay
    const t=Math.min(1,Math.max(0,scroll/(heroHeight*.90)))
    const alpha=1-.78*t*t*(3-2*t)
    if(Math.abs(alpha-previousOpacity)>.0001) {
      stage.style.opacity=String(alpha);previousOpacity=alpha
    }
  }
  function tick(now:number) {
    request=0
    if (document.hidden) return
    fade(last?Math.min(.1,(now-last)/1000):0)
    last=now
    if (motion.matches) return
    for(const track of tracks) {
      if(!track.visible || now<track.next) continue
      const step=Math.abs(velocity)>120?SCROLL_POSE_STEP:IDLE_POSE_STEP
      track.pose=(track.pose+step)%POSE_COUNT
      track.drawIndex++
      track.x+=STRIDE_LENGTH*track.scale*step/POSE_COUNT
      if(track.x>=stage.clientWidth) track.x-=track.span
      paint(track)
      // Missed exposures are dropped. Never interpolate or catch up by
      // drawing multiple poses into the same display frame.
      track.next+=interval*(1+Math.floor((now-track.next)/interval))
    }
    schedule()
  }
  function schedule() {
    if(!request && !document.hidden) request=requestAnimationFrame(tick)
  }
  function layout() {
    const width=stage.clientWidth,height=stage.clientHeight
    if(!width || !height) return
    heroHeight=hero.offsetHeight
    const portrait=width<height && width<900
    const titleBottom=hero.querySelector('h1')!.getBoundingClientRect().bottom+window.scrollY
    for(const [i,track] of tracks.entries()){
      const {lane,canvas}=track
      const progress=(track.x+track.span-previousWidth)/track.span
      track.visible=!(portrait && i===0)
      canvas.hidden=!track.visible
      if(!track.visible) continue
      const size=portrait?(i===2?.94:.51):lane.size
      const horseWidth=Math.min(size*width,height*(i===2?1.26:.80))
      track.scale=horseWidth/HORSE_LENGTH
      const w=track.scale*FRAME_WIDTH,h=track.scale*FRAME_HEIGHT
      const topOfInk=titleBottom+24
      const baseline=(portrait?(i===2?.80:.53):lane.baseline)*height
      // Include the name's clearance in the lane geometry, even on short screens.
      track.y=Math.max(topOfInk-12*track.scale,baseline-GROUND_Y*track.scale)
      track.start=(portrait?(i===2?-.12:.36):lane.start)*width
      const oldSpan=track.span
      track.span=width+w
      track.x=track.laidOut && oldSpan>1 && !motion.matches?
        progress*track.span-w:track.start
      // The canvas is larger than the silhouette and reserves room for the trailing ink.
      const resolution=Math.min(2,window.devicePixelRatio||1,2048/w)
      canvas.width=Math.max(1,Math.round(w*resolution))
      canvas.height=Math.max(1,Math.round(h*resolution))
      canvas.style.width=w+'px';canvas.style.height=h+'px'
      if(motion.matches) track.pose=FLIGHT_POSE
      paint(track);track.laidOut=true
    }
    previousWidth=width
  }
  function resetClocks() {
    cancelAnimationFrame(request);request=0;last=0
    if(document.hidden) return
    const now=performance.now()
    for(const track of tracks) track.next=now+interval*(.10+.90*track.clockPhase)
    schedule()
  }
  function syncMotion() {
    for(const track of tracks) {
      track.pose=motion.matches?FLIGHT_POSE:track.lane.pose
      track.drawIndex=0;track.laidOut=false
    }
    layout();resetClocks()
  }
  new ResizeObserver(layout).observe(stage)
  motion.addEventListener('change',syncMotion)
  document.addEventListener('visibilitychange',resetClocks)
  window.addEventListener('scroll',schedule,{passive:true})
  syncMotion()
}
