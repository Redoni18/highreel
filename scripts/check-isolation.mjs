// Checks "every business sees only its own data" (SPEC M2, M2.14 P1) through
// the app's own API, the only way a browser reaches the database (D1 has no
// row-level security; the data layer filters every query). Two sessions, A and B: A sets up a
// published Highreel with a photo, a logo, a connected email account and a
// WhatsApp mark; B calls every workspace route with A's ids and must get a
// 404 (or a refusal) with nothing of A's changed. Also: nothing in the API
// writes the counters, the send log, opt-outs or bounces, and neither can
// reach the admin pages' routes (reading, blocking, removing) or make itself
// an admin (M2.15).
//
//   corepack pnpm dev            # in another terminal (needs Mailpit for A's email account)
//   corepack pnpm check:isolation
//
// tests/isolation.test.ts checks the same rule in the data layer's SQL.

import { BASE, demoSession, keepWork, launch, sql } from '../tests/e2e/lib.mjs'

let failed = 0
function check(name, ok, detail) {
  const d = detail === undefined ? '' : ` (${typeof detail === 'string' ? detail : JSON.stringify(detail)})`
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${d}`)
  if (!ok)
    failed++
}

const browser = await launch()
async function session() {
  const page = await (await browser.newContext()).newPage()
  await demoSession(page)
  const call = (path, method = 'GET', body, type = 'application/json') => page.evaluate(async ([p, m, b, t]) => {
    const r = await fetch(p, { method: m, headers: b === undefined ? {} : { 'content-type': t }, body: b === undefined ? undefined : t === 'application/json' ? JSON.stringify(b) : new Uint8Array(b) })
    const text = await r.text()
    let json = null
    try {
      json = JSON.parse(text)
    }
    catch {}
    return { status: r.status, body: json, text }
  }, [path, method, body, type])
  return { page, call, campaign: new URL(page.url()).pathname.split('/')[3] }
}

// A tiny "PNG": the server checks the first bytes only.
const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array.from({ length: 64 }, (_, i) => i)]

// --- A: a published Highreel with a photo, a logo, an email account and a WhatsApp mark ---
const A = await session()
await A.page.getByRole('button', { name: 'Use sample data' }).click()
await A.page.waitForSelector('[data-row-id]')
check('A publishes its Highreel', (await A.call(`/api/campaigns/${A.campaign}/publish`, 'POST')).status === 200)
const aRows = (await A.call(`/api/campaigns/${A.campaign}/recipients`)).body.rows
const aRow = aRows.find(r => r.token && !Object.keys(r.errors).length)
const aBusiness = (await A.call('/api/business')).body.business
const photo = await A.call(`/api/media?kind=photo&campaign=${A.campaign}`, 'POST', png, 'image/png')
const logo = await A.call('/api/media?kind=logo', 'POST', png, 'image/png')
check('A uploads a photo and a logo into its folder', photo.status === 200 && logo.status === 200 && photo.body.path.startsWith(`${aBusiness.id}/${A.campaign}/`) && logo.body.path.startsWith(`${aBusiness.id}/logo/`), [photo.status, logo.status])
await A.call('/api/business', 'PATCH', { logo_path: logo.body.path })
await A.call(`/api/campaigns/${A.campaign}`, 'PATCH', { settings: { photos: [{ id: 'p1', path: photo.body.path, caption: '', width: 1, height: 1 }], photos_consent: true } })
check('A marks a row sent on WhatsApp', (await A.call(`/api/campaigns/${A.campaign}/whatsapp`, 'POST', { recipient_id: aRow.id })).status === 200)
await keepWork(A.page, `isolation-a-${Date.now()}@example.com`, `${BASE}/app/c/${A.campaign}`)
const conn = await A.call('/api/business/email', 'PUT', { provider: 'local', from_email: 'a@a.test', from_name: 'A' })
check('A connects its email account', conn.status === 200, conn.body?.message)
const aSigned = (await A.call(`/api/campaigns/${A.campaign}`)).body
const photoUrl = aSigned.campaign.settings.photos[0]?.url
const before = {
  campaign: JSON.stringify({ ...aSigned.campaign, settings: { ...aSigned.campaign.settings, photos: aSigned.campaign.settings.photos.map(p => ({ ...p, url: '' })) } }),
  rows: JSON.stringify((await A.call(`/api/campaigns/${A.campaign}/recipients`)).body.rows),
  business: JSON.stringify({ ...aBusiness, logo_path: logo.body.path }),
  log: sql(`select count(*) as n from email_sends where business_id = '${aBusiness.id}'`)[0].n,
}

// --- B: every workspace route, with A's ids ---
const B = await session()
const c = `/api/campaigns/${A.campaign}`
const attempts = {
  'GET campaign': await B.call(c),
  'PATCH campaign': await B.call(c, 'PATCH', { name: 'Stolen', business: { name: 'Stolen' } }),
  'DELETE campaign': await B.call(c, 'DELETE'),
  'GET rows': await B.call(`${c}/recipients`),
  'GET rows (a later page)': await B.call(`${c}/recipients?after=10`),
  'DELETE rows': await B.call(`${c}/recipients`, 'DELETE'),
  'POST import': await B.call(`${c}/import`, 'POST', { rows: [{ customer_id: 'x', first_name: 'X' }] }),
  'POST import (a later part)': await B.call(`${c}/import`, 'POST', { part: 1, parts: 2, rows: [{ customer_id: 'x', first_name: 'X' }] }),
  'POST publish': await B.call(`${c}/publish`, 'POST'),
  'PATCH columns': await B.call(`${c}/columns`, 'PATCH', { key: 'x', remove: true }),
  'POST duplicate': await B.call(`${c}/duplicate`, 'POST', { name: 'Copy', year: 2027 }),
  'GET links file': await B.call(`${c}/export.csv`),
  'PUT business form': await B.call(`${c}/business`, 'PUT', { raw: {} }),
  'GET suggestions': await B.call(`${c}/suggestions`),
  'GET send status': await B.call(`${c}/send`),
  'POST send': await B.call(`${c}/send`, 'POST', {}),
  'POST send test': await B.call(`${c}/send`, 'POST', { test: true }),
  'POST WhatsApp mark': await B.call(`${c}/whatsapp`, 'POST', { recipient_id: aRow.id, sent: false }),
  'POST checkout': await B.call(`${c}/checkout`, 'POST', {}),
  'POST checkout confirm': await B.call(`${c}/checkout/confirm`, 'POST', { payment: 'pay_abcdef123' }),
  'PATCH A\'s row': await B.call(`/api/recipients/${aRow.id}`, 'PATCH', { column: 'first_name', value: 'Stolen' }),
  'POST photo into A\'s campaign': await B.call(`/api/media?kind=photo&campaign=${A.campaign}`, 'POST', png, 'image/png'),
}
for (const [name, r] of Object.entries(attempts))
  check(`B: ${name} → 404`, r.status === 404, r.status)

const bBusiness = (await B.call('/api/business')).body.business
const refused = {
  'delete A\'s photo': await B.call('/api/media/delete', 'POST', { paths: [photo.body.path] }),
  'delete A\'s logo': await B.call('/api/media/delete', 'POST', { paths: [logo.body.path] }),
  'take A\'s logo as its own': await B.call('/api/business', 'PATCH', { logo_path: logo.body.path }),
  'put A\'s photo in its own Highreel': await B.call(`/api/campaigns/${B.campaign}`, 'PATCH', { settings: { photos: [{ id: 'p', path: photo.body.path, caption: '', width: 1, height: 1 }], photos_consent: true } }),
  'put A\'s logo on its own Highreel': await B.call(`/api/campaigns/${B.campaign}`, 'PATCH', { business: { logo_path: logo.body.path } }),
}
for (const [name, r] of Object.entries(refused))
  check(`B can't ${name}`, r.status === 400 || r.status === 403, r.status)

const bHome = (await B.call('/api/home')).body
const bIndex = (await B.call('/api/workspace')).body
const bEmail = (await B.call('/api/business/email')).body
check('B\'s home and switcher list nothing of A\'s', bHome.campaigns.every(x => x.id !== A.campaign) && !bHome.activity.some(x => x.campaign_id === A.campaign) && bIndex.campaigns.every(x => x.id !== A.campaign))
check('B sees its own business, not A\'s', bBusiness.id !== aBusiness.id && bIndex.business.id === bBusiness.id)
check('B sees no email account (A\'s is A\'s)', bEmail.connection === null, bEmail.connection)
const forged = photoUrl?.replace(/sig=[0-9a-f]+/, `sig=${'0'.repeat(32)}`)
check('A signed link to A\'s photo works; a forged one doesn\'t', (await fetch(`${BASE}${photoUrl}`)).status === 200 && (await fetch(`${BASE}${forged}`)).status === 404)

// --- The admin pages (SPEC M2.15): a client reaches none, and can't make itself an admin ---
const aUser = (await A.call('/api/session')).body.user
for (const path of ['/api/admin/overview', '/api/admin/users', '/api/admin/users?kind=demos', '/api/admin/users?kind=blocked', `/api/admin/users/${aUser.id}`, '/api/admin/highreels?demos=1', '/api/admin/payments'])
  check(`B: GET ${path} → 404`, (await B.call(path)).status === 404)
// Nor the admin's actions: blocking A, removing A, unblocking an address.
const actions = {
  [`POST /api/admin/users/${aUser.id}/block`]: await B.call(`/api/admin/users/${aUser.id}/block`, 'POST', { reason: 'x' }),
  [`POST /api/admin/users/${aUser.id}/remove`]: await B.call(`/api/admin/users/${aUser.id}/remove`, 'POST', { block: true }),
  'POST /api/admin/unblock': await B.call('/api/admin/unblock', 'POST', { email: aUser.email }),
}
for (const [what, r] of Object.entries(actions))
  check(`B: ${what} → 404`, r.status === 404, r.status)
check('A is still there and not blocked', sql(`select count(*) as n from "user" where id = '${aUser.id}'`)[0].n === 1 && sql(`select count(*) as n from blocked_emails where email = lower('${aUser.email}')`)[0].n === 0)
for (const [who, X] of [['A (an account)', A], ['B (a demo)', B]]) {
  const asked = await X.call('/api/auth/update-user', 'POST', { role: 'admin' })
  const id = (await X.call('/api/session')).body.user.id
  check(`${who} can't set its own role`, asked.status === 400 && sql(`select role from "user" where id = '${id}'`)[0].role === 'client', [asked.status, asked.body?.message])
}

// --- Nothing of A's changed ---
const after = (await A.call(c)).body
check('A\'s campaign and brand are unchanged', JSON.stringify({ ...after.campaign, settings: { ...after.campaign.settings, photos: after.campaign.settings.photos.map(p => ({ ...p, url: '' })) } }) === before.campaign && after.business.name === aBusiness.name)
check('A\'s rows are unchanged', JSON.stringify((await A.call(`${c}/recipients`)).body.rows) === before.rows)
check('A\'s photo and logo are still there', (await fetch(`${BASE}${after.campaign.settings.photos[0].url}`)).status === 200 && (await fetch(`${BASE}${after.business.logo_url}`)).status === 200)
check('A\'s email account is still connected', (await A.call('/api/business/email')).body.connection?.from_email === 'a@a.test')

// --- What RLS's column grants did: no route for it ---
const counters = await A.call(`/api/recipients/${aRow.id}`, 'PATCH', { column: 'view_count', value: '999' })
check('A can\'t set view counters through a cell edit', counters.status === 400, counters.status)
for (const path of ['/api/email-sends', '/api/email_sends', '/api/sends', '/api/bounces', '/api/optouts', '/api/business/bounces'])
  check(`no route at ${path}`, [404, 405].includes((await A.call(path, 'DELETE')).status) && [404, 405].includes((await A.call(path, 'POST', {})).status))
check('A\'s send log is unchanged (only sending writes it)', sql(`select count(*) as n from email_sends where business_id = '${aBusiness.id}'`)[0].n === before.log)

await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nAll isolation checks passed')
process.exit(failed ? 1 : 0)
