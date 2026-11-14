import { createHorseRenderer, studyPoses } from './scene/horse-renderer'

async function study() {
  const renderer = await createHorseRenderer()
  const live = document.querySelector<HTMLCanvasElement>('#live-horse')!
  const sheet = document.querySelector<HTMLElement>('#specimens')!
  for (const { phase, name } of studyPoses) {
    const figure = document.createElement('figure')
    const img = renderer.frame('near', phase)
    const still = img.cloneNode(false) as HTMLCanvasElement
    still.getContext('2d')!.drawImage(img,0,0)
    still.setAttribute('role','img')
    still.setAttribute('aria-label',name)
    const caption = document.createElement('figcaption')
    caption.textContent = `${phase*100}% / ${name}`
    figure.append(still,caption)
    sheet.append(figure)
  }
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let time = 0, last = 0, handle = 0
  const pen = live.getContext('2d')!
  function draw(now:number) {
    handle = 0
    if (document.hidden) return
    time += last && !motion.matches ? Math.min(now-last,80)/1000 : 0
    last = now
    const img = renderer.frame('near',time*.9)
    pen.clearRect(0,0,live.width,live.height)
    pen.drawImage(img,0,0,live.width,live.height)
    if (!motion.matches) handle = requestAnimationFrame(draw)
  }
  function restart() {
    cancelAnimationFrame(handle)
    last = 0
    if (!document.hidden) handle = requestAnimationFrame(draw)
  }
  document.addEventListener('visibilitychange',restart)
  motion.addEventListener('change',restart)
  restart()
  if (import.meta.hot) import.meta.hot.dispose(() => {
    cancelAnimationFrame(handle)
    motion.removeEventListener('change',restart)
    document.removeEventListener('visibilitychange',restart)
    renderer.dispose()
  })
}
study().catch(() => {
  document.querySelector('#specimens')!.textContent = 'The horse study could not load. Reload with WebGL enabled.'
})
