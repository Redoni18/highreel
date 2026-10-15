// The business home (SPEC M2.5 P3, cards since M2.16): its numbers match the grid, activity,
// old /app?c= links redirect, Duplicate copies photos (not rows) into the
// next year, the year switcher, Delete, and a new account's empty state.
import { BASE, campaignId, demoSession, designItem, expect, finish, FIX, launch, needFixtures, publish, sheetCounts, tab, watchErrors, rowsOf } from './lib.mjs'

needFixtures()
const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const errors = []
watchErrors(page, errors)
const text = async sel => (await page.locator(sel).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim())

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await tab(page, 'Design')
await designItem(page, 'photos')
await page.locator('[data-testid="photo-consent"]').check()
await page.locator('[data-testid="photo-input"]').setInputFiles([`${FIX}/farm-1.jpg`])
await page.waitForFunction(() => document.querySelectorAll('[data-inspector="photos"] li img').length === 1, null, { timeout: 20000 })
await publish(page)
const first = campaignId(page)

// Three customers open their recap, one saves the image.
const tokens = (await rowsOf(page, first)).filter(r => r.token).slice(0, 3).map(r => r.token)
const event = (t, type) => fetch(`${BASE}/api/r/${t}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type }) })
for (const t of tokens)
  await event(t, 'view')
await event(tokens[0], 'save')
await page.goto(`${BASE}/app/c/${first}/share`)
await page.waitForSelector('[data-testid="going"]')
const going = (await page.locator('[data-testid="going"]').innerText()).replace(/\s+/g, ' ')

await page.getByRole('link', { name: 'All Highreels' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app')
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
const cards = await text('[data-card]')
expect(JSON.stringify(cards) === JSON.stringify(['Sent 195 in 1 campaign', 'Opened 3 2% of those sent', 'Shared 0 1 saved the image', 'Tapped your button 0 0% of those who opened']), 'the year in cards (SPEC M2.16)', cards)
expect(going.includes('3 of 195 opened') && going.includes('1 saved'), 'the recap\'s Share tab agrees: 3 of 195 opened, 1 saved', going)
const row = (await text(`[data-campaign="${first}"]`))[0]
expect(/2026 Highreels customers SaaS and apps published 200 195 2% 1 0 0/.test(row), 'the table row matches', row)
const activity = await text('[data-testid="activity"]')
expect(activity.length === 4 && activity.filter(a => a.includes('opened')).length === 3 && activity.some(a => a.includes('saved the image')), 'recent activity lists opens and the save', activity)

// Old links
await page.goto(`${BASE}/app?c=${first}`)
await page.waitForURL(`**/app/c/${first}`)
await page.waitForSelector('[data-row-id]')
expect(true, 'old /app?c= links open the workspace at /app/c/:id')

// Duplicate into next year: photos come along, rows don't.
await page.goto(`${BASE}/app`)
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
await page.getByRole('button', { name: 'Actions for 2026 Highreels' }).click()
await page.getByRole('menuitem', { name: 'Duplicate' }).click()
expect(await page.getByRole('dialog').getByLabel('Name').inputValue() === '2027 Highreels' && await page.getByRole('dialog').getByLabel('Year').inputValue() === '2027', 'Duplicate suggests the next year')
await page.getByRole('dialog').getByRole('button', { name: 'Duplicate' }).click()
await page.waitForURL(u => /\/app\/c\//.test(u.href) && !u.href.includes(first))
await page.waitForSelector('text=Use sample data')
const copy = campaignId(page)
const copied = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).campaign, copy)
expect(copied.year === 2027 && copied.settings.photos.length === 1 && copied.settings.photos[0].path.includes(`/${copy}/`) && !!copied.settings.photos[0].url, 'the duplicate has its own copy of the photo', copied.settings.photos)
const copiedRows = (await rowsOf(page, copy)).length
expect(copiedRows === 0, 'and no rows', copiedRows)

// Year switcher
await page.goto(`${BASE}/app`)
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
await page.getByRole('button', { name: 'Switch year' }).click()
await page.getByRole('menuitem', { name: '2027' }).click()
await page.waitForFunction(() => document.querySelector('#year-title')?.textContent?.includes('2027'))
await page.waitForSelector(`main[aria-busy="false"] [data-campaign="${copy}"]`)
expect(await page.locator('[data-campaign]').count() === 1 && (await text('[data-testid="attention"]'))[0]?.startsWith('2027 Highreels: no sheet yet'), 'the year switcher shows 2027 and its draft')

// Delete from the home, then the empty state of a brand-new account
await page.getByRole('button', { name: 'Actions for 2027 Highreels' }).click()
await page.getByRole('menuitem', { name: 'Delete' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
await page.waitForSelector('text=Nothing in 2027')
expect(true, 'Delete removes it from the table')
await page.getByRole('button', { name: 'Switch year' }).click()
await page.getByRole('menuitem', { name: '2026' }).click()
await page.waitForSelector(`main[aria-busy="false"] [data-campaign="${first}"]`)
await page.getByRole('button', { name: 'Actions for 2026 Highreels' }).click()
await page.getByRole('menuitem', { name: 'Delete' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
await page.waitForSelector('text=Make your first Highreel')
// The page behind a closing dialog is hidden from role queries until it's gone.
await page.getByRole('dialog').waitFor({ state: 'detached' })
expect(await page.getByRole('button', { name: /A Highreel of your business year/ }).isVisible(), 'an account without recaps gets the two ways in')
await page.getByRole('button', { name: 'Try it with sample data' }).click()
await page.waitForURL('**/app/c/*')
await page.waitForSelector('[data-row-id]')
expect((await sheetCounts(page)).all === 200, 'Try it with sample data opens a workspace with the sample loaded')
await browser.close()
finish(errors)
