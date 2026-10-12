// Accounts and isolation (SPEC M2a/M2b): demo session, a second user gets 404
// on every route of the first user's campaign, campaigns (new, switch, clear,
// delete), keep-work email, sign out, magic-link sign-in. Emails via Mailpit.
import { BASE, campaignId, demoSession, expect, finish, launch, publish, sheetCounts, tokenFor, watchErrors } from './lib.mjs'

const MAILPIT = 'http://127.0.0.1:54424'
async function latestLink(to) {
  for (let i = 0; i < 30; i++) {
    const list = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`).then(r => r.json())
    const msg = list.messages?.[0]
    if (msg) {
      const full = await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`).then(r => r.json())
      const link = (full.Text || full.HTML).match(/https?:\/\/[^\s"'<>]+verify[^\s"'<>]+/)?.[0]
      if (link)
        return link.replaceAll('&amp;', '&')
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`no email for ${to}`)
}

const browser = await launch()
const errors = []
async function newPage() {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  watchErrors(page, errors, /status of 404/)
  return page
}
const top = page => page.locator('header').first().innerText().then(t => t.replace(/\s+/g, ' '))
/** Sign-in links land on the home (or back in the workspace): open the campaign. */
async function openFirstCampaign(page) {
  await page.waitForSelector('[data-campaign], [data-row-id]', { timeout: 15000 })
  if (await page.locator('[data-campaign]').count())
    await page.locator('[data-campaign]').first().click()
  await page.waitForSelector('[data-row-id]')
}

const a = await newPage()
await demoSession(a)
await a.waitForSelector('text=Use sample data')
expect(await a.locator('text=Demo session').isVisible(), 'demo session shows the keep-work banner')
await a.getByRole('button', { name: 'Use sample data' }).click()
await a.waitForSelector('[data-row-id]')
await publish(a)
const aCampaign = campaignId(a)
const aToken = await tokenFor(a)

const visitor = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
const res = await visitor.goto(`${BASE}/r/${aToken}`)
expect(res.status() === 200 && await visitor.locator('.recap').count() === 1, 'recaps open without a session')

const b = await newPage()
await demoSession(b)
await b.waitForSelector('text=Use sample data')
const probe = await b.evaluate(async c => ({
  campaign: (await fetch(`/api/campaigns/${c}`)).status,
  rows: (await (await fetch(`/api/campaigns/${c}/recipients`)).json()).length,
  publish: (await fetch(`/api/campaigns/${c}/publish`, { method: 'POST' })).status,
  rename: (await fetch(`/api/campaigns/${c}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'x' }) })).status,
  export: (await fetch(`/api/campaigns/${c}/export.csv`)).status,
  // SPEC M2.7: a sheet's own columns and the Sheet's column menu.
  import: (await fetch(`/api/campaigns/${c}/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: [{ customer_id: 'x', first_name: 'X' }], columns: [{ key: 'evil', label: 'evil', type: 'text' }], slides: null }) })).status,
  columns: (await fetch(`/api/campaigns/${c}/columns`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: 'evil', remove: true }) })).status,
  // SPEC M2.8: sending and its status.
  sendStatus: (await fetch(`/api/campaigns/${c}/send`)).status,
  send: (await fetch(`/api/campaigns/${c}/send`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status,
  // SPEC M2.9: marking someone sent on WhatsApp.
  whatsapp: (await fetch(`/api/campaigns/${c}/whatsapp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipient_id: '00000000-0000-4000-8000-000000000000' }) })).status,
}), aCampaign)
expect(JSON.stringify(probe) === JSON.stringify({ campaign: 404, rows: 0, publish: 404, rename: 404, export: 404, import: 404, columns: 404, sendStatus: 404, send: 404, whatsapp: 404 }), 'another user gets nothing of A\'s campaign', probe)

await a.getByRole('button', { name: 'Switch campaign' }).click()
await a.getByRole('menuitem', { name: 'New highlight reel' }).click()
await a.getByLabel('Name').fill('Summer camp 2026')
await a.getByRole('button', { name: 'Create' }).click()
await a.waitForSelector('text=Use sample data')
expect((await top(a)).includes('Summer camp 2026'), 'new campaign opens')
await a.getByRole('button', { name: 'Switch campaign' }).click()
await a.getByRole('menuitem', { name: /2026 highlight reels/ }).click()
await a.waitForSelector('[data-row-id]')
expect((await sheetCounts(a)).published === 195, 'switching back keeps the published campaign')
await a.getByRole('button', { name: 'Switch campaign' }).click()
await a.getByRole('menuitem', { name: /Summer camp 2026/ }).click()
await a.waitForSelector('text=Use sample data')
await a.getByRole('button', { name: 'Use sample data' }).click()
await a.waitForSelector('[data-row-id]')
await a.getByRole('button', { name: 'More' }).click()
await a.getByRole('menuitem', { name: 'Clear rows' }).click()
await a.getByRole('dialog').getByRole('button', { name: 'Clear rows' }).click()
await a.waitForSelector('text=Use sample data')
expect(true, 'Clear rows empties a draft')
await a.getByRole('button', { name: 'Switch campaign' }).click()
await a.getByRole('menuitem', { name: 'Delete this highlight reel' }).click()
await a.getByRole('dialog').getByRole('button', { name: 'Delete highlight reel' }).click()
await a.waitForURL(u => new URL(u).pathname === '/app')
await a.waitForSelector('[data-campaign]')
expect(await a.locator('[data-campaign]').count() === 1 && !(await a.locator('main').innerText()).includes('Summer camp'), 'deleting a campaign goes home, where the other one remains')
await a.locator('[data-campaign]').first().click()
await a.waitForSelector('[data-row-id]')

const email = `demo-keeper-${Date.now()}@example.com`
await a.getByLabel('Email to keep this work').fill(email)
await a.getByRole('button', { name: 'Keep my work' }).click()
await a.waitForSelector(`text=Check ${email}`)
await a.goto(await latestLink(email))
await a.waitForURL('**/app**', { timeout: 15000 })
await openFirstCampaign(a)
expect(!(await a.locator('text=Demo session').isVisible()) && (await sheetCounts(a)).published === 195, 'confirming an email keeps the demo work')

await a.getByRole('button', { name: 'More' }).click()
await a.getByRole('menuitem', { name: 'Sign out' }).click()
await a.waitForURL('**/login')
await a.goto(`${BASE}/app`)
await a.waitForURL('**/login**')
expect(true, 'signed out, /app goes to /login')
await a.getByLabel('Work email').fill(email)
await a.getByRole('button', { name: 'Email me a sign-in link' }).click()
await a.waitForSelector('text=Check your email')
await a.goto(await latestLink(email))
await a.waitForURL('**/app**', { timeout: 15000 })
await openFirstCampaign(a)
expect((await sheetCounts(a)).published === 195, 'magic-link sign-in brings the work back')
await browser.close()
finish(errors)
