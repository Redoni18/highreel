// The business's own recap (SPEC M2.5 P4): created from the home, a form
// with suggestions from the year's customer recaps and a live preview,
// publish, the public page (timeline scene, wording for followers), story
// and square images, the link preview, edits after publishing, and the home
// listing it.
import { readFileSync } from 'node:fs'
import { BASE, campaignId, demoSession, expect, finish, launch, OUT, publish, tab, watchErrors } from './lib.mjs'

const pngSize = (file) => {
  const b = readFileSync(file)
  return `${b.readUInt32BE(16)}×${b.readUInt32BE(20)}`
}

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage()
const errors = []
watchErrors(page, errors)

// A customer campaign first, so there's something to suggest.
await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await publish(page)

await page.getByRole('link', { name: 'All Highreels' }).click()
await page.waitForSelector('[data-campaign]')
await page.getByRole('button', { name: 'New Highreel' }).click()
await page.getByRole('radio', { name: /Your business year/ }).click()
expect(await page.getByRole('dialog').getByLabel('Name').inputValue() === `Our ${new Date().getFullYear()}`, 'a business recap is named "Our <year>"')
await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('text=Tell your followers about your year')
const c = campaignId(page)
const publishBtn = page.locator('header').getByRole('button', { name: 'Publish' })
expect(await publishBtn.isDisabled(), 'Publish waits for the first number')
expect(!(await page.locator('header').getByRole('button', { name: 'Upload', exact: true }).count()) && !(await page.locator('[data-row-id]').count()), 'a form, no grid or upload')

await page.waitForSelector('[data-testid="suggestion"]')
const chips = await page.locator('[data-testid="suggestion"]').allInnerTexts()
expect(chips[0]?.replace(/\s+/g, ' ') === '195 customers got a Highreel', 'suggestions come from the year\'s customer recaps', chips)
await page.locator('[data-testid="suggestion"]').first().click()
expect(await page.getByLabel('Number 1', { exact: true }).inputValue() === '195' && await page.getByLabel('What number 1 counts').inputValue() === 'customers got a Highreel', 'a chip fills the first empty number')
await page.getByLabel('Number 2', { exact: true }).fill('52')
await page.getByLabel('What number 2 counts').fill('baby goats born')
await page.getByLabel('Highlight of the year').fill('Our first summer camp')
await page.getByLabel('Milestone 1').fill('March: opened the new barn')
await page.getByLabel('Milestone 2').fill('July: 300 kids at summer camp')

const preview = page.locator('aside[aria-label="Highreel preview"]')
expect((await preview.locator('.recap').getAttribute('aria-label')).startsWith('Our 2026 at'), 'the preview plays the business recap')
expect((await preview.locator('.font-mono').innerText()).trim() === 'slide 1/7', 'live preview: cover, 2 numbers, highlight, milestones, note, share', await preview.locator('.font-mono').innerText())

await publishBtn.click()
await page.waitForSelector('text=Your Highreel is live')
await tab(page, 'Share')
const link = await page.getByLabel('Link', { exact: true }).inputValue()
expect(/\/r\/[\w-]{12}$/.test(link), 'publishing saves the form and gives one link', link)
expect(await page.locator('header').getByRole('button', { name: 'Published' }).isDisabled(), 'the top bar says Published')

for (const [name, size] of [['Story image', '1080×1920'], ['Square image', '1080×1080']]) {
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: new RegExp(name) }).click()])
  const file = `${OUT}/business-${d.suggestedFilename()}`
  await d.saveAs(file)
  expect(pngSize(file) === size, `${name} is ${size}`, `${d.suggestedFilename()} ${pngSize(file)}`)
}
const ogSrc = await page.locator('img[alt^="Link preview"]').getAttribute('src')
const og = await fetch(new URL(ogSrc, BASE))
expect(og.status === 200 && og.headers.get('content-type') === 'image/png', 'the link preview renders and is shown')

// The public page, as a follower sees it
const r = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
watchErrors(r, errors)
await r.goto(link, { waitUntil: 'networkidle' })
expect(await r.title() === 'Our 2026 at My business', 'the page title speaks for the business', await r.title())
expect(await r.locator('meta[property="og:description"]').getAttribute('content') === 'A look back at My business\'s 2026.', 'so does the link preview text')
const scenes = []
const total = Number((await r.locator('.recap .sr-only[aria-live]').innerText()).split(' of ')[1])
for (let i = 0; i < total; i++) {
  scenes.push(await r.locator('.recap .slide').last().getAttribute('data-scene'))
  await r.keyboard.press('ArrowRight')
  await r.waitForTimeout(250)
}
expect(JSON.stringify(scenes) === JSON.stringify(['cover', 'count', 'count', 'word', 'timeline', 'note', 'share']), 'slides: cover, numbers, highlight, milestones, thank-you, share', scenes)
const items = await r.evaluate(async (t) => {
  const p = await (await fetch(`/api/r/${t}`)).json()
  return p.recipient
}, link.split('/r/')[1])
expect(!('customer_id' in items.values) && items.values.stat_1_label === 'customers got a Highreel' && items.values.milestone_1 === 'March: opened the new barn', 'the public payload carries the form values (with labels), no id', items.values)

// Edits after publishing update the same link.
await tab(page, 'Content')
await page.getByLabel('Highlight of the year').fill('A goat named Pancake')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Your published Highreel shows it now')
const after = await (await fetch(`${BASE}/api/r/${link.split('/r/')[1]}`)).json()
expect(after.recipient.values.highlight === 'A goat named Pancake', 'saving updates the published recap in place')

// The home lists it.
await page.getByRole('link', { name: 'All Highreels' }).click()
await page.waitForSelector(`[data-campaign="${c}"]`)
const row = (await page.locator(`[data-campaign="${c}"]`).innerText()).replace(/\s+/g, ' ')
expect(/your business Your business year published 1 1 1 views/.test(row), 'the home lists it as your business, with its views', row)
const summary = (await page.locator('[data-testid="summary"]').allInnerTexts()).join(' ')
expect(summary.includes('Your Highreel “Our 2026” was viewed 1 time.'), 'the year summary mentions it', summary)
await browser.close()
finish(errors)
