// Landing → demo, preview autoplay, self-hosted fonts, unknown recap = 404,
// reduced motion (no count-up, instant swap), robots meta, link-preview tags.
import { BASE, campaignId, expect, finish, launch, publish, tokenFor, watchErrors } from './lib.mjs'

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const errors = []
watchErrors(page, errors)
await page.goto(BASE)
await page.getByRole('link', { name: /Try the demo/ }).first().click()
await page.waitForURL('**/app/c/*', { timeout: 20000 })
expect(!!campaignId(page), 'landing → Try the demo → workspace')
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await page.getByRole('button', { name: 'Play' }).click()
const t0 = Date.now()
await page.waitForFunction(() => document.querySelector('aside[aria-label="Highreel preview"] .font-mono')?.textContent?.includes('slide 2/'), null, { timeout: 8000 })
expect(Date.now() - t0 < 6000, 'preview autoplay advances after ~5 s', `${Date.now() - t0} ms`)
await page.getByRole('button', { name: 'Pause' }).click()
// The app's UI is Outfit; the recap in the preview is Geist; numbers are Google Sans Code.
// (A loaded face per family: dev mode declares some faces twice, so fonts.check() can't tell.)
const fonts = await page.evaluate(async () => {
  await document.fonts.ready
  const loaded = family => [...document.fonts].some(f => f.family.replace(/"/g, '') === family && f.status === 'loaded')
  return { outfit: loaded('Outfit'), geist: loaded('Geist'), mono: loaded('Google Sans Code') }
})
expect(fonts.outfit && fonts.geist && fonts.mono, 'Outfit, Geist and Google Sans Code load (self-hosted)', fonts)
await publish(page)
const token = await tokenFor(page)

const p404 = await page.context().newPage()
const res = await p404.goto(`${BASE}/r/AAAAAAAAAAAA`)
expect(res.status() === 404, 'unknown recap returns 404', res.status())
expect(await p404.locator('h1').innerText() === 'This Highreel isn\'t available.' && await p404.title() === 'Highreel not found', 'and says so in the brand word', await p404.title())

const rm = await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage()
await rm.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' })
await rm.keyboard.press('ArrowRight')
await rm.waitForTimeout(60)
const big = await rm.locator('.big').first().innerText()
expect(big !== '0', 'reduced motion shows the final number at once', big)
expect(await rm.locator('.recap .slide').count() === 1, 'reduced motion swaps slides instantly')
expect(await rm.locator('meta[name="robots"]').getAttribute('content') === 'noindex, nofollow', 'robots meta noindex')
const og = await rm.locator('meta[property="og:image"]').getAttribute('content')
expect(og?.endsWith(`/api/r/${token}/og.png`), 'og:image points at the link preview', og)
const ogRes = await fetch(og)
expect(ogRes.status === 200 && ogRes.headers.get('content-type') === 'image/png', 'link preview renders', ogRes.status)
await browser.close()
finish(errors)
