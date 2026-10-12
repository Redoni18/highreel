// Writes the site's icons (SPEC M2.11): public/icon.svg and favicon.ico (a
// blue scallop, the landing's shape, with a white "h"), apple-touch-icon.png
// and icon-192/512.png (the "h" on a full blue square, safe for masks), and
// site.webmanifest. The "h" is Outfit Bold's outline (scripts/fonts, OFL),
// copied out with fontTools so the SVG needs no font.
//
//   node scripts/icons.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { SHAPE_PATHS } from '../app/lib/shapes.ts'

const root = new URL('../', import.meta.url)
await initWasm(readFileSync(new URL('node_modules/@resvg/resvg-wasm/index_bg.wasm', root)))

const BLUE = '#4560FF'
// Outfit Bold "h": font units, y up, bounds x 54–528, y 0–726.
const H = 'M375 0V277Q375 315 351.5 338.5Q328 362 292 362Q267 362 248.0 351.5Q229 341 218.0 321.5Q207 302 207 277L148 306Q148 363 172.0 406.0Q196 449 239.0 472.5Q282 496 338 496Q395 496 438.0 472.5Q481 449 504.5 407.5Q528 366 528 311V0ZM54 0V726H207V0Z'

/** The "h", `height` px tall, centred in a 512 box. */
function letter(height) {
  const k = height / 726
  return `<path d="${H}" fill="#FFFFFF" transform="translate(${(256 - 291 * k).toFixed(2)} ${(256 + 363 * k).toFixed(2)}) scale(${k.toFixed(4)} ${(-k).toFixed(4)})"/>`
}

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${SHAPE_PATHS.scallop}" fill="${BLUE}" transform="translate(256 256) scale(2.56)"/>${letter(270)}</svg>\n`
const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${BLUE}"/>${letter(236)}</svg>\n`

const png = (svg, size) => Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng())

/** An .ico holding PNGs (every current browser reads them). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, e)
    head.writeUInt8(size >= 256 ? 0 : size, e + 1)
    head.writeUInt16LE(1, e + 4)
    head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(data.length, e + 8)
    head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...images.map(i => i.data)])
}

const out = f => new URL(`public/${f}`, root)
writeFileSync(out('icon.svg'), mark)
writeFileSync(out('favicon.ico'), ico([16, 32, 48].map(size => ({ size, data: png(mark, size) }))))
writeFileSync(out('apple-touch-icon.png'), png(tile, 180))
writeFileSync(out('icon-192.png'), png(tile, 192))
writeFileSync(out('icon-512.png'), png(tile, 512))
writeFileSync(out('site.webmanifest'), `${JSON.stringify({
  name: 'Highreel',
  short_name: 'Highreel',
  description: 'Give every customer their year\'s highlight reel.',
  start_url: '/',
  display: 'browser',
  background_color: '#FFFFFF',
  theme_color: '#FFFFFF',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2)}\n`)
console.log('wrote icon.svg, favicon.ico, apple-touch-icon.png, icon-192.png, icon-512.png, site.webmanifest')
