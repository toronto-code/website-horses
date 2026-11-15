// The approved 05 · Serial stamp is already pressed into photographed metal.
// Composite that actual material into the plate; do not rebuild its typography.
const ART = {
  src: '/service-silver/serial-stamp.webp',
  inkX: 109, inkY: 206, inkWidth: 925, inkHeight: 82,
  sideFade: 75, topFade: 145, bottomFade: 330,
} as const

async function loadImage(src: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}

function materialStrip(image: HTMLImageElement) {
  const strip = document.createElement('canvas')
  strip.width = image.naturalWidth
  strip.height = image.naturalHeight
  const ctx = strip.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(image, 0, 0)
  // The complete lettering sits inside the fully opaque portion. Only the
  // surrounding bare metal fades, giving the material a seamless transition.
  ctx.globalCompositeOperation = 'destination-in'
  const vertical = ctx.createLinearGradient(0, 0, 0, strip.height)
  vertical.addColorStop(0, 'transparent')
  vertical.addColorStop(ART.topFade / strip.height, '#fff')
  vertical.addColorStop(ART.bottomFade / strip.height, '#fff')
  vertical.addColorStop(1, 'transparent')
  ctx.fillStyle = vertical
  ctx.fillRect(0, 0, strip.width, strip.height)
  const horizontal = ctx.createLinearGradient(0, 0, strip.width, 0)
  horizontal.addColorStop(0, 'transparent')
  horizontal.addColorStop(ART.sideFade / strip.width, '#fff')
  horizontal.addColorStop(1 - ART.sideFade / strip.width, '#fff')
  horizontal.addColorStop(1, 'transparent')
  ctx.fillStyle = horizontal
  ctx.fillRect(0, 0, strip.width, strip.height)
  return strip
}

export async function mountStamp(element: HTMLElement, image: HTMLImageElement,
  canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  const plate = document.createElement('canvas')
  const plateCtx = plate.getContext('2d')
  if (!ctx || !plateCtx) return
  const forced = matchMedia('(forced-colors: active)')
  let artwork: HTMLCanvasElement | null = null
  let texture: HTMLImageElement | null = null
  let loaded = '', plateKey = '', loadId = 0, frame = 0

  function fallback() {
    canvas.hidden = true
    element.classList.remove('stamp-ready')
  }
  function render() {
    frame = 0
    if (!texture || !artwork || forced.matches) { fallback(); return }
    const rect = element.getBoundingClientRect()
    const vw = image.clientWidth, vh = image.clientHeight
    if (!vw || !vh || rect.bottom < 0 || rect.top > vh) {
      canvas.hidden = true
      return
    }
    const scale = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.round(vw * scale), height = Math.round(vh * scale)
    const key = [width, height, loaded].join('|')
    if (key !== plateKey) {
      plate.width = canvas.width = width
      plate.height = canvas.height = height
      const cover = Math.max(width / texture.naturalWidth, height / texture.naturalHeight)
      const w = texture.naturalWidth * cover, h = texture.naturalHeight * cover
      plateCtx!.drawImage(texture, (width - w) / 2, (height - h) / 2, w, h)
      plateKey = key
    }
    // Fit the approved lettering as a single unit. Its proportions, spacing,
    // grain and die edges stay intact at every screen width.
    const fit = rect.width / ART.inkWidth
    const left = rect.left - ART.inkX * fit
    const top = rect.top + (rect.height - ART.inkHeight * fit) / 2 - ART.inkY * fit
    ctx!.drawImage(plate, 0, 0)
    ctx!.drawImage(artwork, left * scale, top * scale,
      artwork.width * fit * scale, artwork.height * fit * scale)
    canvas.hidden = false
    element.classList.add('stamp-ready')
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(render)
  }
  async function loadPlate() {
    const url = image.currentSrc || image.src
    if (loaded === url && texture) { schedule(); return }
    const id = ++loadId
    try {
      const next = await loadImage(url)
      if (id !== loadId) return
      texture = next
      loaded = url
      plateKey = ''
      schedule()
    } catch { if (id === loadId) fallback() }
  }
  const observer = new ResizeObserver(schedule)
  observer.observe(element)
  observer.observe(image)
  image.addEventListener('load', () => void loadPlate())
  window.addEventListener('resize', schedule)
  window.addEventListener('scroll', schedule, { passive: true })
  forced.addEventListener('change', schedule)
  try {
    const [stamp] = await Promise.all([
      loadImage(ART.src), document.fonts.ready, loadPlate(),
    ])
    artwork = materialStrip(stamp)
    schedule()
  } catch { fallback() }
}
