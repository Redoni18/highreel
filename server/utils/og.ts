// Per-recipient link-preview image, 1200×630 (SPEC M2g): an SVG drawn here
// and rendered to PNG by resvg (WebAssembly), with Geist from server/assets.
// Same look as the share image (M2.5 P1): the accent with soft blobs and
// grain (Paper: paper, grain, accent bar), mark, title, two stat tiles.

/// <reference path="../wasm.d.ts" />

import { initWasm, Resvg } from '@resvg/resvg-wasm'
// A compiled WebAssembly.Module (unwasm's `?module`): imported as an ES module on
// Workers (SPEC M2.14 P0), which can't compile wasm from bytes at runtime.
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm?module'
import type { RecapPayload } from '#shared/types/recap'
import { templateFor } from '#shared/templates'
import { resolveLook } from '#shared/templates/designs'
import { mix, recapPalette } from '#shared/utils/color'
import { shareStats, shareTexts } from '#shared/utils/slides'

const W = 1200
const H = 630

let ready: Promise<Uint8Array[]> | null = null

async function asset(storage: string, key: string): Promise<Uint8Array> {
  const raw = await useStorage(storage).getItemRaw(key)
  if (!raw)
    throw new Error(`Missing server asset ${storage}/${key}`)
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer)
}

/** Load the wasm and fonts once per server process. */
function setup(): Promise<Uint8Array[]> {
  ready ??= (async () => {
    await initWasm(resvgWasm)
    return Promise.all([
      asset('assets:server', 'fonts:Geist-Bold.ttf'),
      asset('assets:server', 'fonts:Geist-Medium.ttf'),
    ])
  })().catch((e) => {
    ready = null
    throw e
  })
  return ready
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)

/** Greedy word wrap using an average glyph width (Geist Bold ≈ 0.56 em). */
function wrap(text: string, size: number, maxWidth: number, maxLines: number): string[] | null {
  const perLine = Math.floor(maxWidth / (size * 0.56))
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= perLine || !line) {
      line = next
    }
    else {
      lines.push(line)
      line = word
    }
  }
  if (line)
    lines.push(line)
  return lines.length <= maxLines && lines.every(l => l.length <= perLine) ? lines : null
}

export async function renderOgImage(p: RecapPayload, logo: { data: Uint8Array, type: string } | null): Promise<Uint8Array> {
  const fonts = await setup()
  const t = templateFor(p.template_key, p.settings)
  const look = resolveLook(p.settings.look)
  const paper = look.theme === 'paper'
  const tone = recapPalette(look.accent, look.theme).accent
  const title = shareTexts(t, p).title
  const stats = shareStats(t, p).slice(0, 2)

  let size = 76
  let lines = wrap(title, size, 960, 2)
  while (!lines && size > 44) {
    size -= 6
    lines = wrap(title, size, 960, 3)
  }
  lines ??= [title]

  // The mark fills its circle or rounded square (Your brand's logo shape), no frame.
  const rx = p.business.logo_shape === 'square' ? 16 : 36
  const mark = logo
    ? `<clipPath id="mark"><rect x="72" y="64" width="72" height="72" rx="${rx}"/></clipPath>
       <g clip-path="url(#mark)"><rect x="72" y="64" width="72" height="72" fill="#FFFFFF"/>
       <image x="72" y="64" width="72" height="72" preserveAspectRatio="xMidYMid slice" href="data:${logo.type};base64,${Buffer.from(logo.data).toString('base64')}"/></g>`
    : `<rect x="72" y="64" width="72" height="72" rx="${rx}" fill="${tone.fg}"/>
       <text x="108" y="114" text-anchor="middle" font-size="38" font-weight="700" fill="${tone.bg}">${esc((p.business.name.trim()[0] ?? 'R').toUpperCase())}</text>`

  const titleY = 232
  const titleSvg = lines.map((l, i) => `<text x="72" y="${titleY + i * size * 1.1}" font-size="${size}" font-weight="700" letter-spacing="-1.5">${esc(l)}</text>`).join('')
  // Stat tiles on a fixed line near the bottom, clear of the footer.
  const tileY = H - 236
  const statsSvg = stats.map((s, i) => {
    const x = 72 + i * 384
    const valueSize = s.value.length > 14 ? 34 : s.value.length > 9 ? 46 : 60
    return `<rect x="${x}" y="${tileY}" width="360" height="148" rx="22" fill="${tone.fg}" fill-opacity="${paper ? 0.07 : 0.13}"/>
            <text x="${x + 28}" y="${tileY + 76}" font-size="${valueSize}" font-weight="700" letter-spacing="-1" fill="${tone.hi}">${esc(s.value)}</text>
            <text x="${x + 28}" y="${tileY + 120}" font-size="24" font-weight="500" opacity="0.8">${esc(s.label)}</text>`
  }).join('')

  const blob = (id: string, colour: string) => `<radialGradient id="${id}"><stop offset="0" stop-color="${colour}"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></radialGradient>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Geist">
    <defs>
      ${blob('b1', mix('#FFFFFF', tone.bg, 0.3))}${blob('b2', mix('#000000', tone.bg, 0.22))}${blob('b3', mix('#FFFFFF', tone.bg, 0.14))}
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" seed="7"/>
        <feColorMatrix values="0 0 0 0 ${paper ? 0 : 1}  0 0 0 0 ${paper ? 0 : 1}  0 0 0 0 ${paper ? 0 : 1}  0 0 0 ${paper ? 0.16 : 0.1} 0"/>
      </filter>
    </defs>
    <rect width="${W}" height="${H}" fill="${tone.bg}"/>
    ${paper
      ? `<rect width="${W}" height="20" fill="${tone.shape}"/>`
      : `<circle cx="1040" cy="120" r="420" fill="url(#b1)"/><circle cx="1180" cy="620" r="300" fill="url(#b2)"/><circle cx="760" cy="520" r="260" fill="url(#b3)"/>`}
    <rect width="${W}" height="${H}" filter="url(#grain)"/>
    ${mark}
    <text x="164" y="111" font-size="30" font-weight="500" fill="${tone.fg}">${esc(p.business.name)}</text>
    <g fill="${tone.fg}">${titleSvg}${statsSvg}</g>
    <text x="72" y="${H - 40}" font-size="20" font-weight="500" fill="${tone.fg}" opacity="0.65">Made with Highreel</text>
  </svg>`

  const resvg = new Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: 'Geist', loadSystemFonts: false } as never })
  const png = resvg.render().asPng()
  resvg.free()
  return png
}
