// The wordmark, the capital H (2026-10-13; LOGO in app/data/brand.ts): a
// capital H whose crossbar is a blue play fitted between its stems, drawn over
// a transparent real "H", so the text reads "Highreel". The play pops in the
// first time it shows in a visit. In the server HTML (so the prerendered
// landing shows it without script), the footer's is already settled, it ends
// settled, reduced motion shows it settled, dark mode makes the letters light
// and keeps the play blue, and the app's later pages don't replay it.
import { BASE, OUT, demoSession, expect, finish, launch, watchErrors } from './lib.mjs'

const BLUE = 'rgb(69, 96, 255)'
const browser = await launch()
const errors = []
async function newPage(opts) {
  const page = await (await browser.newContext(opts)).newPage()
  watchErrors(page, errors)
  return page
}
/** A wordmark's state: its play's animation and style, the stems' colour, the text. */
const mark = (page, sel = '.nav .hr-word') => page.evaluate((sel) => {
  const word = document.querySelector(sel)
  const h = word.querySelector('.hr-cap')
  const anim = h.getAnimations({ subtree: true }).find(a => a.effect?.pseudoElement === '::after')
  const play = getComputedStyle(h, '::after')
  return {
    plays: word.classList.contains('hr-animate'),
    anim: anim?.animationName ?? null,
    transform: play.transform,
    opacity: play.opacity,
    playColor: play.backgroundColor,
    stemColor: getComputedStyle(h, '::before').backgroundColor,
    color: getComputedStyle(word).color,
    text: word.textContent,
    innerText: word.innerText,
  }
}, sel)

// The tab icon is the capital H: white with a marigold play on a blue rounded square (scripts/icons.mjs).
const iconSvg = await (await fetch(`${BASE}/icon.svg`)).text()
const ico = await fetch(`${BASE}/favicon.ico`)
expect(iconSvg.includes('fill="#4560FF"') && iconSvg.includes('fill="#FFB43A"') && iconSvg.includes('M265 -480L265 -226L465 -353Z') && iconSvg.includes('M68 0V-706H225V0Z') && !iconSvg.includes('#FFD93B') && ico.ok, 'the tab icon is the capital H, not the highlighted h')

const html = await (await fetch(BASE)).text()
expect((html.match(/<span class="hr-cap"[^>]*>H<\/span>ighreel</g) ?? []).length === 2, 'the landing\'s server HTML has both wordmarks, reading Highreel')
expect((html.match(/class="hr-word hr-animate"/g) ?? []).length === 1, 'only the header\'s plays; the footer\'s is settled')

const page = await newPage({ viewport: { width: 1280, height: 800 } })
// It plays in under a second, so hold it the moment it starts.
await page.addInitScript(() => {
  document.addEventListener('animationstart', (e) => {
    if (e.animationName.startsWith('hr-play'))
      e.target.getAnimations({ subtree: true }).filter(a => a.animationName === e.animationName).forEach(a => a.pause())
  }, true)
})
await page.goto(BASE, { waitUntil: 'networkidle' })
// Just after it starts, the play is small and faint; then it settles.
const early = await page.evaluate(() => {
  const a = document.querySelector('.nav .hr-cap').getAnimations({ subtree: true }).find(a => a.effect?.pseudoElement === '::after')
  if (!a)
    return null
  a.currentTime = 250 + 40
  const css = getComputedStyle(document.querySelector('.nav .hr-cap'), '::after')
  return { name: a.animationName, scale: new DOMMatrix(css.transform).a, opacity: Number(css.opacity) }
})
expect(early?.name.startsWith('hr-play') && early.scale < 0.6 && early.opacity < 0.5, 'the header\'s play pops in: just after it starts, it\'s small and faint', early)
await page.evaluate(() => document.querySelector('.nav .hr-cap').getAnimations({ subtree: true }).forEach(a => a.finish()))
const done = await mark(page)
expect(done.plays && done.transform === 'none' && done.opacity === '1' && done.playColor === BLUE && done.stemColor === done.color && done.text === 'Highreel' && done.innerText === 'Highreel', 'it ends settled: a blue play, the stems in the text colour, the text "Highreel"', done)
await page.locator('.nav .wordmark').screenshot({ path: `${OUT}wordmark.png` })
const foot = await mark(page, '.foot .hr-word')
expect(!foot.plays && !foot.anim && foot.transform === 'none' && foot.opacity === '1', 'the footer\'s is settled from the start', foot)

// Dark: light letters and stem, the play still blue; the page itself is
// untouched, and the logo doesn't move when the mode switches.
const where = () => page.evaluate(() => ['.nav .hr-cap', '.nav .wordmark', '.nav'].map((sel) => {
  const r = document.querySelector(sel).getBoundingClientRect()
  return [r.x, r.y, r.width, r.height].map(n => Math.round(n * 10) / 10).join(' ')
}))
const lightAt = await where()
await page.evaluate(() => document.documentElement.classList.add('dark'))
await page.waitForFunction(() => getComputedStyle(document.querySelector('.nav .hr-word')).color === 'rgb(242, 242, 242)', null, { timeout: 5000 }).catch(() => {})
const darkAt = await where()
expect(JSON.stringify(lightAt) === JSON.stringify(darkAt), 'switching to dark doesn\'t move the logo or the header', { light: lightAt, dark: darkAt })
const dark = await mark(page)
const size = await page.evaluate(() => getComputedStyle(document.querySelector('.nav .wordmark')).fontSize)
expect(dark.color === 'rgb(242, 242, 242)' && dark.stemColor === dark.color && dark.playColor === BLUE, 'dark mode: light letters and stems, the play still blue', dark)
expect(size === '26px', 'the header wordmark is 26 px', size)
await page.locator('.nav .wordmark').screenshot({ path: `${OUT}wordmark-dark.png` })
await page.evaluate(() => document.documentElement.classList.remove('dark'))

// Following the footer's link to the terms: no replay; opening them fresh: plays again.
await page.locator('.foot a[href="/terms"]').click()
await page.waitForURL('**/terms')
await page.waitForSelector('.legal .nav .hr-word')
const terms = await mark(page)
expect(!terms.plays && !terms.anim, 'moving to another page in the same visit shows it settled', terms)
await page.goto(`${BASE}/terms`, { waitUntil: 'networkidle' })
expect((await mark(page)).plays, 'opening a page fresh plays it')

// Reduced motion: settled, no animation.
const rm = await newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
await rm.goto(BASE, { waitUntil: 'networkidle' })
const still = await mark(rm)
expect(!still.anim && still.transform === 'none' && still.opacity === '1', 'reduced motion shows the play settled', still)

// The app: plays on the home's first load, not again in a recap's workspace.
const app = await newPage({ viewport: { width: 1280, height: 800 } })
// Count plays as they start: a fast page can finish one before a check looks.
await app.addInitScript(() => {
  window.__plays = 0
  document.addEventListener('animationstart', (e) => {
    if (e.animationName.startsWith('hr-play'))
      window.__plays++
  }, true)
})
await demoSession(app)
await app.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
const home = await mark(app, 'header .hr-word')
const playedAtHome = await app.evaluate(() => window.__plays)
expect(home.plays && playedAtHome === 1, 'the app\'s home plays it', { ...home, count: playedAtHome })
await app.locator('table a[href^="/app/c/"]').first().click()
await app.waitForURL('**/app/c/*')
await app.waitForSelector('header .hr-word')
const ws = await mark(app, 'header .hr-word')
ws.count = await app.evaluate(() => window.__plays)
expect(!ws.plays && !ws.anim && ws.count === 1 && ws.text === 'Highreel', 'a recap\'s workspace, opened from the home, shows it settled', ws)

await browser.close()
finish(errors)
