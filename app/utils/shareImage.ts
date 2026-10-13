// The 1080×1920 share image, drawn client-side on a canvas (SPEC §5.4) in
// the recap's look (M2.5 P1): the accent with soft blobs and grain (Paper:
// paper, grain and an accent bar), "{first_name}'s {year} with {business}",
// the headline stats as tiles like the share card, and "Made with Highreel".
// Since M2.5 P4 also a 1080×1080 square for feed posts (business recaps).

import type { RecapPayload } from '#shared/types/recap'
import { mix, recapPalette } from '#shared/utils/color'
import { seeded } from '#shared/utils/scenes'
import { shareStats, shareTexts } from '#shared/utils/slides'
import { getTemplate, templateFor } from '#shared/templates'

export type ShareFormat = 'story' | 'square'

const W = 1080
const STORY_H = 1920
const PAD = 96

/** Stat tile sizes: tile height, padding, largest value, value-to-label gap, label size. */
const TILES = {
  story: { h: 300, inner: 44, value: 120, gap: 64, label: 38 },
  storyPhoto: { h: 230, inner: 44, value: 92, gap: 64, label: 38 },
  square: { h: 190, inner: 36, value: 84, gap: 58, label: 32 },
  squarePhoto: { h: 140, inner: 26, value: 56, gap: 48, label: 26 },
}
const SANS = 'Geist, ui-sans-serif, system-ui, sans-serif'
const MONO = '"Google Sans Code", ui-monospace, monospace'

async function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts)
    return
  await Promise.all([
    document.fonts.load(`700 120px Geist`),
    document.fonts.load(`500 48px Geist`),
    document.fonts.load(`600 100px "Google Sans Code"`),
  ]).catch(() => {})
  await document.fonts.ready
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test
    }
    else {
      lines.push(line)
      line = word
    }
  }
  if (line)
    lines.push(line)
  return lines
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous' // keeps the canvas exportable (/media links are same-origin anyway)
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Draw `img` to cover the box, cropping the overflow (like object-fit: cover). */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

/** A soft colour blob, like the recap backdrop. */
function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, colour: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, colour)
  g.addColorStop(1, `${colour}00`)
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

/** Fine grain over everything (seeded, so the image is the same every time). */
function grain(ctx: CanvasRenderingContext2D, mode: GlobalCompositeOperation, alpha: number, H: number) {
  const tile = document.createElement('canvas')
  tile.width = 180
  tile.height = 180
  const t = tile.getContext('2d')!
  const data = t.createImageData(180, 180)
  const rand = seeded('grain')
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.round(rand() * 255)
    data.data[i] = v
    data.data[i + 1] = v
    data.data[i + 2] = v
    data.data[i + 3] = 255
  }
  t.putImageData(data, 0, 0)
  ctx.save()
  ctx.globalCompositeOperation = mode
  ctx.globalAlpha = alpha
  ctx.fillStyle = ctx.createPattern(tile, 'repeat')!
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

/** Largest font size (≤ max, ≥ min) at which `text` fits on one line; null if it doesn't fit at min. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: string, weight: number, max: number, min: number, maxWidth: number): number | null {
  for (let size = max; size >= min; size -= 4) {
    ctx.font = `${weight} ${size}px ${font}`
    if (ctx.measureText(text).width <= maxWidth)
      return size
  }
  return null
}

export async function renderShareImage(p: RecapPayload, format: ShareFormat = 'story'): Promise<Blob> {
  const square = format === 'square'
  const H = square ? W : STORY_H
  const photoUrl = p.settings.photo_in_share_image ? p.settings.photos.find(ph => ph.url)?.url : undefined
  const [, logo, photo] = await Promise.all([
    fontsReady(),
    p.business.logo_url ? loadImage(p.business.logo_url) : null,
    photoUrl ? loadImage(photoUrl) : null,
  ])
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const paper = p.settings.theme === 'paper'
  const tone = recapPalette(p.business.accent_color, p.settings.theme).accent
  // Paper sets pure numbers in mono; words ("Top 17%", "Pony rider") stay in Geist.
  const numFont = (v: string) => (paper && /^[\d,.%€$£+]+$/.test(v) ? MONO : SANS)

  ctx.fillStyle = tone.bg
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  const photoH = photo ? (square ? 360 : 820) : 0

  if (paper) {
    grain(ctx, 'multiply', 0.1, H)
  }
  else {
    blob(ctx, W - 80, square ? 180 : 260, square ? 520 : 620, mix('#FFFFFF', tone.bg, 0.3))
    blob(ctx, 60, H - (square ? 220 : 380), square ? 460 : 560, mix('#000000', tone.bg, 0.22))
    blob(ctx, W * 0.7, H * 0.62, square ? 340 : 420, mix('#FFFFFF', tone.bg, 0.14))
    grain(ctx, 'overlay', 0.12, H)
  }
  if (photo)
    drawCover(ctx, photo, 0, 0, W, photoH)
  else if (paper) {
    ctx.fillStyle = tone.shape
    ctx.fillRect(0, 0, W, square ? 22 : 28)
  }

  // Mark (the logo filling its circle or rounded square, else the initial) +
  // business name, under the photo if there is one
  const markY = photo ? photoH + (square ? 40 : 64) : PAD
  const markShape = () => {
    if (p.business.logo_shape === 'square') {
      roundRect(ctx, PAD, markY, 88, 88, 20)
    }
    else {
      ctx.beginPath()
      ctx.arc(PAD + 44, markY + 44, 44, 0, Math.PI * 2)
    }
  }
  if (logo) {
    ctx.save()
    markShape()
    ctx.clip()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(PAD, markY, 88, 88)
    const s = Math.max(88 / logo.width, 88 / logo.height)
    ctx.drawImage(logo, PAD + 44 - (logo.width * s) / 2, markY + 44 - (logo.height * s) / 2, logo.width * s, logo.height * s)
    ctx.restore()
  }
  else {
    ctx.fillStyle = tone.fg
    markShape()
    ctx.fill()
    ctx.fillStyle = tone.bg
    ctx.font = `700 48px ${SANS}`
    ctx.textAlign = 'center'
    ctx.fillText((p.business.name.trim()[0] ?? 'R').toUpperCase(), PAD + 44, markY + 61)
    ctx.textAlign = 'left'
  }
  ctx.fillStyle = tone.fg
  ctx.font = `600 40px ${SANS}`
  ctx.fillText(p.business.name, PAD + 112, markY + 58)

  // Title
  const titleSize = photo ? (square ? 60 : 84) : (square ? 92 : 112)
  const maxLines = photo ? (square ? 1 : 2) : (square ? 2 : 3)
  let y = photo ? markY + (square ? 150 : 220) : (square ? 330 : 470)
  ctx.font = `700 ${titleSize}px ${SANS}`
  const title = shareTexts(templateFor(p.template_key, p.settings), p).title
  for (const line of wrap(ctx, title, W - PAD * 2).slice(0, maxLines)) {
    ctx.fillText(line, PAD, y)
    y += titleSize * 1.08
  }

  // Stat tiles, two columns; with three stats the last one spans both. The
  // square anchors them to the bottom, the story under the title.
  const stats = shareStats(templateFor(p.template_key, p.settings), p).slice(0, 4)
  const tile = TILES[square ? (photo ? 'squarePhoto' : 'square') : (photo ? 'storyPhoto' : 'story')]
  const gap = square ? 24 : 28
  const colW = (W - PAD * 2 - gap) / 2
  const rows = Math.ceil(stats.length / 2)
  const top = square
    ? H - PAD - 56 - (rows * tile.h + (rows - 1) * gap)
    : Math.max(y + (photo ? 30 : 70), photo ? 0 : 900)
  stats.forEach((stat, i) => {
    const wide = stats.length === 3 && i === 2
    const x = PAD + (wide ? 0 : (i % 2) * (colW + gap))
    const w = wide ? W - PAD * 2 : colW
    const ty = top + Math.floor(i / 2) * (tile.h + gap)
    ctx.save()
    ctx.globalAlpha = paper ? 0.07 : 0.13
    ctx.fillStyle = tone.fg
    roundRect(ctx, x, ty, w, tile.h, square ? 26 : 32)
    ctx.fill()
    ctx.restore()

    const one = fit(ctx, stat.value, numFont(stat.value), 700, tile.value, Math.min(64, tile.value), w - tile.inner * 2)
    ctx.fillStyle = tone.hi
    const labelY = ty + tile.h - tile.inner
    if (one) {
      ctx.font = `700 ${one}px ${numFont(stat.value)}`
      ctx.fillText(stat.value, x + tile.inner, labelY - tile.gap)
    }
    else {
      // Long words ("The bonfire night") take two lines.
      const size = Math.round(Math.min(56, tile.value * 0.62))
      ctx.font = `700 ${size}px ${SANS}`
      const lines = wrap(ctx, stat.value, w - tile.inner * 2).slice(0, 2)
      lines.forEach((l, k) => ctx.fillText(l, x + tile.inner, labelY - tile.gap - (lines.length - 1 - k) * Math.round(size * 1.07)))
    }
    ctx.fillStyle = tone.fg
    ctx.globalAlpha = 0.8
    ctx.font = `500 ${fit(ctx, stat.label, SANS, 500, tile.label, 22, w - tile.inner * 2) ?? 22}px ${SANS}`
    ctx.fillText(stat.label, x + tile.inner, labelY)
    ctx.globalAlpha = 1
  })

  // Footer
  ctx.fillStyle = tone.fg
  ctx.globalAlpha = 0.7
  ctx.font = `500 34px ${SANS}`
  ctx.fillText('Made with Highreel', PAD, H - (square ? 64 : PAD))
  ctx.globalAlpha = 1

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png')
  })
}

export function shareFileName(p: RecapPayload, format: ShareFormat = 'story'): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  // A business recap is about the business, not a person.
  const who = getTemplate(p.template_key).kind === 'business' ? '' : `-${slug(p.recipient.first_name) || 'highreel'}`
  return `${slug(p.business.name) || 'highreel'}-${p.year}${who}${format === 'square' ? '-square' : ''}.png`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Only trust file sharing when the browser says it can share this exact kind of file. */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share)
    return false
  try {
    return navigator.canShare({ files: [new File(['x'], 'recap.png', { type: 'image/png' })] })
  }
  catch {
    return false
  }
}
