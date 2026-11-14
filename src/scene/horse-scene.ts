import { createHerd } from './herd'

export function startHorses() {
  const canvas = document.querySelector<HTMLCanvasElement>('#herd')!
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const drawHerd = createHerd()
  let renderer: Awaited<ReturnType<typeof import('./horse-renderer').createHorseRenderer>> | undefined
  let width = 0, height = 0, dpr = 1
  let clock = 0, previous = 0, frame = 0, disposed = false
  let smoothScroll = window.scrollY
  let lastY = NaN
  let exclusions: DOMRect[] = []

  function measureText() {
    exclusions = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    let node
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim() || !node.parentElement?.closest('header, main, footer, a.skip')) continue
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.width && rect.height && rect.bottom > 0 && rect.top < height) exclusions.push(rect)
      }
    }
    lastY = window.scrollY
  }
  function schedule() {
    if (!disposed && !document.hidden && !frame) frame = requestAnimationFrame(draw)
  }
  function resize() {
    width = canvas.clientWidth
    height = canvas.clientHeight
    dpr = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.round(width*dpr)
    canvas.height = Math.round(height*dpr)
    lastY = NaN
    schedule()
  }
  function draw(now: number) {
    frame = 0
    if (!renderer || !ctx || document.hidden) return
    const still = motion.matches
    const dt = previous && !still ? Math.min((now-previous)/1000,.06) : 0
    clock += dt
    previous = now
    const old = smoothScroll
    smoothScroll += (window.scrollY-smoothScroll)*(1-Math.pow(.9,dt*60))
    ctx.setTransform(dpr,0,0,dpr,0,0)
    ctx.clearRect(0,0,width,height)
    const lane = { x: 0, top: height*.32, w: width, h: height*.52 }
    drawHerd(ctx,renderer,lane,dt,smoothScroll-old,clock,still)
    // Only horse ink is removed around visible text; the static image shows through.
    if (lastY !== window.scrollY) measureText()
    for (const r of exclusions) ctx.clearRect(r.left-10,r.top-6,r.width+20,r.height+12)
    if (!still) schedule()
  }
  function restart() {
    cancelAnimationFrame(frame)
    frame = previous = 0
    schedule()
  }
  function invalidateText() { lastY = NaN; schedule() }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)
  window.addEventListener('scroll', schedule, {passive:true})
  document.addEventListener('toggle', invalidateText, true)
  document.addEventListener('focusin', invalidateText)
  document.addEventListener('focusout', invalidateText)
  motion.addEventListener('change', restart)
  document.addEventListener('visibilitychange', restart)
  import('./horse-renderer').then(m => m.createHorseRenderer()).then(model => {
    if (disposed) model.dispose()
    else { renderer = model; schedule() }
  }).catch(error => console.warn('Horse renderer unavailable',error))
  return () => {
    disposed = true
    cancelAnimationFrame(frame)
    observer.disconnect()
    renderer?.dispose()
    window.removeEventListener('scroll', schedule)
    document.removeEventListener('toggle', invalidateText, true)
    document.removeEventListener('focusin', invalidateText)
    document.removeEventListener('focusout', invalidateText)
    document.removeEventListener('visibilitychange', restart)
    motion.removeEventListener('change', restart)
  }
}
