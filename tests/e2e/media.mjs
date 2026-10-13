// Logo and group photos (SPEC M2c): consent gate, browser shrinking, captions,
// order, photo slides, signed URLs without paths, share image, cleanup on delete.
// Since M2.6 the logo is on Your brand and the photos in a recap's Design tab;
// since M2.14 P2 files live in R2 behind signed /media/ links.
import { BASE, campaignId, demoSession, designItem, expect, finish, FIX, launch, needFixtures, OUT, publish, tab, tokenFor, watchErrors, saveSummaryImage } from './lib.mjs'

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
await page.locator('img[src^="/media/"]').first().waitFor()
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
const token = await tokenFor(page, 'r => r.token && r.row_index === 1')
const payload = await (await fetch(`${BASE}/api/r/${token}`)).json()
const signedLink = /^\/media\/[\w/-]+\.\w+\?exp=\d+&sig=[0-9a-f]{32}$/
expect(payload.settings.photos.length === 2 && payload.settings.photos.every(p => p.path === '' && signedLink.test(p.url)), 'public payload: signed URLs, no storage paths', payload.settings.photos[0]?.url)
expect(signedLink.test(payload.business.logo_url ?? '') && payload.settings.photos_consent_at === null, 'public payload: signed logo, consent date hidden')
const photoUrl = `${BASE}${payload.settings.photos[0].url}`
const photo = await fetch(photoUrl)
expect(photo.status === 200 && photo.headers.get('content-type') === 'image/webp' && /private, max-age=\d+/.test(photo.headers.get('cache-control') ?? ''), 'a signed link serves the photo', [photo.status, photo.headers.get('content-type'), photo.headers.get('cache-control')])
const tampered = photoUrl.replace(/sig=(.)/, (_, c) => `sig=${c === '0' ? '1' : '0'}`)
expect((await fetch(tampered)).status === 404, 'a tampered signature gets a 404')
expect((await fetch(photoUrl.replace(/exp=\d+/, 'exp=1000000000'))).status === 404, 'an expired (or edited) expiry gets a 404')
const preview = await fetch(`${BASE}/api/r/${token}/og.png`)
const previewAgain = await fetch(`${BASE}/api/r/${token}/og.png`)
expect(preview.status === 200 && previewAgain.status === 200 && Buffer.compare(Buffer.from(await preview.arrayBuffer()), Buffer.from(await previewAgain.arrayBuffer())) === 0, 'the link preview is drawn once and served again')

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

await page.getByRole('button', { name: 'Switch campaign' }).click()
await page.getByRole('menuitem', { name: 'Delete this Highreel' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Delete Highreel' }).click()
await page.waitForSelector('text=Make your first Highreel')
// The link still verifies; the file behind it is gone.
expect((await fetch(photoUrl)).status === 404, 'deleting the campaign removes its photos', photoUrl)
expect((await fetch(`${BASE}/api/r/${token}`)).status === 404, 'its recaps stop working')
await browser.close()
finish(errors)
