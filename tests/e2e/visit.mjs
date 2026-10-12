// The "visit" template end to end (SPEC M2e): a farm campaign with a group
// photo, activities label, publish, export keyed on participant_id, 8 slides.
import { BASE, campaignId, demoSession, designItem, expect, finish, FIX, launch, needFixtures, OUT, publish, sheetCounts, tab, watchErrors } from './lib.mjs'

needFixtures()
const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
watchErrors(page, errors)
await demoSession(page)
await page.getByLabel(/what's your business called/).fill('Green Valley Farm')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: 'Switch campaign' }).click()
await page.getByRole('menuitem', { name: 'New highlight reel' }).click()
await page.getByLabel('Name').fill('Summer farm days')
await page.getByRole('radio', { name: /Summer camp/ }).click()
await page.getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('text=Visits and camps template')
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await page.waitForTimeout(300)
const visitCounts = await sheetCounts(page)
expect(visitCounts.all === 120 && visitCounts.ready === 117 && visitCounts.errors === 3, 'visit sample: 120 rows, 3 to fix', visitCounts)

await tab(page, 'Design')
await designItem(page, 'activities')
await page.getByLabel('Activities label').fill('animals fed')
await designItem(page, 'note')
await page.getByLabel('Note from the team').fill('Thank you for spending your days with us. The animals already miss you!')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Design saved')
await designItem(page, 'photos')
await page.locator('[data-testid="photo-consent"]').check()
await page.locator('[data-testid="photo-input"]').setInputFiles([`${FIX}/farm-1.jpg`])
await page.waitForFunction(() => document.querySelectorAll('[data-inspector="photos"] li img').length === 1, null, { timeout: 20000 })
await publish(page)
const c = campaignId(page)
const token = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}/recipients`)).json()).find(r => r.token && r.data.badge && r.data.days > 1).token, c)
const header = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}/export.csv`)).text()).split('\n')[0], c)
expect(header === 'participant_id,first_name,email,link', 'export keyed on participant_id', header)
const payload = await (await fetch(`${BASE}/api/r/${token}`)).json()
expect(!('participant_id' in payload.recipient.values) && !('email' in payload.recipient.values), 'recap carries no id or email')

const r = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()
await r.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' })
const title = await r.locator('.cover-title').innerText()
expect(title.includes('your days at Green Valley Farm'), 'visit cover copy', title)
let count = 0
const scenes = []
let polaroid = false
for (let i = 0; i < 9; i++) {
  await r.waitForTimeout(1100)
  await r.screenshot({ path: `${OUT}/visit-${i}.png` })
  scenes.push(await r.evaluate(() => [...document.querySelectorAll('.recap .slide')].at(-1)?.dataset.scene))
  if (scenes.at(-1) === 'photo')
    polaroid = await r.locator('.polaroid img.photo').count() === 1
  const label = await r.locator('.recap .sr-only[aria-live]').innerText()
  count = Number(label.split(' of ')[1])
  if (label === `Slide ${count} of ${count}`)
    break
  await r.keyboard.press('ArrowRight')
}
expect(count === 8, 'visit recap with a photo has 8 slides', count)
expect(JSON.stringify(scenes) === JSON.stringify(['cover', 'days', 'count', 'word', 'badge', 'photo', 'note', 'share']), 'visit scenes: day pages, tokens, word, badge, polaroid, note', scenes)
expect(polaroid, 'the group photo shows as a polaroid')
expect((await r.locator('.lead').innerText()).startsWith('What a time'), 'visit share wording')
await browser.close()
finish(errors)
