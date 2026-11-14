import { mountLettering } from './emboss/lettering'
import { drawHorse, loadMaterials, drawingRate, FLIGHT_POSE, FRAME_WIDTH, FRAME_HEIGHT,
  IDLE_POSE_STEP, POSE_COUNT, SEED_CYCLE } from './scene/frames'

async function study() {
  const materials=await loadMaterials()
  const pose=document.querySelector<HTMLCanvasElement>('#pose')!
  const held=document.querySelector<HTMLCanvasElement>('#held')!
  const source=new Image();source.src='/horse/held.webp';await source.decode()
  held.getContext('2d')!.drawImage(source,0,0)
  const crop=document.querySelector<HTMLCanvasElement>('#frame-crop')!.getContext('2d')!
  const sourceCrop=document.querySelector<HTMLCanvasElement>('#source-crop')!.getContext('2d')!
  sourceCrop.drawImage(source,427,187,300,140,0,0,300,140)
  const slider=document.querySelector<HTMLInputElement>('#frame')!
  const seed=47
  function draw(canvas:HTMLCanvasElement,n:number) {
    drawHorse(canvas,materials,(FLIGHT_POSE+n*IDLE_POSE_STEP)%POSE_COUNT,n,seed)
  }
  function setFrame(frame:number) {
    const f=(frame+SEED_CYCLE)%SEED_CYCLE
    slider.value=String(f)
    draw(pose,f)
    crop.clearRect(0,0,300,140);crop.drawImage(pose,226,58,300,140,0,0,300,140)
    document.querySelector('#current')!.textContent=String(f+1).padStart(2,'0')+' / '+SEED_CYCLE
  }
  let timer=0
  const play=document.querySelector<HTMLButtonElement>('#play')!
  function pause() {clearInterval(timer);timer=0;play.textContent='Play'}
  slider.oninput=()=>{pause();setFrame(+slider.value)}
  document.querySelector('#previous')!.addEventListener('click',()=>{pause();setFrame(+slider.value-1)})
  document.querySelector('#next')!.addEventListener('click',()=>{pause();setFrame(+slider.value+1)})
  const fps=drawingRate(new URLSearchParams(location.search).get('drawnFps'))
  play.onclick=()=>{if(timer) pause();else {timer=window.setInterval(()=>setFrame(+slider.value+1),1000/fps);play.textContent='Pause'}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()})
  for(let i=0;i<8;i++){
    const figure=document.createElement('figure'),canvas=document.createElement('canvas')
    canvas.width=FRAME_WIDTH;canvas.height=FRAME_HEIGHT;draw(canvas,i)
    const caption=document.createElement('figcaption');caption.textContent='Drawing '+String(i+1).padStart(2,'0')
    figure.append(canvas,caption);document.querySelector('#sequence')!.append(figure)
  }
  setFrame(0)
}
void mountLettering()
void study()
