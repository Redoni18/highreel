// Accounts and isolation (SPEC M2a/M2b, M2.14 P3): demo session, a second
// user gets 404 on every route of the first user's campaign, campaigns (new,
// switch, clear, delete), keep-work email (work and files stay, the demo user
// goes; on another device too; refused for an address with its own
// Highreels), the Turnstile check, sign out, email-link sign-in. Emails via
// Mailpit.
import { BASE, campaignId, demoSession, expect, finish, inApp, latestLink, launch, publish, sheetCounts, sql, tokenFor, watchErrors, newHighreel } from './lib.mjs'

const browser = await launch()
const errors = []
async function newPage() {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  // 404s from probing another user's campaign; 400s from requests without Turnstile's token and the refused keep
  watchErrors(page, errors, /status of 40[04]/)
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
  rows: (await fetch(`/api/campaigns/${c}/recipients`)).status,
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
expect(JSON.stringify(probe) === JSON.stringify({ campaign: 404, rows: 404, publish: 404, rename: 404, export: 404, import: 404, columns: 404, sendStatus: 404, send: 404, whatsapp: 404 }), 'another user gets nothing of A\'s campaign', probe)

await a.getByRole('button', { name: 'Switch campaign' }).click()
await a.getByRole('menuitem', { name: 'New Highreel' }).click()
await newHighreel(a, { name: 'Summer camp 2026' })
await a.waitForSelector('text=Use sample data')
expect((await top(a)).includes('Summer camp 2026'), 'new campaign opens')
await a.getByRole('button', { name: 'Switch campaign' }).click()
await a.getByRole('menuitem', { name: /2026 Highreels/ }).click()
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
await a.getByRole('menuitem', { name: 'Delete this Highreel' }).click()
await a.getByRole('dialog').getByRole('button', { name: 'Delete Highreel' }).click()
await a.waitForURL(u => new URL(u).pathname === '/app')
await a.waitForSelector('main[aria-busy="false"] [data-campaign]')
expect(await a.locator('[data-campaign]').count() === 1 && !(await a.locator('main').innerText()).includes('Summer camp'), 'deleting a campaign goes home, where the other one remains')
await a.locator('[data-campaign]').first().click()
await a.waitForSelector('[data-row-id]')

// Both sign-in endpoints want Turnstile's token.
const bare = await a.evaluate(async () => Promise.all([
  fetch('/api/auth/sign-in/anonymous', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.status),
  fetch('/api/auth/sign-in/magic-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'bot@example.com' }) }).then(r => r.status),
]))
expect(bare[0] === 400 && bare[1] === 400, 'demo and email-link sign-in refuse a request without a Turnstile token', bare)

// A file in the demo's folder, to see it survive keeping the work.
const userOf = page => page.evaluate(() => fetch('/api/session').then(r => r.json()).then(s => s.user?.id ?? null))
const logoUrl = page => page.evaluate(() => fetch('/api/business').then(r => r.json()).then(b => b.business.logo_url ?? null))
const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array.from({ length: 64 }, (_, i) => i)]
await a.evaluate(async (bytes) => {
  const { path } = await fetch('/api/media?kind=logo', { method: 'POST', headers: { 'content-type': 'image/png' }, body: new Uint8Array(bytes) }).then(r => r.json())
  await fetch('/api/business', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ logo_path: path }) })
}, png)
const demoA = await userOf(a)

const email = `demo-keeper-${Date.now()}@example.com`
await a.getByLabel('Email to keep this work').fill(email)
await a.getByRole('button', { name: 'Keep my work' }).click()
await a.waitForSelector(`text=Check ${email}`)
const keepMail = (await (await fetch(`http://127.0.0.1:54424/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()).messages[0]
expect(keepMail?.Subject === 'Keep your Highreel demo' && keepMail.From.Address === 'hello@highreel.app', 'the keep-work email comes from hello@highreel.app', keepMail?.Subject)
await a.goto(await latestLink(email))
await a.waitForURL(inApp, { timeout: 15000 })
await openFirstCampaign(a)
expect(!(await a.locator('text=Demo session').isVisible()) && (await sheetCounts(a)).published === 195, 'confirming an email keeps the demo work')
const logo = await logoUrl(a)
expect(logo && (await a.evaluate(u => fetch(u).then(r => r.status), logo)) === 200, 'its files stay with it', logo)
expect(sql(`select count(*) as n from "user" where id = '${demoA}'`)[0].n === 0 && await userOf(a) !== demoA, 'the demo user is gone; the account is a new user')

// An address whose account already has Highreels: refused before anything is sent.
const b2 = await newPage()
await demoSession(b2)
await b2.getByLabel('Email to keep this work').fill(email)
await b2.getByRole('button', { name: 'Keep my work' }).click()
await b2.waitForSelector('text=already has a Highreel account')
expect(await b2.locator('text=Demo session').isVisible(), 'an address with its own Highreels can\'t take a demo')

// "Keep my work" opened on another device: the link claims the demo there.
const c = await newPage()
await demoSession(c)
await c.getByRole('button', { name: 'Use sample data' }).click()
await c.waitForSelector('[data-row-id]')
const cCampaign = campaignId(c)
const demoC = await userOf(c)
const elsewhere = `demo-phone-${Date.now()}@example.com`
await c.getByLabel('Email to keep this work').fill(elsewhere)
await c.getByRole('button', { name: 'Keep my work' }).click()
await c.waitForSelector(`text=Check ${elsewhere}`)
const phone = await newPage()
await phone.goto(await latestLink(elsewhere))
await phone.waitForURL(`**/app/c/${cCampaign}`, { timeout: 15000 })
await phone.waitForSelector('[data-row-id]')
expect(!(await phone.locator('text=Demo session').isVisible()) && sql(`select count(*) as n from "user" where id = '${demoC}'`)[0].n === 0, 'opened on another device: the demo\'s Highreel is in the account there, and the demo user is gone')
await c.goto(`${BASE}/app`)
await c.waitForURL('**/login**')
expect(true, 'the demo\'s own browser is signed out')

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
await a.waitForURL(inApp, { timeout: 15000 })
await openFirstCampaign(a)
expect((await sheetCounts(a)).published === 195, 'magic-link sign-in brings the work back')
await browser.close()
finish(errors)
