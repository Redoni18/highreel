// Writes the site's icons (SPEC §6.4, M2.11) and the brand files, all from the
// logos in scripts/brand.mjs; LOGO in app/data/brand.ts picks the site's:
//
//   public/icon.svg, favicon.ico         the site logo's icon
//   public/apple-touch-icon.png,         its app icon (the square filled, the
//   icon-192.png, icon-512.png           mark inside the middle 80 %)
//   public/site.webmanifest
//   brand/<logo>/                        every logo's files to use elsewhere:
//                                        icons (SVG, PNG, .ico), app icons, the
//                                        wordmark for light backgrounds and white
//                                        for dark ones (SVG, PNG)
//   brand/README.md                      which is which, and how to switch
//
//   node scripts/icons.mjs

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { LOGO, logos, siteLogo } from './brand.mjs'

const root = new URL('../', import.meta.url)
await initWasm(readFileSync(new URL('node_modules/@resvg/resvg-wasm/index_bg.wasm', root)))

const png = (svg, width) => Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng())

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
const favicon = svg => ico([16, 32, 48].map(size => ({ size, data: png(svg, size) })))
const icon = siteLogo.icons[siteLogo.siteIcon]
const appIcon = siteLogo.appIcons[siteLogo.siteIcon]

const README = `# Highreel logos

Written by \`node scripts/icons.mjs\` from \`scripts/brand.mjs\`; don't edit by hand.

- \`capital-h/\`: a capital H whose crossbar is a blue play, fitted between its
  stems, then "ighreel" (since 13 October 2026).
- \`highlighter/\`: "highreel" with a highlighter-yellow stroke behind "high"
  (12 to 13 October 2026). Icons: \`icon-half\` (the one the site used) and
  \`icon-full\`; \`highreel-wordmark-animated.svg\` draws the stroke once.

Each folder has the wordmark for light backgrounds and \`-white\` for dark
ones (SVG, and PNG 2400 px wide), the icon (SVG, PNG 512 and 1024, favicon
.ico) and the app icon (SVG, PNG 1024).

The site uses \`${LOGO}\`. To switch: set \`LOGO\` in \`app/data/brand.ts\`, then run
\`node scripts/icons.mjs\` and \`node scripts/og-landing.mjs\`. The site's wordmark
(\`app/components/Wordmark.vue\`) follows the same setting.
`

const files = {
  'public/icon.svg': icon,
  'public/favicon.ico': favicon(icon),
  'public/apple-touch-icon.png': png(appIcon, 180),
  'public/icon-192.png': png(appIcon, 192),
  'public/icon-512.png': png(appIcon, 512),
  'public/site.webmanifest': `${JSON.stringify({
    name: 'Highreel',
    short_name: 'Highreel',
    description: 'Give your customers their highlight reel.',
    start_url: '/',
    display: 'browser',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2)}\n`,
  'brand/README.md': README,
  ...Object.fromEntries(Object.entries(logos).flatMap(([name, logo]) => {
    const dir = `brand/${name}/`
    const icons = Object.entries(logo.icons).flatMap(([kind, svg]) => [
      [`${dir}highreel-${kind}.svg`, svg],
      [`${dir}highreel-${kind}-512.png`, png(svg, 512)],
      [`${dir}highreel-${kind}-1024.png`, png(svg, 1024)],
      [`${dir}favicon${kind === 'icon' ? '' : kind.slice(4)}.ico`, favicon(svg)],
      [`${dir}highreel-app-${kind}.svg`, logo.appIcons[kind]],
      [`${dir}highreel-app-${kind}-1024.png`, png(logo.appIcons[kind], 1024)],
    ])
    return [
      ...icons,
      [`${dir}highreel-wordmark.svg`, logo.wordmark],
      [`${dir}highreel-wordmark.png`, png(logo.wordmark, 2400)],
      [`${dir}highreel-wordmark-white.svg`, logo.wordmarkWhite],
      [`${dir}highreel-wordmark-white.png`, png(logo.wordmarkWhite, 2400)],
      ...(logo.wordmarkAnimated ? [[`${dir}highreel-wordmark-animated.svg`, logo.wordmarkAnimated]] : []),
    ]
  })),
}

// brand/ holds only what this writes.
rmSync(new URL('brand/', root), { recursive: true, force: true })
for (const [path, data] of Object.entries(files)) {
  mkdirSync(new URL(path.slice(0, path.lastIndexOf('/') + 1), root), { recursive: true })
  writeFileSync(new URL(path, root), data)
}
console.log(`site logo: ${LOGO}; wrote ${Object.keys(files).length} files (public/ icons, brand/${Object.keys(logos).join(', brand/')})`)
