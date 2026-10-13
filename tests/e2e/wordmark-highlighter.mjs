// The wordmark, the highlighter (2026-10-12; LOGO in app/data/brand.ts): "highreel" with a marker stroke behind "high",
// drawn left to right the first time it shows in a visit. In the server HTML
// (so the prerendered landing draws it without script), the footer's is
// already drawn, it ends fully drawn, reduced motion shows it finished, dark
// mode tones it down (and only it), and the app's later pages don't replay it.
import { BASE, OUT, demoSession, expect, finish, launch, watchErrors } from './lib.mjs'

const browser = await launch()
const errors = []
async function newPage(opts) {
  const page = await (await browser.newContext(opts)).newPage()
  watchErrors(page, errors)
  return page
}
/** The header wordmark's stroke: its animation and the computed style of ::before. */
const stroke = (page, sel = '.nav .hr-word') => page.evaluate((sel) => {
  const word = document.querySelector(sel)
  const high = word.querySelector('.hr-high')
  const anim = high.getAnimations({ subtree: true }).find(a => a.effect?.pseudoElement === '::before')
  const css = getComputedStyle(high, '::before')
  return { draws: word.classList.contains('hr-animate'), anim: anim?.animationName ?? null, clip: css.clipPath, opacity: css.opacity, bg: css.backgroundColor, text: word.textContent }
}, sel)

// The tab icon is the highlighted "h": an ink "h" with the icon's deeper yellow marker (scripts/icons.mjs).
const iconSvg = await (await fetch(`${BASE}/icon.svg`)).text()
const ico = await fetch(`${BASE}/favicon.ico`)
expect(iconSvg.includes('fill="#FFD93B"') && iconSvg.includes('M375 0V-277') && !iconSvg.includes('#4560FF') && ico.ok, 'the tab icon is the highlighted h, not the old blue scallop')

const html = await (await fetch(BASE)).text()
expect((html.match(/class="hr-high"[^>]*>high<\/span>reel</g) ?? []).length === 2, 'the landing\'s server HTML has both wordmarks, reading highreel')
expect((html.match(/class="hr-word hr-animate"/g) ?? []).length === 1, 'only the header\'s draws; the footer\'s is already drawn')

const page = await newPage({ viewport: { width: 1280, height: 800 } })
// It draws in under a second, so hold it the moment it starts.
await page.addInitScript(() => {
  document.addEventListener('animationstart', (e) => {
    if (e.animationName.startsWith('hr-draw'))
      e.target.getAnimations({ subtree: true }).filter(a => a.animationName === e.animationName).forEach(a => a.pause())
  }, true)
})
await page.goto(BASE, { waitUntil: 'networkidle' })
// Halfway through, the stroke is cut partway along "high".
const half = await page.evaluate(() => {
  const a = document.querySelector('.nav .hr-high').getAnimations({ subtree: true }).find(a => a.effect?.pseudoElement === '::before')
  if (!a)
    return null
  a.currentTime = 250 + 350
  return { name: a.animationName, clip: getComputedStyle(document.querySelector('.nav .hr-high'), '::before').clipPath }
})
const cut = Number(half?.clip.match(/inset\(0px (\d+(?:\.\d+)?)%/)?.[1])
expect(half?.name.startsWith('hr-draw') && cut > 15 && cut < 85, 'the header draws the stroke: halfway, it reaches partway across "high"', half)
await page.locator('.nav .wordmark').screenshot({ path: `${OUT}wordmark-half.png` })
await page.evaluate(() => document.querySelector('.nav .hr-high').getAnimations({ subtree: true }).forEach(a => a.finish()))
const done = await stroke(page)
expect(done.draws && done.clip === 'none' && done.text === 'highreel' && done.bg === 'rgb(255, 228, 92)', 'it ends fully drawn, in highlighter yellow', done)
await page.locator('.nav .wordmark').screenshot({ path: `${OUT}wordmark.png` })
const foot = await stroke(page, '.foot .hr-word')
expect(!foot.draws && !foot.anim && foot.clip === 'none', 'the footer\'s is drawn from the start', foot)

// Dark: light letters with the stroke in the brand blue; the page itself is
// untouched, and the logo doesn't move when the mode switches.
const where = () => page.evaluate(() => ['.nav .hr-high', '.nav .wordmark', '.nav'].map((sel) => {
  const r = document.querySelector(sel).getBoundingClientRect()
  return [r.x, r.y, r.width, r.height].map(n => Math.round(n * 10) / 10).join(' ')
}))
const lightAt = await where()
await page.evaluate(() => document.documentElement.classList.add('dark'))
const darkAt = await where()
expect(JSON.stringify(lightAt) === JSON.stringify(darkAt), 'switching to dark doesn\'t move the logo or the header', { light: lightAt, dark: darkAt })
const dark = await stroke(page)
const label = await page.evaluate(() => {
  const el = document.querySelector('.nav .hr-word')
  return { label: getComputedStyle(el, '::before').content, color: getComputedStyle(el).color, page: getComputedStyle(document.querySelector('.landing')).backgroundColor, size: getComputedStyle(document.querySelector('.nav .wordmark')).fontSize }
})
expect(label.label === 'none' && label.color === 'rgb(242, 242, 242)' && dark.opacity === '1' && dark.bg === 'rgb(69, 96, 255)' && label.page !== 'rgb(255, 255, 255)', 'dark mode: light letters, the stroke in the brand blue, no label, the page still dark', { ...label, stroke: dark.bg })
expect(label.size === '26px', 'the header wordmark is 26 px', label.size)
await page.locator('.nav .wordmark').screenshot({ path: `${OUT}wordmark-dark.png` })
await page.evaluate(() => document.documentElement.classList.remove('dark'))

// Following the footer's link to the terms: no replay; opening them fresh: drawn again.
await page.locator('.foot a[href="/terms"]').click()
await page.waitForURL('**/terms')
await page.waitForSelector('.legal .nav .hr-word')
const terms = await stroke(page)
expect(!terms.draws && !terms.anim, 'moving to another page in the same visit shows it already drawn', terms)
await page.goto(`${BASE}/terms`, { waitUntil: 'networkidle' })
expect((await stroke(page)).draws, 'opening a page fresh draws it')

// Reduced motion: finished, no animation.
const rm = await newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
await rm.goto(BASE, { waitUntil: 'networkidle' })
const still = await stroke(rm)
expect(!still.anim && still.clip === 'none', 'reduced motion shows the stroke finished', still)

// The app: drawn on the home's first load, not again in a recap's workspace.
const app = await newPage({ viewport: { width: 1280, height: 800 } })
// Count drawings as they start: a fast page can finish one before a check looks.
await app.addInitScript(() => {
  window.__drawings = 0
  document.addEventListener('animationstart', (e) => {
    if (e.animationName.startsWith('hr-draw'))
      window.__drawings++
  }, true)
})
await demoSession(app)
await app.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
const home = await stroke(app, 'header .hr-word')
const drawnAtHome = await app.evaluate(() => window.__drawings)
expect(home.draws && drawnAtHome === 1, 'the app\'s home draws it', { ...home, drawings: drawnAtHome })
await app.locator('table a[href^="/app/c/"]').first().click()
await app.waitForURL('**/app/c/*')
await app.waitForSelector('header .hr-word')
const ws = await stroke(app, 'header .hr-word')
ws.drawings = await app.evaluate(() => window.__drawings)
expect(!ws.draws && !ws.anim && ws.drawings === 1 && ws.text === 'highreel', 'a recap\'s workspace, opened from the home, shows it already drawn', ws)

await browser.close()
finish(errors)
