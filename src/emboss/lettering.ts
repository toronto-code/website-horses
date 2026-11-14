// Sculpt the large letters once at display resolution. The face stays partly
// transparent so the plate's grain carries through as the heading scrolls.
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
  // A wide cast shadow, a tight contact shadow, and the exposed lower-left
  // wall have different extents. Their separation gives the lettering height.
  ctx.globalAlpha = .54
  ctx.filter = 'blur(' + size * .028 * scale + 'px)'
  ctx.drawImage(mask, -size * .026 * scale, size * .052 * scale)
  ctx.globalAlpha = .59
  ctx.filter = 'blur(' + size * .009 * scale + 'px)'
  ctx.drawImage(mask, -size * .012 * scale, size * .024 * scale)
  ctx.filter = 'none'
  ctx.globalAlpha = .56
  ctx.drawImage(mask, -size * .007 * scale, size * .014 * scale)
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
    const diffuse = (.50*nx - .73*ny + .466) / norm
    const specular = Math.pow(Math.max(0, (.292*nx - .426*ny + .856) / norm), 17)
    const shade = Math.max(-.88, Math.min(.96, .11 + (diffuse - .466) * 1.3 + specular * .60))
    const value = shade > 0 ? 255 : 10
    pixels.data[p] = pixels.data[p+1] = pixels.data[p+2] = value
    pixels.data[p+3] *= Math.abs(shade)
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
