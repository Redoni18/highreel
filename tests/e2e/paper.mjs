// The Paper theme (SPEC M2h) on every surface: live preview, recap, share
// image and link preview with the logo.
import { BASE, demoSession, expect, finish, FIX, launch, needFixtures, OUT, publish, tab, tokenFor, watchErrors, saveSummaryImage } from './lib.mjs'
import { writeFileSync } from 'node:fs'

needFixtures()
const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
watchErrors(page, errors)
await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
const sheet = page.url()
await page.goto(`${BASE}/app/brand`)
await page.locator('[data-testid="logo-input"]').setInputFiles(`${FIX}/logo.png`)
await page.locator('img[src^="/media/"]').first().waitFor()
await page.goto(sheet)
await page.waitForSelector('[data-row-id]')
await tab(page, 'Design')
await page.locator('[data-testid="theme"] [data-value="paper"]').click()
await page.waitForTimeout(400)
expect((await page.locator('aside[aria-label="Highreel preview"] .recap').getAttribute('class')).includes('theme-paper'), 'preview switches to Paper before saving')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Design saved')
await publish(page)
const token = await tokenFor(page, 'r => r.token && r.row_index === 3')

const r = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })).newPage()
await r.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' })
expect((await r.locator('.recap').getAttribute('class')).includes('theme-paper'), 'published recap uses Paper')
for (let i = 0; i < 9; i++) {
  await r.waitForTimeout(900)
  await r.screenshot({ path: `${OUT}/paper-${i}.png` })
  await r.keyboard.press('ArrowRight')
}
await r.waitForTimeout(1200)
const d = await saveSummaryImage(r)
await d.saveAs(`${OUT}/paper-share.png`)
const og = await fetch(`${BASE}/api/r/${token}/og.png`)
writeFileSync(`${OUT}/paper-og.png`, Buffer.from(await og.arrayBuffer()))
expect(og.status === 200, 'Paper link preview renders (see .out/paper-og.png)')
await browser.close()
finish(errors)
