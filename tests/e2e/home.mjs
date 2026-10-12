// The business home (SPEC M2.5 P3): its numbers match the grid, activity,
// old /app?c= links redirect, Duplicate copies photos (not rows) into the
// next year, the year switcher, Delete, and a new account's empty state.
import { BASE, campaignId, demoSession, designItem, expect, finish, FIX, launch, needFixtures, publish, sheetCounts, tab, watchErrors } from './lib.mjs'

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
const tokens = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}/recipients`)).json()).filter(r => r.token).slice(0, 3).map(r => r.token), first)
const event = (t, type) => fetch(`${BASE}/api/r/${t}/event`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type }) })
for (const t of tokens)
  await event(t, 'view')
await event(tokens[0], 'save')
await page.goto(`${BASE}/app/c/${first}/share`)
await page.waitForSelector('[data-testid="going"]')
const going = (await page.locator('[data-testid="going"]').innerText()).replace(/\s+/g, ' ')

await page.getByRole('link', { name: 'All highlight reels' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app')
await page.waitForSelector('[data-campaign]')
const summary = (await text('[data-testid="summary"]')).join(' ')
expect(summary === 'In 2026 you sent 195 highlight reels in 1 campaign. 3 were opened (2%) and 1 saved.', 'the year in sentences', summary)
expect(going.includes('3 of 195 opened') && going.includes('1 saved'), 'the recap\'s Share tab agrees: 3 of 195 opened, 1 saved', going)
const row = (await text(`[data-campaign="${first}"]`))[0]
expect(/2026 highlight reels customers SaaS and apps published 200 195 2% 1 0 0/.test(row), 'the table row matches', row)
const activity = await text('[data-testid="activity"]')
expect(activity.length === 4 && activity.filter(a => a.includes('opened')).length === 3 && activity.some(a => a.includes('saved the image')), 'recent activity lists opens and the save', activity)

// Old links
await page.goto(`${BASE}/app?c=${first}`)
await page.waitForURL(`**/app/c/${first}`)
await page.waitForSelector('[data-row-id]')
expect(true, 'old /app?c= links open the workspace at /app/c/:id')

// Duplicate into next year: photos come along, rows don't.
await page.goto(`${BASE}/app`)
await page.waitForSelector('[data-campaign]')
await page.getByRole('button', { name: 'Actions for 2026 highlight reels' }).click()
await page.getByRole('menuitem', { name: 'Duplicate' }).click()
expect(await page.getByRole('dialog').getByLabel('Name').inputValue() === '2027 highlight reels' && await page.getByRole('dialog').getByLabel('Year').inputValue() === '2027', 'Duplicate suggests the next year')
await page.getByRole('dialog').getByRole('button', { name: 'Duplicate' }).click()
await page.waitForURL(u => /\/app\/c\//.test(u.href) && !u.href.includes(first))
await page.waitForSelector('text=Use sample data')
const copy = campaignId(page)
const copied = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).campaign, copy)
expect(copied.year === 2027 && copied.settings.photos.length === 1 && copied.settings.photos[0].path.includes(`/${copy}/`) && !!copied.settings.photos[0].url, 'the duplicate has its own copy of the photo', copied.settings.photos)
const copiedRows = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}/recipients`)).json()).length, copy)
expect(copiedRows === 0, 'and no rows', copiedRows)

// Year switcher
await page.goto(`${BASE}/app`)
await page.waitForSelector('[data-campaign]')
await page.getByRole('button', { name: 'Switch year' }).click()
await page.getByRole('menuitem', { name: '2027' }).click()
await page.waitForFunction(() => document.querySelector('#year-title')?.textContent?.includes('2027'))
await page.waitForSelector(`[data-campaign="${copy}"]`)
expect(await page.locator('[data-campaign]').count() === 1 && (await text('[data-testid="attention"]'))[0]?.startsWith('2027 highlight reels: no sheet yet'), 'the year switcher shows 2027 and its draft')

// Delete from the home, then the empty state of a brand-new account
await page.getByRole('button', { name: 'Actions for 2027 highlight reels' }).click()
await page.getByRole('menuitem', { name: 'Delete' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
await page.waitForSelector('text=Nothing in 2027')
expect(true, 'Delete removes it from the table')
await page.getByRole('button', { name: 'Switch year' }).click()
await page.getByRole('menuitem', { name: '2026' }).click()
await page.waitForSelector(`[data-campaign="${first}"]`)
await page.getByRole('button', { name: 'Actions for 2026 highlight reels' }).click()
await page.getByRole('menuitem', { name: 'Delete' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
await page.waitForSelector('text=Make your first highlight reel')
expect(await page.getByRole('button', { name: /A highlight reel of your business year/ }).isVisible(), 'an account without recaps gets the two ways in')
await page.getByRole('button', { name: 'Try it with sample data' }).click()
await page.waitForURL('**/app/c/*')
await page.waitForSelector('[data-row-id]')
expect((await sheetCounts(page)).all === 200, 'Try it with sample data opens a workspace with the sample loaded')
await browser.close()
finish(errors)
