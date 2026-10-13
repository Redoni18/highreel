// M1 "done when" (SPEC §8): sample → exactly 5 red rows, slides skip, publish
// → 195 links, export CSV, fixing a row, 20+ rows visible, 10,000 rows scroll.
import { readFileSync } from 'node:fs'
import { BASE, demoSession, expect, finish, FIX, launch, log, needFixtures, OUT, publish, rowLoc, sheetCounts, watchErrors } from './lib.mjs'

needFixtures()
const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })).newPage()
const errors = []
watchErrors(page, errors)
const filter = name => page.locator('[data-slot="toggle-group-item"]', { hasText: name })

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await page.waitForTimeout(400)
let counts = await sheetCounts(page)
expect(counts.all === 200 && counts.ready === 195 && counts.errors === 5, 'sample loads with 5 rows to fix', counts)
const visible = await page.evaluate(() => {
  const sc = document.querySelector('.grid-scroll').getBoundingClientRect()
  return [...document.querySelectorAll('[data-row-id]')].filter((r) => {
    const b = r.getBoundingClientRect()
    return b.top >= sc.top + 32 && b.bottom <= sc.bottom
  }).length
})
expect(visible >= 20, '20+ rows fully visible at 1280×800', visible)

await filter('Needs fixing').click()
await page.waitForTimeout(300)
const flagged = await page.evaluate(() => [...document.querySelectorAll('[data-row-id]')].map(r => `${r.querySelector('[data-col="__row"]').innerText.trim()}: ${[...r.querySelectorAll('[data-tip-kind="error"]')].map(c => `${c.closest('[data-col]').dataset.col} ${c.dataset.tip}`).join(', ')}`))
expect(JSON.stringify(flagged) === JSON.stringify([
  '8: first_name Required',
  '24: active_days Needs a whole number',
  '59: customer_id Already used in row 58',
  '92: member_since Use YYYY-MM-DD',
  '141: top_percent Must be 1–100',
]), 'exactly the 5 planted errors, with their messages', flagged)
await filter(/^All/).click()

async function slidesFor(n) {
  await rowLoc(page, n).locator('[data-col="first_name"]').click()
  await page.waitForTimeout(200)
  return (await page.locator('aside[aria-label="Highreel preview"] .font-mono').innerText()).trim()
}
expect(await slidesFor(12) === 'slide 1/6', 'Kai (2-day streak) has no streak slide', await slidesFor(12))
expect(await slidesFor(4) === 'slide 1/8', 'Liam (top 3%) gets the rank slide', await slidesFor(4))

await publish(page)
counts = await sheetCounts(page)
expect(counts.published === 195, 'publish → 195 links', counts)
await page.getByRole('button', { name: 'More' }).click()
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Export links CSV' }).click()])
const csvPath = `${OUT}/${download.suggestedFilename()}`
await download.saveAs(csvPath)
const lines = readFileSync(csvPath, 'utf8').trim().split('\n')
expect(lines.length - 1 === 195 && lines[0] === 'customer_id,first_name,email,link', 'export has 195 rows', `${lines.length - 1} rows, ${lines[0]}`)
const urls = lines.slice(1).map(l => l.split(',').pop())
const statuses = await Promise.all([urls[0], urls[97], urls.at(-1)].map(u => fetch(u).then(r => r.status)))
expect(statuses.every(s => s === 200), 'exported links open', statuses)

await filter('Needs fixing').click()
await page.waitForTimeout(200)
await rowLoc(page, 8).locator('[data-col="first_name"]').click()
await page.keyboard.press('Enter')
await page.keyboard.type('Clara')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
await filter(/^All/).click()
await page.waitForTimeout(200)
const status8 = await rowLoc(page, 8).locator('[data-col="__status"] [role="img"]').getAttribute('aria-label')
expect(status8 === 'Ready', 'fixing row 8 in the grid turns it green', status8)
expect((await page.locator('header').getByRole('button', { name: /Publish/ }).innerText()) === 'Publish 1 new', 'publish button offers the new row')

// 10,000 rows in a new campaign
await page.getByRole('button', { name: 'Switch campaign' }).click()
await page.getByRole('menuitem', { name: 'New Highreel' }).click()
await page.getByLabel('Name').fill('10k test')
await page.getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('text=Use sample data')
const t0 = Date.now()
await page.locator('[data-testid="file-input"]').setInputFiles(`${FIX}/sample-10000.csv`)
await page.waitForSelector('text=10,000 rows imported', { timeout: 60000 })
const importMs = Date.now() - t0
expect(importMs < 5000, '10,000 rows import in under 5 s', `${importMs} ms`)
const perf = await page.evaluate(async () => {
  const el = document.querySelector('.grid-scroll')
  const frames = []
  let last = performance.now()
  const total = el.scrollHeight - el.clientHeight
  for (let i = 1; i <= 240; i++) {
    el.scrollTop = (total * i) / 240
    await new Promise(r => requestAnimationFrame(r))
    const now = performance.now()
    frames.push(now - last)
    last = now
  }
  frames.sort((a, b) => a - b)
  return { median: frames[120], p95: frames[228] }
})
expect(perf.median < 25 && perf.p95 < 40, '10k rows scroll smoothly (median < 25 ms, p95 < 40 ms)', perf)
await page.locator('[data-row-id]').first().locator('[data-col="first_name"]').click()
await page.keyboard.press('Meta+ArrowDown')
await page.waitForTimeout(300)
const lastActive = await page.evaluate(() => document.querySelector('.cell-active')?.closest('[data-row-id]')?.querySelector('[data-col="__row"]')?.innerText)
expect(lastActive === '10000', 'Cmd+Down jumps to the last row', lastActive)
log(`base ${BASE}`)
await browser.close()
finish(errors)
