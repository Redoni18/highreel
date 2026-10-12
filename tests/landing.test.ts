// The landing's build-time HTML rewrite (SPEC M2.11, modules/landing-first-paint).
import { describe, expect, test } from 'vitest'
import { firstPaint, fontPreloads } from '../modules/landing-first-paint/html'

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/_nuxt/entry.abc.css" crossorigin><link rel="modulepreload" as="script" crossorigin href="/_nuxt/x.js"><link rel="preload" as="fetch" crossorigin="anonymous" href="/_payload.json?x"><style>@font-face{font-family:Notes;src:url(/fonts/notes.woff2)format("woff2")}@font-face{font-family:Outfit;src:url(/_fonts/ext.woff2)format("woff2");unicode-range:U+100-2BA}@font-face{font-family:Outfit;src:url(/_fonts/latin.woff2)format("woff2");unicode-range:U+??,U+131}</style><script type="module" src="/_nuxt/entry.js" crossorigin></script></head><body></body></html>`
const css = '@font-face{font-family:Geist;src:url(../_fonts/geist.woff2)}body{background:url("data:image/png;base64,x")}.a{background:url(/img/a.png)}'

describe('firstPaint', () => {
  const out = firstPaint(html, () => css)
  test('inlines the stylesheet, with its relative URLs made absolute', () => {
    expect(out).not.toContain('rel="stylesheet"')
    expect(out).toContain('<style>@font-face{font-family:Geist;src:url(/_fonts/geist.woff2)}body{background:url("data:image/png;base64,x")}.a{background:url(/img/a.png)}</style>')
  })
  test('drops modulepreload and payload preloads', () => {
    expect(out).not.toContain('modulepreload')
    expect(out).not.toContain('as="fetch"')
  })
  test('preloads the latin faces the page declares, not latin-ext or the inlined app fonts', () => {
    expect(fontPreloads(html)).toEqual(['/fonts/notes.woff2', '/_fonts/latin.woff2'])
    expect(out.indexOf('<link rel="preload" as="font" type="font/woff2" href="/fonts/notes.woff2" crossorigin>')).toBe(out.indexOf('<meta charset="utf-8">') + 22)
  })
  test('loads the app after the largest paint', () => {
    expect(out).not.toContain('<script type="module" src=')
    expect(out).toContain('import("/_nuxt/entry.js")')
    expect(out).toContain('largest-contentful-paint')
  })
  test('fails loudly if Nuxt changes the entry tag', () => {
    expect(() => firstPaint('<head></head>', () => '')).toThrow(/entry script/)
  })
})
