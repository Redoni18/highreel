// Engagement columns (SPEC M2d) and the first-run business-name prompt.
import { BASE, campaignId, demoSession, expect, finish, launch, publish, tab, watchErrors, saveSummaryImage } from './lib.mjs'

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
watchErrors(page, errors)
await demoSession(page)
await page.getByLabel(/what's your business called/).fill('Ferma e Gjelbër')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(500)
expect((await page.locator('header').first().innerText()).includes('Ferma e Gjelbër'), 'first-run prompt names the business')
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await publish(page)
const c = campaignId(page)
const tokens = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}/recipients`)).json()).filter(r => r.token).slice(0, 3).map(r => r.token), c)

const v = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })
for (const t of tokens) {
  const p = await v.newPage()
  await p.goto(`${BASE}/r/${t}`, { waitUntil: 'networkidle' })
  await p.close()
}
const p2 = await v.newPage()
await p2.goto(`${BASE}/r/${tokens[0]}`, { waitUntil: 'networkidle' })
for (let i = 0; i < 12; i++) {
  await p2.keyboard.press('ArrowRight')
  await p2.waitForTimeout(100)
}
await p2.waitForTimeout(1200)
await saveSummaryImage(p2)
await p2.waitForTimeout(500)

await page.waitForTimeout(15500) // counters refresh at most every 15 s
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
await page.waitForTimeout(1500)
const cells = await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].slice(0, 2).map(r => ({
  viewed: r.querySelector('[data-col="__views"]').innerText.trim(),
  // The did column: emailed (M2.8), WhatsApp (M2.9), saved, shared, clicked.
  saved: [...r.querySelectorAll('[data-col="__actions"] [role="img"]')].map(el => el.getAttribute('aria-label')).find(l => /saved the image/i.test(l)),
})))
expect(cells[0].viewed === '2' && cells[0].saved === 'Saved the image' && cells[1].viewed === '1', 'viewed and saved show per row', cells)
await tab(page, 'Share')
const going = (await page.locator('[data-testid="going"]').innerText()).replace(/\s+/g, ' ')
expect(going.includes('3 of 195 opened') && going.includes('1 saved'), 'Share says how it\'s going: 3 opened, 1 saved', going)
await browser.close()
finish(errors)
