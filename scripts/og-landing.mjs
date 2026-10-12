// Writes public/og.png, the landing page's link preview (SPEC M2.5 P2):
// 1200×630 in the landing's look: the headline centred on white, the price
// in the blue pill, flower shapes and two recap stickers around it. The
// shapes come from app/lib/shapes.ts (Node strips its types). Drawn as SVG
// and rendered by resvg with Outfit TTFs (scripts/fonts, OFL; the page itself
// loads Outfit through @nuxt/fonts).
//
//   node scripts/og-landing.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { DAISY_RAYS, SHAPE_PATHS } from '../app/lib/shapes.ts'

const root = new URL('../', import.meta.url)
await initWasm(readFileSync(new URL('node_modules/@resvg/resvg-wasm/index_bg.wasm', root)))
const fonts = ['Outfit-Medium.ttf', 'Outfit-SemiBold.ttf', 'Outfit-Bold.ttf'].map(f => readFileSync(new URL(`scripts/fonts/${f}`, root)))

const W = 1200
const H = 630
const INK = '#222222'
const C = { green: '#00C28A', marigold: '#FFB43A', poppy: '#FF5B42', blue: '#4560FF', violet: '#8F66F6' }

function shape(kind, x, y, size, color, rot = 0) {
  const body = kind === 'daisy'
    ? `<g stroke="${color}" stroke-width="27" stroke-linecap="round">${Array.from({ length: DAISY_RAYS }, (_, i) => {
      const a = (i / DAISY_RAYS) * Math.PI * 2
      return `<line x1="0" y1="0" x2="${(Math.cos(a) * 76).toFixed(1)}" y2="${(Math.sin(a) * 76).toFixed(1)}"/>`
    }).join('')}</g><circle r="34" fill="${color}"/>`
    : `<path d="${SHAPE_PATHS[kind]}" fill="${color}"/>`
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${size / 200})">${body}</g>`
}

function sticker(x, y, rot, big, small, bg, width) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})" filter="url(#lift)">
    <rect x="${-width / 2 - 6}" y="-48" width="${width + 12}" height="96" rx="24" fill="#FFFFFF"/>
    <rect x="${-width / 2}" y="-42" width="${width}" height="84" rx="19" fill="${bg}"/>
    <text x="${-width / 2 + 18}" y="2" font-size="40" font-weight="700" fill="#FFFFFF" letter-spacing="-1.2">${big}</text>
    <text x="${-width / 2 + 18}" y="27" font-size="15" font-weight="500" fill="#FFFFFF" fill-opacity="0.9">${small}</text>
  </g>`
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Outfit">
  <defs>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="180%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000000" flood-opacity="0.2"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>

  ${shape('clover', 92, 112, 150, C.green, -28)}
  ${shape('poppy', 262, 76, 40, C.poppy, 12)}
  ${shape('scallop', 84, 528, 112, C.blue)}
  ${shape('daisy', 318, 586, 52, C.violet, 8)}
  ${shape('marigold', 1102, 104, 140, C.marigold, 18)}
  ${shape('daisy', 920, 70, 40, C.violet)}
  ${shape('poppy', 1104, 532, 144, C.poppy, 30)}
  ${shape('scallop', 884, 590, 46, C.blue)}
  ${sticker(118, 318, -8, '212', 'days in the app', '#4F46E5', 168)}
  ${sticker(1082, 322, 7, 'Top 6%', 'of all readers', '#C8341B', 168)}

  <text x="${W / 2}" y="94" text-anchor="middle" font-size="30" font-weight="700" fill="${INK}" letter-spacing="-1">highreel</text>
  <g text-anchor="middle" font-size="66" font-weight="600" fill="${INK}" letter-spacing="-2">
    <text x="${W / 2}" y="246">Give every customer their</text>
    <text x="${W / 2}" y="324">year's highlight reel.</text>
  </g>
  <text x="${W / 2}" y="398" text-anchor="middle" font-size="30" font-weight="500" fill="#6F6F6F">Spotify Wrapped, for your business.</text>
  <rect x="${W / 2 - 170}" y="438" width="340" height="68" rx="34" fill="${C.blue}"/>
  <text x="${W / 2}" y="482" text-anchor="middle" font-size="27" font-weight="500" fill="#FFFFFF">From $99 per campaign</text>
</svg>`

const resvg = new Resvg(svg, { font: { fontBuffers: fonts, defaultFontFamily: 'Outfit', loadSystemFonts: false } })
const png = resvg.render().asPng()
writeFileSync(new URL('public/og.png', root), png)
console.log(`public/og.png ${(png.length / 1024).toFixed(0)} KB`)
