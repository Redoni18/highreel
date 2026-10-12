// Logo and group photos (SPEC M2c): consent gate, browser shrinking, captions,
// order, photo slides, signed URLs without paths, share image, cleanup on delete.
// Since M2.6 the logo is on Your brand and the photos in a recap's Design tab.
import { BASE, campaignId, demoSession, designItem, env, expect, finish, FIX, launch, needFixtures, OUT, publish, tab, tokenFor, watchErrors, saveSummaryImage } from './lib.mjs'

needFixtures()
const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage()
const errors = []
watchErrors(page, errors)
await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
const sheet = page.url()

await page.goto(`${BASE}/app/brand`)
await page.locator('[data-testid="logo-input"]').setInputFiles(`${FIX}/logo.png`)
await page.locator('img[src*="/storage/v1/object/sign/media/"]').first().waitFor()
expect(await page.getByRole('button', { name: 'Replace', exact: true }).isVisible(), 'logo uploads on Your brand')
await page.goto(sheet)
await page.waitForSelector('[data-row-id]')
await tab(page, 'Design')
await designItem(page, 'photos')
const addBtn = page.getByRole('button', { name: 'Add photos' })
expect(!(await addBtn.isEnabled()), 'photos need the consent box first')
await page.locator('[data-testid="photo-consent"]').check()
await page.locator('[data-testid="photo-input"]').setInputFiles([`${FIX}/farm-1.jpg`, `${FIX}/farm-2.jpg`])
await page.waitForFunction(() => document.querySelectorAll('[data-inspector="photos"] li img').length === 2, null, { timeout: 20000 })
expect(!(await page.locator('[data-testid="photo-consent"]').count()), 'consent is remembered after the first upload')
await page.getByLabel('Caption for photo 1').fill('Feeding the baby goats')
await page.getByLabel('Caption for photo 1').press('Tab')
await page.waitForTimeout(600)
await page.getByRole('button', { name: 'Move photo 2 up' }).click()
await page.waitForTimeout(600)
expect(await page.getByLabel('Caption for photo 2').inputValue() === 'Feeding the baby goats', 'photos reorder')
const stored = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).campaign.settings.photos.map(p => `${p.width}x${p.height}.${p.path.split('.').pop()}`), campaignId(page))
expect(JSON.stringify(stored) === JSON.stringify(['1600x2000.webp', '2000x1333.webp']), 'photos shrink to 2000 px WebP in the browser', stored)
const logoExt = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).business.logo_path.split('.').pop(), campaignId(page))
expect(logoExt === 'png', 'logos are stored as PNG', logoExt)

await publish(page)
const c = campaignId(page)
const token = await tokenFor(page, 'r => r.token && r.row_index === 1')
const payload = await (await fetch(`${BASE}/api/r/${token}`)).json()
expect(payload.settings.photos.length === 2 && payload.settings.photos.every(p => p.path === '' && p.url.includes('token=')), 'public payload: signed URLs, no storage paths')
expect(payload.business.logo_url?.includes('token=') && payload.settings.photos_consent_at === null, 'public payload: signed logo, consent date hidden')

const r = await (await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true })).newPage()
await r.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' })
const total = Number((await r.locator('.recap .sr-only[aria-live]').innerText()).split(' of ')[1])
expect(total === 9, 'two photo slides join the 7 stat slides', total)
let sawPhoto = false
for (let i = 0; i < 9 && !sawPhoto; i++) {
  await r.keyboard.press('ArrowRight')
  await r.waitForTimeout(500)
  sawPhoto = await r.locator('img.photo').count() > 0
}
expect(sawPhoto, 'a photo slide shows the photo')
for (let i = 0; i < 9; i++)
  await r.keyboard.press('ArrowRight')
await r.waitForTimeout(1200)
const d = await saveSummaryImage(r)
await d.saveAs(`${OUT}/media-share.png`)
expect(true, 'share image saves with logo')

const biz = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).business.id, c)
await page.getByRole('button', { name: 'Switch campaign' }).click()
await page.getByRole('menuitem', { name: 'Delete this highlight reel' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Delete highlight reel' }).click()
await page.waitForSelector('text=Make your first highlight reel')
const left = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/media`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${env.SUPABASE_SECRET_KEY}`, 'apikey': env.SUPABASE_SECRET_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ prefix: `${biz}/${c}/`, limit: 100 }),
}).then(x => x.json())
expect(Array.isArray(left) && left.length === 0, 'deleting the campaign removes its photos', left.length)
expect((await fetch(`${BASE}/api/r/${token}`)).status === 404, 'its recaps stop working')
await browser.close()
finish(errors)
