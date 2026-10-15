// A recap's three steps (SPEC M2.6): Sheet is data and a preview only;
// Design jumps the phone to the slide being edited and keeps a draft across
// tabs until saved; Share publishes and explains; Your brand saves once for
// every recap; switching recaps keeps the tab.
import { BASE, campaignId, demoSession, designItem, expect, finish, FIX, launch, needFixtures, sheetCounts, tab, tokenFor, watchErrors, newHighreel } from './lib.mjs'

needFixtures()

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
watchErrors(page, errors)
const slideScene = () => page.locator('aside[aria-label="Highreel preview"] .recap .slide').last().getAttribute('data-scene')

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')

// Sheet: the grid, the filters, Upload and the preview; nothing about design.
const sheet = await page.evaluate(() => ({
  grid: !!document.querySelector('[data-row-id]'),
  preview: !!document.querySelector('aside[aria-label="Highreel preview"] .recap'),
  upload: [...document.querySelectorAll('footer button')].some(b => b.textContent.includes('Upload')),
  design: !!document.querySelector('[data-slide], [data-testid="guess-first"], [data-testid="photo-input"], input[type="color"]'),
  dot: !!document.querySelector('nav[aria-label="Steps"] .step-dot.error'),
}))
expect(sheet.grid && sheet.preview && sheet.upload && !sheet.design, 'Sheet is the data and a preview, no design controls', sheet)
expect(sheet.dot, 'the Sheet tab flags rows to fix')

// Design: the phone follows the slide being edited.
await tab(page, 'Design')
await designItem(page, 'streak')
await page.waitForTimeout(700)
expect(await slideScene() === 'streak', 'selecting a slide shows it in the phone', await slideScene())
await designItem(page, 'share')
await page.waitForTimeout(700)
expect(await slideScene() === 'share', 'the last slide shows the share slide', await slideScene())
expect(await page.locator('[data-slide="top_percent"] [data-not-shown]').count() === 1, 'the rail marks a slide this person doesn\'t get')
await designItem(page, 'top_percent')
expect((await page.getByTestId('slide-status').innerText()).startsWith('Emma doesn\'t get this slide.'), 'and the inspector says so', await page.getByTestId('slide-status').innerText())
await designItem(page, 'cover')

// A draft survives switching tabs, plays in the Sheet's preview, and Discard drops it.
await page.locator('#d-copy-cover').fill('{first_name}, look at your {year}')
await tab(page, 'Sheet')
await page.waitForTimeout(500)
const cover = await page.locator('aside[aria-label="Highreel preview"] .cover-title').innerText()
expect(cover.replace(/\s+/g, ' ').includes('Emma, look at your 2026'), 'the Sheet\'s preview plays the unsaved design', cover)
expect(await page.locator('nav[aria-label="Steps"] .step-dot.draft').count() === 1, 'the Design tab is marked unsaved')
await tab(page, 'Design')
await designItem(page, 'cover')
expect(await page.locator('#d-copy-cover').inputValue() === '{first_name}, look at your {year}', 'the draft is still there')
await page.getByRole('button', { name: 'Discard' }).click()
expect(await page.locator('nav[aria-label="Steps"] .step-dot.draft').count() === 0 && await page.locator('#d-copy-cover').inputValue() === '', 'Discard drops it')

// Share: what goes out, fixing first, publishing, then how to send and how it looks.
await tab(page, 'Share')
const before = (await page.locator('[data-testid="share-publish"] .lead').innerText()).replace(/\s+/g, ' ')
expect(before === '195 Highreels are ready to go out. 5 rows need fixing and will be skipped.', 'Share says what goes out and what\'s skipped', before)
await page.getByRole('button', { name: 'Fix them first' }).click()
await page.waitForSelector('[data-row-id]')
const fixing = await page.locator('[data-filter="errors"]').getAttribute('data-state')
expect(fixing === 'on', 'Fix them first opens the Sheet on the rows that need fixing', fixing)
await tab(page, 'Share')
await page.getByRole('button', { name: 'Publish 195 Highreels' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click()
await page.waitForSelector('text=Highreels published')
await page.waitForTimeout(400)
const after = (await page.locator('[data-testid="share-publish"] .lead').innerText()).replace(/\s+/g, ' ')
expect(/^195 Highreels are live since \d+ \w+\. 5 still need fixing\.$/.test(after), 'then it says what\'s live', after)
await page.locator('[data-channel="links"]').click()
expect(await page.locator('main, [aria-labelledby="s-send"]').getByRole('button', { name: 'Export links CSV' }).first().isEnabled() && await page.locator('img[alt^="Link preview"]').count() === 1, 'the links export and a link preview')
expect(await page.getByRole('button', { name: 'Copy a message for it' }).count() === 1, 'a message to copy for the links file')
expect(await page.locator('nav[aria-label="Steps"] .step-dot.live').count() === 1, 'the Share tab is marked live')

// Your brand: once, for every recap.
const recap = campaignId(page)
const token = await tokenFor(page)
await page.locator('header').getByRole('link', { name: 'My business' }).click()
await page.waitForURL('**/app/brand')
// The logo fills its shape, no frame; circle by default, square on request.
await page.locator('[data-testid="logo-input"]').setInputFiles(`${FIX}/logo.png`)
await page.getByRole('button', { name: 'Replace', exact: true }).waitFor()
const mark = () => page.locator('img[src^="/media/"]').first().evaluate((img) => {
  const tile = getComputedStyle(img.parentElement)
  return { radius: tile.borderRadius, padding: tile.padding, fit: getComputedStyle(img).objectFit }
})
const round = await mark()
expect(round.radius === '50%' && round.padding === '0px' && round.fit === 'cover', 'the logo fills a circle, no frame', round)
await page.locator('[data-testid="logo-shape"] [data-value="square"]').click()
const squared = await mark()
expect(squared.radius !== '50%' && squared.padding === '0px', 'Square previews as a rounded square', squared)
await page.getByLabel('Business name').fill('Kafe Lumi')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Brand saved')
const brand = await page.evaluate(async () => (await (await fetch('/api/business')).json()).business)
expect(brand.name === 'Kafe Lumi' && brand.logo_shape === 'square' && !('accent_color' in brand), 'Your brand saves the name and logo shape (no colour: it belongs to the design)', brand)
const pub = await (await fetch(`${BASE}/api/r/${token}`)).json()
expect(pub.business.logo_shape === 'square' && pub.business.logo_url, 'published recaps get the logo and its shape', pub.business)
const og = await fetch(`${BASE}/api/r/${token}/og.png`)
expect(og.status === 200 && og.headers.get('content-type') === 'image/png', 'the link preview draws the shaped logo')
await page.goto(`${BASE}/app`)
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
expect(await page.locator('header').first().locator('img').count() === 0, 'the dashboard\'s top bar shows no logo')
await page.goto(`${BASE}/app/c/${recap}/design`)
await page.waitForSelector('[data-slide]')
await page.waitForTimeout(500)
const bg = await page.locator('aside[aria-label="Highreel preview"] .recap .slide').last().evaluate(el => getComputedStyle(el).backgroundColor)
expect(bg === 'rgb(79, 70, 229)' && (await page.locator('header').first().innerText()).includes('Kafe Lumi'), 'every recap follows Your brand\'s name, in its own look\'s colour (SPEC M2.17)', bg)
// Its colour comes from its look: another of the design's colours repaints it.
await page.locator('[data-testid="look"] [data-colorway="rust"]').click()
await page.waitForFunction(() => getComputedStyle([...document.querySelectorAll('aside[aria-label="Highreel preview"] .recap .slide')].at(-1)).backgroundColor === 'rgb(154, 52, 18)')
expect(true, 'picking rust in Design\'s Look repaints it')
await page.getByRole('button', { name: 'Discard' }).click()

// Switching recaps keeps the tab.
await page.getByRole('button', { name: 'Switch campaign' }).click()
await page.getByRole('menuitem', { name: 'New Highreel' }).click()
await newHighreel(page)
await page.waitForURL(u => new URL(u).pathname.endsWith('/design') && !new URL(u).pathname.includes(recap))
expect(true, 'a new recap opens on the same tab')
await tab(page, 'Sheet')
await page.waitForSelector('text=Use sample data')
expect(Object.keys(await sheetCounts(page)).length === 0, 'its sheet starts empty')

await browser.close()
finish(errors)
