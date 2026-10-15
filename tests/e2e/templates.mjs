// Business-type templates (shared/templates/starters.ts): New Highreel's
// wizard offers them all on its second step; picking one sets the sheet, the
// wording and the look it suggests (SPEC M2.17), which a look picked by hand
// on the third step replaces; Design then edits that wording slide by slide
// (it no longer offers templates, M2.8).
import { campaignId, demoSession, designItem, expect, finish, launch, newHighreel, tab, watchErrors } from './lib.mjs'

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
watchErrors(page, errors)
const campaign = async () => {
  const w = await page.evaluate(async c => (await fetch(`/api/campaigns/${c}`)).json(), campaignId(page))
  return { ...w.campaign, business: w.business }
}

await demoSession(page)
await page.getByRole('link', { name: 'All Highreels' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app')
await page.getByRole('button', { name: 'New Highreel' }).click()
const dialog = page.getByRole('dialog')
await dialog.getByRole('button', { name: 'Continue' }).click()
const offered = await dialog.locator('[data-starter]').count()
expect(offered === 11, 'New Highreel\'s second step offers ten business types and your own sheet', offered)
await dialog.getByRole('radio', { name: /Gym or fitness studio/ }).click()
await dialog.getByRole('button', { name: 'Continue' }).click()
await dialog.getByRole('button', { name: 'Create' }).click()
await page.waitForURL('**/app/c/*')
await page.waitForSelector('text=Use sample data')
let c = await campaign()
expect(c.template_key === 'visit' && c.settings.items_label === 'classes taken' && c.settings.copy.cover === '{first_name}, your {year} at {business}' && c.settings.cta_label === 'Book your next class',
  'the gym template sets the visit sheet and its wording', { template: c.template_key, settings: c.settings })
expect(c.settings.look.design === 'stories' && c.settings.look.colorway === 'pink', 'the gym type starts in its suggested look (Stories, pink)', c.settings.look)

// Design doesn't offer templates any more (M2.8: the template is picked in
// New recap); the template's wording is there to edit slide by slide.
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await tab(page, 'Design')
expect(await page.locator('[data-starter]').count() === 0, 'Design has no template picker')
await designItem(page, 'activities')
expect(await page.getByLabel('Activities label').inputValue() === 'classes taken', 'the slides show the template\'s wording')
await designItem(page, 'cover')
await page.waitForTimeout(500)
const bg = await page.locator('aside[aria-label="Highreel preview"] .recap .slide').last().evaluate(el => getComputedStyle(el).backgroundColor)
expect(bg === 'rgb(226, 69, 122)', 'in its look\'s colour', bg)

// Another type with a look picked by hand: the pick wins over the type's suggestion (SPEC M2.17).
await page.getByRole('button', { name: 'Switch campaign' }).click()
await page.getByRole('menuitem', { name: 'New Highreel' }).click()
const gym = campaignId(page)
await newHighreel(page, { type: /Café/, design: 'paper', colorway: 'sky' })
await page.waitForURL(u => !new URL(u).pathname.includes(gym))
await page.waitForSelector('[data-slide]')
c = await campaign()
expect(c.template_key === 'shop' && c.settings.copy.orders === 'You came by {orders} times this year.' && c.settings.look.design === 'paper' && c.settings.look.colorway === 'sky' && !('accent_color' in c.business), 'the café type with Paper in sky picked by hand; the business has no colour', { template: c.template_key, look: c.settings.look, business: c.business })

await browser.close()
finish(errors)
