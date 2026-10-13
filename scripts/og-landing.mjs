// Writes public/og.png, the landing page's link preview (SPEC M2.5 P2):
// 1200×630, the landing's hero as it looks today (redrawn 2026-10-13, owner:
// match the site): the wordmark top left, the headline centred on white, the
// price in the blue pill, and around them the hero's soft blobs, hand-drawn
// lines, small pieces, recap stickers and the two inbox notifications. The
// blob outlines come from app/lib/blobs.ts and the scallop from
// app/lib/shapes.ts (Node strips their types), the wordmark (the site's logo,
// LOGO in app/data/brand.ts) from scripts/brand.mjs. Drawn as SVG and rendered
// by resvg with Outfit TTFs (scripts/fonts, OFL; the page itself loads Outfit
// through @nuxt/fonts).
//
//   node scripts/og-landing.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { blobFrames } from '../app/lib/blobs.ts'
import { SHAPE_PATHS } from '../app/lib/shapes.ts'
import { siteLogo } from './brand.mjs'

const root = new URL('../', import.meta.url)
await initWasm(readFileSync(new URL('node_modules/@resvg/resvg-wasm/index_bg.wasm', root)))
const fonts = ['Outfit-Medium.ttf', 'Outfit-SemiBold.ttf', 'Outfit-Bold.ttf'].map(f => readFileSync(new URL(`scripts/fonts/${f}`, root)))

const W = 1200
const H = 630
// The landing's light tokens (app/pages/index.vue).
const INK = '#222222'
const MUTED = '#6F6F6F'
const CTA = '#4560FF'
const C = { green: '#00C28A', marigold: '#FFB43A', poppy: '#FF5B42', blue: '#4560FF', violet: '#8F66F6' }

const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('\'', '&#39;')

/** A hero blob: the first outline of its morph, `size` px across. */
function blob(seed, x, y, size, color) {
  return `<g transform="translate(${x} ${y}) scale(${size / 200})"><path d="${blobFrames(seed)[0]}" fill="${color}"/></g>`
}

/** A hand-drawn line from the hero, in its 200 × 120 box, `width` px wide. */
function line(d, color, x, y, width, rot = 0, dashed = false) {
  const s = width / 200
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-100 -60)">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${dashed ? 6 : 7}" stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="9 11"' : ''}/>
  </g>`
}

/** The hero's small pieces: a dot, a ring, a plus, a pill. */
function piece(kind, x, y, s, color, rot = 0) {
  const body = {
    dot: `<circle r="${s / 2}" fill="${color}"/>`,
    ring: `<circle r="${s / 2 - 2}" fill="none" stroke="${color}" stroke-width="4"/>`,
    plus: `<rect x="${-s / 2}" y="${-s * 0.14}" width="${s}" height="${s * 0.28}" rx="3" fill="${color}"/><rect x="${-s * 0.14}" y="${-s / 2}" width="${s * 0.28}" height="${s}" rx="3" fill="${color}"/>`,
    pill: `<rect x="${-s / 2}" y="${-s * 0.21}" width="${s}" height="${s * 0.42}" rx="${s * 0.21}" fill="${color}"/>`,
  }[kind]
  return `<g transform="translate(${x} ${y}) rotate(${rot})">${body}</g>`
}

/** A recap sticker (.sticker): a big number and its line, white rim, soft shadow; `w` px wide before `scale`. */
function sticker(x, y, rot, big, small, bg, w, scale = 1.2) {
  const h = 72
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale})">
    <rect x="${-w / 2 - 5}" y="${-h / 2 - 5}" width="${w + 10}" height="${h + 10}" rx="23" fill="#FFFFFF" filter="url(#lift)"/>
    <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="18" fill="${bg}"/>
    <text x="${-w / 2 + 16}" y="${-h / 2 + 38}" font-size="34" font-weight="700" fill="#FFFFFF" letter-spacing="-1">${esc(big)}</text>
    <text x="${-w / 2 + 16}" y="${-h / 2 + 60}" font-size="13" font-weight="500" fill="#FFFFFF" fill-opacity="0.9">${esc(small)}</text>
  </g>`
}

/** An inbox notification (.mail): the business's mark, who it's from, when, and the subject. */
function mail(x, y, rot, when, text, scale = 1.25) {
  const w = 284
  const h = 54
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${scale}) translate(${-w / 2} ${-h / 2})">
    <rect width="${w}" height="${h}" rx="22" fill="#E8E8ED" fill-opacity="0.85"/>
    <circle cx="27" cy="27" r="18" fill="${CTA}"/>
    <g transform="translate(27 27) scale(0.045)"><path d="${SHAPE_PATHS.scallop}" fill="#FFFFFF"/></g>
    <text x="55" y="23" font-size="13" font-weight="600" fill="${INK}">Your business</text>
    <text x="${w - 16}" y="23" font-size="12" font-weight="500" fill="#8A8A8A" text-anchor="end">${esc(when)}</text>
    <text x="55" y="41" font-size="13" font-weight="500" fill="#3A3A3A">${esc(text)}</text>
  </g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Outfit">
  <defs>
    <filter id="lift" x="-30%" y="-40%" width="160%" height="200%">
      <feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#000000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>

  ${blob(3, 30, 190, 270, C.green)}
  ${blob(7, 1150, 70, 200, C.marigold)}
  ${blob(11, 1150, 590, 270, C.poppy)}
  ${blob(5, 40, 610, 180, C.blue)}
  ${blob(13, 575, 692, 150, C.violet)}

  ${line('M8 70C38 18 62 112 96 62S150 12 192 58', C.blue, 150, 330, 130, -14)}
  ${line('M10 80C60 90 90 60 82 36S40 18 46 50 100 96 130 70 168 24 190 40', C.poppy, 975, 488, 140, 6)}
  ${line('M12 96Q100 -4 188 96', C.violet, 905, 150, 110, -4, true)}
  ${line('M14 60C50 20 80 100 110 60S170 30 186 62', C.green, 505, 595, 110, 8)}

  ${piece('ring', 64, 392, 26, C.violet)}
  ${piece('dot', 470, 150, 14, C.marigold)}
  ${piece('plus', 1048, 222, 22, C.green)}
  ${piece('pill', 1150, 300, 36, C.blue, 30)}
  ${piece('ring', 900, 515, 18, C.green)}
  ${piece('plus', 120, 520, 18, C.poppy)}
  ${piece('dot', 650, 34, 10, C.blue)}

  ${sticker(318, 104, -7, '86', 'classes at the studio', '#E2457A', 160)}
  ${sticker(150, 452, -8, '212', 'days in the app', '#4F46E5', 128)}
  ${sticker(1062, 412, 7, 'Top 6%', 'of all readers', '#C8341B', 132)}
  ${sticker(330, 568, 5, '14', 'orders this year', '#1F6F4A', 132)}
  ${mail(745, 92, -2, 'now', 'Ana, your 2026 Highreel is here')}
  ${mail(800, 574, 2, '2m ago', 'Leon, here\'s your year with us')}

  ${siteLogo.place(110, 70, 34)}
  <g text-anchor="middle" font-size="80" font-weight="600" fill="${INK}" letter-spacing="-2.4">
    <text x="${W / 2}" y="250">Give every customer</text>
    <text x="${W / 2}" y="333">their year's highlight reel.</text>
  </g>
  <text x="${W / 2}" y="392" text-anchor="middle" font-size="28" font-weight="500" fill="${MUTED}">Spotify Wrapped, for your business.</text>
  <rect x="${W / 2 - 160}" y="426" width="320" height="60" rx="30" fill="${CTA}"/>
  <text x="${W / 2}" y="465" text-anchor="middle" font-size="24" font-weight="500" fill="#FFFFFF">From $99 per campaign</text>
</svg>`

const resvg = new Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: 'Outfit', loadSystemFonts: false } })
const png = resvg.render().asPng()
writeFileSync(new URL('public/og.png', root), png)
console.log(`public/og.png ${(png.length / 1024).toFixed(0)} KB`)
