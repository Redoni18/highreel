// Roles and the admin pages (SPEC M2.15). A client sees no Admin entry, is
// sent home from /app/admin, gets a 404 from every admin route and can't make
// itself an admin through Better Auth. Made an admin by hand (as the owner
// does), the same account gets the menu entry and the four tabs: the overview
// in sentences, its row on Users with what it made, published and paid, its
// own page, Highreels filtered by paid / not paid, and Payments. Taken back to
// client, the routes 404 again. On a phone the tables scroll inside their box.
import { BASE, campaignId, demoSession, expect, finish, keepWork, launch, OUT, publish, sql, watchErrors } from './lib.mjs'

const ADMIN_ROUTES = ['/api/admin/overview', '/api/admin/users', '/api/admin/users?kind=demos', '/api/admin/highreels', '/api/admin/payments']
const browser = await launch()
const errors = []
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
// The client's 404s from the admin routes are what's being checked.
watchErrors(page, errors, /status of 404/)
const call = (path, method = 'GET', body) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p, { method: m, headers: b ? { 'content-type': 'application/json' } : {}, body: b ? JSON.stringify(b) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}, [path, method, body])
const texts = async sel => (await page.locator(sel).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim())

// --- A client: an account with a published Highreel -----------------------------
await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await publish(page)
const campaign = campaignId(page)
const email = `admin-${Date.now()}@example.com`
await keepWork(page, email, `${BASE}/app`)
await page.waitForSelector('[data-campaign]')
const me = (await call('/api/session')).body.user
expect(me.role === 'client' && me.email === email, 'a new account is a client', me)

await page.getByRole('button', { name: 'Account' }).click()
expect(await page.getByRole('menuitem', { name: 'Admin' }).count() === 0, 'a client\'s account menu has no Admin entry')
await page.keyboard.press('Escape')

await page.goto(`${BASE}/app/admin/users`)
await page.waitForURL(u => new URL(u).pathname === '/app')
expect(true, 'a client opening /app/admin is sent home')

const closed = await Promise.all(ADMIN_ROUTES.map(p => call(p).then(r => r.status)))
expect(closed.every(s => s === 404), 'a client gets a 404 from every admin route', closed)
const self = await call(`/api/admin/users/${me.id}`)
expect(self.status === 404, 'and from its own user page', self.status)

// Through Playwright's request (the page's cookies, our origin), so the refusal isn't a console error.
const promoting = await page.request.post(`${BASE}/api/auth/update-user`, { data: { role: 'admin' }, headers: { origin: BASE } })
const promote = { status: promoting.status(), body: await promoting.json().catch(() => null) }
const still = (await call('/api/session')).body.user.role
expect(promote.status === 400 && /role is not allowed/.test(promote.body?.message) && still === 'client', 'Better Auth refuses a role sent from the browser', [promote.status, promote.body?.message, still])
expect(sql(`select role from "user" where id = '${me.id}'`)[0].role === 'client', 'and the database still says client')

// --- The owner makes it an admin by hand ---------------------------------------
sql(`update "user" set role = 'admin' where id = '${me.id}'`)
const business = sql(`select id from businesses where owner_id = '${me.id}'`)[0].id
await page.goto(`${BASE}/app`)
await page.waitForSelector('[data-campaign]')
await page.getByRole('button', { name: 'Account' }).click()
await page.getByRole('menuitem', { name: 'Admin' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app/admin')
await page.waitForSelector('[data-testid="summary"]')
const nav = await texts('nav[aria-label="Admin"] a')
expect(JSON.stringify(nav) === JSON.stringify(['Overview', 'Users', 'Highreels', 'Payments']), 'the admin pages have four tabs', nav)
const overview = (await texts('[data-testid="summary"]')).join(' ')
expect(/\d+ accounts?, .*signed in this week\. \d+ demo sessions? running\./.test(overview) && /Their customers got [\d,]+ Highreels/.test(overview), 'the overview is written in sentences', overview)
expect((await texts('[data-testid="newest"]'))[0]?.startsWith(email), 'the newest account is this one', (await texts('[data-testid="newest"]'))[0])
expect((await texts('[data-testid="attention"]'))[0]?.includes('been paid for'), 'the unpaid published Highreels are pointed out', await texts('[data-testid="attention"]'))
await page.screenshot({ path: `${OUT}admin-overview.png`, fullPage: true })

// A payment, as checkout's webhook will record it.
const payment = crypto.randomUUID()
sql(`insert into payments (id, business_id, campaign_id, provider_id, tier, amount, currency, status, paid_at)
  values ('${payment}', '${business}', '${campaign}', 'pay_test_${payment.slice(0, 8)}', 'founding', 9900, 'usd', 'paid', '${new Date().toISOString()}')`)

// Users: this account's row.
await page.locator('nav[aria-label="Admin"]').getByRole('link', { name: 'Users' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app/admin/users')
await page.getByLabel('Search users').fill(email)
await page.waitForFunction(() => document.querySelectorAll('tbody [data-row]').length === 1)
const cells = Object.fromEntries(await page.locator(`[data-row="${me.id}"] td`).evaluateAll(tds => tds.map(td => [td.dataset.col, td.innerText.trim()])))
expect(cells.email === email && cells.role === 'admin' && cells.highreels === '1' && cells.published === '1' && cells.unpaid === '0' && cells.live === '195' && cells.payments === '1' && cells.spent === '$99', 'Users: made 1, published 1, 195 customers, paid $99', cells)
const kinds = await texts('[aria-label="Which users"] button')
expect(kinds.length === 3 && /^Accounts \d/.test(kinds[0]) && /^Demos \d/.test(kinds[1]) && /^Admins \d/.test(kinds[2]), 'Accounts, Demos and Admins with their counts', kinds)
await page.getByLabel('Search users').fill('')
await page.locator('[aria-label="Which users"] button', { hasText: 'Demos' }).click()
await page.waitForURL(u => new URL(u).searchParams.get('kind') === 'demos')
await page.waitForFunction(() => document.querySelector('tbody [data-col="email"]')?.textContent.trim().startsWith('Demo '))
expect(true, 'Demos lists demo sessions, without an address')
await page.locator('[aria-label="Which users"] button', { hasText: 'Accounts' }).click()
await page.waitForURL(u => !new URL(u).searchParams.has('kind'))
await page.getByLabel('Search users').fill(email)
await page.waitForFunction(() => document.querySelectorAll('tbody [data-row]').length === 1)
await page.screenshot({ path: `${OUT}admin-users.png` })

// Sorting by a header.
await page.getByLabel('Search users').fill('')
await page.locator('th button', { hasText: 'Spent' }).click()
const firstSpent = await page.locator('tbody tr:first-child [data-col="spent"]').innerText()
expect(firstSpent !== '–' && await page.locator('th[aria-sort="descending"]', { hasText: 'Spent' }).count() === 1, 'a header sorts by its column, biggest spend first', firstSpent)

// Its own page.
await page.getByLabel('Search users').fill(email)
await page.locator(`[data-row="${me.id}"] td[data-col="business"]`).click()
await page.waitForURL(u => new URL(u).pathname === `/app/admin/users/${me.id}`)
await page.waitForSelector('[data-testid="summary"]')
const summary = (await texts('[data-testid="summary"]')).join(' ')
expect(summary.includes('Made 1 Highreel, published 1.') && summary.includes('Customers got 195 Highreels') && summary.includes('Paid $99 in 1 payment.'), 'the user\'s page sums it up', summary)
expect((await page.locator('h1').innerText()) === email, 'with the address as its title')
const theirs = Object.fromEntries(await page.locator(`[aria-label="Their Highreels"] [data-row="${campaign}"] td`).evaluateAll(tds => tds.map(td => [td.dataset.col, td.innerText.trim()])))
expect(theirs.status === 'published' && theirs.live === '195' && theirs.paid === '$99' && theirs.emailed === '0', 'its Highreel: published, 195 customers, paid $99', theirs)
expect(await page.locator(`[aria-label="Their payments"] [data-row="${payment}"]`).count() === 1, 'and its payment')
const pageText = await page.locator('main').innerText()
const firstRow = sql(`select first_name from recipients where campaign_id = '${campaign}' and first_name is not null limit 1`)[0].first_name
expect(!pageText.includes(firstRow), 'no customer\'s name from the sheet is shown', firstRow)
await page.screenshot({ path: `${OUT}admin-user.png`, fullPage: true })

// Highreels: paid and not paid.
await page.goto(`${BASE}/app/admin/highreels?show=paid`)
await page.waitForSelector('tbody tr')
expect(await page.locator(`[data-row="${campaign}"]`).count() === 1, 'Highreels → Paid lists it')
await page.locator('[aria-label="Which Highreels"] button', { hasText: 'Not paid' }).click()
await page.waitForURL(u => new URL(u).searchParams.get('show') === 'unpaid')
expect(await page.locator(`[data-row="${campaign}"]`).count() === 0 && await page.locator('tbody [data-col="paid"]', { hasText: '$' }).count() === 0, 'Not paid leaves it out')
await page.getByLabel('Include demos').click()
await page.waitForURL(u => new URL(u).searchParams.get('demos') === '1')
await page.waitForFunction(() => [...document.querySelectorAll('tbody [data-col="owner"]')].some(td => td.textContent.trim() === 'demo'))
expect(true, 'Include demos adds demo sessions\' Highreels')
await page.screenshot({ path: `${OUT}admin-highreels.png` })

// Payments.
await page.locator('nav[aria-label="Admin"]').getByRole('link', { name: 'Payments' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app/admin/payments')
await page.waitForSelector(`[data-row="${payment}"]`)
const pay = Object.fromEntries(await page.locator(`[data-row="${payment}"] td`).evaluateAll(tds => tds.map(td => [td.dataset.col, td.innerText.trim()])))
expect(pay.owner === email && pay.amount === '$99' && pay.tier === 'founding' && pay.status === 'paid', 'Payments lists it with the account and amount', pay)
expect(/^\$[\d,]+(\.\d\d)?( \+ .+)? from \d+ payments?/.test((await texts('[data-testid="summary"]'))[0]), 'and the total', await texts('[data-testid="summary"]'))

// On a phone: no sideways page scroll; the tables scroll in their box.
await page.setViewportSize({ width: 390, height: 844 })
for (const path of ['/app/admin', '/app/admin/users', `/app/admin/users/${me.id}`, '/app/admin/highreels', '/app/admin/payments']) {
  await page.goto(`${BASE}${path}`)
  await page.waitForSelector('main h1, main [data-testid="summary"]')
  // What sticks out, if anything (the tables' own scroll boxes and the fixed toast area aside).
  const wide = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter(el => el.getBoundingClientRect().right > innerWidth + 0.5 && !el.parentElement?.closest('.overflow-x-auto') && !el.closest('[data-sonner-toaster]'))
    .map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} → ${Math.round(el.getBoundingClientRect().right)}`))
  expect(!wide.length && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} doesn't scroll sideways on a phone`, wide.slice(0, 4))
}
await page.goto(`${BASE}/app/admin`)
await page.waitForSelector('[data-testid="summary"]')
await page.screenshot({ path: `${OUT}admin-phone.png`, fullPage: true })

// --- Back to client ------------------------------------------------------------
sql(`update "user" set role = 'client' where id = '${me.id}'`)
const after = await Promise.all(ADMIN_ROUTES.map(p => call(p).then(r => r.status)))
expect(after.every(s => s === 404), 'taken back to client, the next request gets a 404', after)
await page.goto(`${BASE}/app/admin/payments`)
await page.waitForURL(u => new URL(u).pathname === '/app')
expect(true, 'and the pages send it home')
sql(`delete from payments where id = '${payment}'`)

await browser.close()
finish(errors)
