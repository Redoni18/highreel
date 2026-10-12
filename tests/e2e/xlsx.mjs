// .xlsx upload with the farm's own headers and the mapping dialog (SPEC M2f).
import { demoSession, expect, finish, FIX, launch, needFixtures, watchErrors } from './lib.mjs'

needFixtures()
const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const errors = []
watchErrors(page, errors)
await demoSession(page)
await page.getByRole('button', { name: 'Switch campaign' }).click()
await page.getByRole('menuitem', { name: 'New highlight reel' }).click()
await page.getByLabel('Name').fill('Korrik 2026')
await page.getByRole('radio', { name: /Summer camp/ }).click()
await page.getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('text=Visits and camps template')
await page.locator('[data-testid="file-input"]').setInputFiles(`${FIX}/ferma-korrik.xlsx`)
await page.waitForSelector('text=Match your columns')
const picks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[role="dialog"] [data-fields] tbody tr')].map((tr) => {
  // The column picked for each field: its Select's shown value.
  return [tr.querySelector('td').innerText.replace(' *', ''), tr.querySelector('[data-map]').innerText.trim()]
})))
expect(picks.participant_id === 'Nr' && picks.first_name === 'Emri' && picks.days === 'Ditët' && picks.activities_done === 'Animals fed' && picks.personal_note === 'Shënim', 'Albanian/English headers matched', picks)
// SPEC M2.7: the column no field takes ("Grupi") is offered as the recap's own, ticked, as text.
const own = await page.locator('[data-own-column]').evaluateAll(trs => trs.map(tr => [tr.dataset.ownColumn, tr.querySelector('[data-type]').innerText, tr.querySelector('[role="checkbox"]').getAttribute('aria-checked') === 'true']))
expect(JSON.stringify(own) === JSON.stringify([['grupi', 'Text', true]]), 'the extra column is offered as a slide', own)
await page.getByRole('button', { name: /Import 4 rows/ }).click()
await page.waitForSelector('[data-row-id]')
const rows = await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map(r => ['participant_id', 'first_name', 'visit_date', 'days'].map(c => r.querySelector(`[data-col="${c}"]`)?.innerText.trim()).join(',')))
expect(JSON.stringify(rows) === JSON.stringify(['1,Arta,2026-07-14,2', '2,Dren,2026-07-15,1', '3,Elira,2026-07-16,3', '4,Besnik,2026-07-17,2']), 'Excel dates and values imported; empty row dropped', rows)
const grupi = await page.evaluate(() => [...document.querySelectorAll('[data-row-id] [data-col="grupi"]')].map(c => c.innerText.trim()))
expect(grupi.length === 4 && grupi.every(v => v === 'Group A'), 'the own column is in the grid', grupi)
await page.locator('[data-testid="file-input"]').setInputFiles({ name: 'missing.csv', mimeType: 'text/csv', buffer: Buffer.from('Kid,Notes\nArta,hello\n') })
await page.waitForSelector('text=Match your columns')
expect(!(await page.getByRole('button', { name: /Import 1 rows/ }).isEnabled()), 'missing required columns block the import')
await browser.close()
finish(errors)
