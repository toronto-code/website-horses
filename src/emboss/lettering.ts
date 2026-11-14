// Sculpt the large letters once at display resolution. The face is smooth,
// bright silver over the grainy plate, like the raised lettering on a card.
function render(element: HTMLElement) {
  const text = element.textContent?.trim()
  if (!text || !element.offsetWidth) return
  const css = getComputedStyle(element)
  const size = parseFloat(css.fontSize)
  const scale = Math.max(2, Math.min(3, window.devicePixelRatio || 1))
  const pad = Math.ceil(size * .18)
  const width = Math.ceil((element.offsetWidth + pad * 2) * scale)
  const height = Math.ceil((element.offsetHeight + pad * 2) * scale)
  const mask = document.createElement('canvas')
  mask.width = width
  mask.height = height
  const pen = mask.getContext('2d', { willReadFrequently: true })
  if (!pen) return
  pen.scale(scale, scale)
  pen.font = css.fontStyle + ' ' + css.fontWeight + ' ' + css.fontSize + ' ' + css.fontFamily
  pen.letterSpacing = css.letterSpacing
  const metrics = pen.measureText(text)
  const ascent = metrics.fontBoundingBoxAscent
  const descent = metrics.fontBoundingBoxDescent
  const lineHeight = parseFloat(css.lineHeight)
  pen.fillText(text, pad, pad + (lineHeight - ascent - descent) / 2 + ascent)
  // Wrapped headings keep the native relief, which follows the browser's lines.
  if (element.offsetHeight > lineHeight + 2) {
    element.querySelector('canvas')?.remove()
    element.classList.remove('emboss-ready')
    return
  }

  const pixels = pen.getImageData(0, 0, width, height)
  const field = new Float32Array(width * height)
  for (let i = 0; i < field.length; i++) {
    const alpha = pixels.data[i * 4 + 3] / 255
    field[i] = alpha === 1 ? Infinity : alpha
  }
  const diag = Math.SQRT2
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x
    field[i] = Math.min(field[i], field[i-1]+1, field[i-width]+1,
      field[i-width-1]+diag, field[i-width+1]+diag)
  }
  for (let y = height-2; y > 0; y--) for (let x = width-2; x > 0; x--) {
    const i = y * width + x
    field[i] = Math.min(field[i], field[i+1]+1, field[i+width]+1,
      field[i+width+1]+diag, field[i+width-1]+diag)
  }
  const radius = Math.max(1.1, size * .033) * scale
  for (let i = 0; i < field.length; i++) {
    const u = Math.min(1, field[i] / radius)
    field[i] = radius * Math.sqrt(u * (2-u))
  }

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) return
  // Raised lettering: the face is polished silver catching light from above,
  // while a wide soft cast and a tight contact shadow fall below it.
  ctx.globalAlpha = .40
  ctx.filter = 'blur(' + size * .032 * scale + 'px)'
  ctx.drawImage(mask, size * .018 * scale, size * .050 * scale)
  ctx.globalAlpha = .50
  ctx.filter = 'blur(' + size * .011 * scale + 'px)'
  ctx.drawImage(mask, size * .009 * scale, size * .024 * scale)
  ctx.filter = 'none'
  ctx.globalCompositeOperation = 'destination-out'
  ctx.globalAlpha = 1
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-over'

  for (let i = width+1; i < field.length-width-1; i++) {
    const p = i * 4
    if (!pixels.data[p+3]) continue
    const nx = (field[i-1] - field[i+1]) * .5
    const ny = (field[i-width] - field[i+width]) * .5
    const norm = Math.hypot(nx, ny, 1)
    const lambert = (-.16*nx - .74*ny + .60) / norm
    const diffuse = lambert + .057
    const specular = Math.pow(Math.max(0, lambert), 16)
    const shade = Math.max(-.85, Math.min(.95, .12 + (diffuse - .657) * 1.45 + specular * .5))
    const value = Math.max(0, Math.min(255, Math.round(205 + 46 * shade)))
    pixels.data[p] = pixels.data[p+1] = pixels.data[p+2] = value
    pixels.data[p+3] *= .94
  }
  pen.putImageData(pixels, 0, 0)
  ctx.drawImage(mask, 0, 0)
  out.style.width = width / scale + 'px'
  out.style.height = height / scale + 'px'
  out.style.left = out.style.top = -pad + 'px'
  out.setAttribute('aria-hidden', 'true')
  element.querySelector('canvas')?.remove()
  element.append(out)
  element.classList.add('emboss-ready')
}

export async function mountLettering() {
  await document.fonts.ready
  const headings = document.querySelectorAll<HTMLElement>('h1,h2')
  const observer = new ResizeObserver(entries => {
    for (const {target} of entries) render(target as HTMLElement)
  })
  headings.forEach(el => observer.observe(el))
}
