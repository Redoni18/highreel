// Roles and the admin pages (SPEC M2.15). A client sees no Admin entry, is
// sent home from /app/admin, gets a 404 from every admin route and can't make
// itself an admin through Better Auth. Made an admin by hand (as the owner
// does), the same account gets the menu entry and the sidebar's four
// sections: the overview's figures, its row on Users with what it made,
// published and paid, its own page, Highreels filtered by paid / not paid, and
// Payments. Another account is blocked from its row's menu (signed out, no
// sign-in link, its Highreel stops opening), unblocked from the Blocked list,
// then removed from its page with its address blocked. Admins can't be
// blocked. Taken back to client, the routes 404 again. On a phone the sidebar
// is a row on top and the tables scroll inside their box.
import { BASE, campaignId, demoSession, expect, finish, keepWork, launch, OUT, publish, sql, tokenFor, watchErrors } from './lib.mjs'

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
await page.waitForSelector('[data-figures]')
const nav = await texts('nav[aria-label="Admin"] a')
expect(JSON.stringify(nav) === JSON.stringify(['Overview', 'Users', 'Highreels', 'Payments']), 'the admin pages have four sections', nav)
const [side, main] = await Promise.all([page.locator('aside').boundingBox(), page.locator('main').boundingBox()])
expect(side.x === 0 && side.height >= 890 && main.x >= side.x + side.width && await page.locator('nav[aria-label="Admin"] a[aria-current="page"]').innerText() === 'Overview', 'they\'re in a sidebar on the left, the page on the right', { side, main })
// Figures, one a row: no sentences, no handwriting.
const figure = (group, label) => page.locator(`[data-figures="${group}"] [data-figure="${label}"] [data-value]`).innerText()
const groups = await texts('[data-figures] h2')
expect(JSON.stringify(groups) === JSON.stringify(['People', 'Highreels', 'Their customers', 'Money']), 'the overview\'s figures: people, Highreels, their customers, money', groups)
const accounts = Number((await figure('People', 'Accounts')).replace(/,/g, ''))
const got = Number((await figure('Their customers', 'Got a Highreel')).replace(/,/g, ''))
expect(accounts >= 1 && got >= 195, 'with numbers in them', { accounts, got })
expect(await page.locator('[data-figure="Not paid for"] .rounded-full').count() === 1, 'unpaid published Highreels are flagged')
expect(await page.locator('main .note-hand').count() === 0 && await page.locator('main p').evaluateAll(ps => ps.every(p => p.innerText.length < 120)), 'no handwriting, no long sentences')
expect((await texts('[data-testid="newest"]'))[0]?.startsWith(email), 'the newest account is this one', (await texts('[data-testid="newest"]'))[0])
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
expect(kinds.length === 4 && /^Accounts \d/.test(kinds[0]) && /^Demos \d/.test(kinds[1]) && /^Admins \d/.test(kinds[2]) && /^Blocked \d/.test(kinds[3]), 'Accounts, Demos, Admins and Blocked with their counts', kinds)
expect(await page.locator(`[data-row="${me.id}"] [data-testid="user-actions"]`).count() === 0, 'an admin\'s row has no block or remove menu')
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
// Wider than the page, the table scrolls sideways without a scrollbar (owner,
// 2026-10-13); a mouse wheel can't, so an arrow on the edge with hidden columns does.
const sideways = () => page.locator('[data-table-scroll] > div').first().evaluate(el => ({ bar: getComputedStyle(el).scrollbarWidth, left: el.scrollLeft, max: el.scrollWidth - el.clientWidth, arrows: [...el.parentElement.querySelectorAll('[data-scroll]')].map(b => b.dataset.scroll).join() }))
const narrow = await sideways()
expect(narrow.bar === 'none' && narrow.max > 0 && narrow.left === 0 && narrow.arrows === 'right', 'Users is wider than the page: no scrollbar, an arrow on the right', narrow)
await page.locator('[data-scroll="right"]').click()
await page.waitForFunction(() => document.querySelector('[data-scroll="left"]') && !document.querySelector('[data-scroll="right"]'))
const scrolled = await sideways()
const spent = await page.locator('th', { hasText: 'Spent' }).evaluate(th => ({ right: th.getBoundingClientRect().right, pinned: th.closest('tr').querySelector('.pinned').getBoundingClientRect().left }))
// Within a pixel: scrollLeft can stop a fraction short of the end.
expect(scrolled.left >= scrolled.max - 1 && scrolled.arrows === 'left' && spent.right <= spent.pinned + 1, 'the arrow brings in the last columns, and one appears on the left to go back', { ...scrolled, spent })
await page.locator('[data-scroll="left"]').click()
await page.waitForFunction(() => !document.querySelector('[data-scroll="left"]'))
expect((await sideways()).left <= 1, 'and back', await sideways())

// Sorting by a header.
await page.getByLabel('Search users').fill('')
await page.locator('th button', { hasText: 'Spent' }).click()
const firstSpent = await page.locator('tbody tr:first-child [data-col="spent"]').innerText()
expect(firstSpent !== '–' && await page.locator('th[aria-sort="descending"]', { hasText: 'Spent' }).count() === 1, 'a header sorts by its column, biggest spend first', firstSpent)

// Its own page.
await page.getByLabel('Search users').fill(email)
await page.locator(`[data-row="${me.id}"] td[data-col="business"]`).click()
await page.waitForURL(u => new URL(u).pathname === `/app/admin/users/${me.id}`)
await page.waitForSelector('[data-figures]')
const mine = { made: await figure('Highreels', 'Made'), published: await figure('Highreels', 'Published'), got: await figure('Their customers', 'Got a Highreel'), spent: await figure('Money', 'Spent') }
expect(mine.made === '1' && mine.published === '1' && mine.got === '195' && mine.spent === '$99', 'the user\'s page: made 1, published 1, 195 customers, spent $99', mine)
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
expect(/^[^\d\s]+[\d,]+(\.\d\d)?( \+ .+)? from \d+ payments?/.test((await texts('[data-testid="summary"]'))[0]), 'and the total (the biggest currency first)', await texts('[data-testid="summary"]'))

// On a phone: no sideways page scroll; the tables scroll in their box.
await page.setViewportSize({ width: 390, height: 844 })
for (const path of ['/app/admin', '/app/admin/users', `/app/admin/users/${me.id}`, '/app/admin/highreels', '/app/admin/payments']) {
  await page.goto(`${BASE}${path}`)
  await page.waitForSelector('main h1')
  // What sticks out, if anything (the tables' own scroll boxes and the fixed toast area aside).
  const wide = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter(el => el.getBoundingClientRect().right > innerWidth + 0.5 && !el.parentElement?.closest('.overflow-x-auto') && !el.closest('[data-sonner-toaster]'))
    .map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} → ${Math.round(el.getBoundingClientRect().right)}`))
  expect(!wide.length && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} doesn't scroll sideways on a phone`, wide.slice(0, 4))
}
await page.goto(`${BASE}/app/admin`)
await page.waitForSelector('[data-figures]')
const [bar, top] = await Promise.all([page.locator('nav[aria-label="Admin"]').boundingBox(), page.locator('main').boundingBox()])
expect(bar.y + bar.height <= top.y && bar.width > 300, 'on a phone the sections are a row above the page', { bar, top })
await page.screenshot({ path: `${OUT}admin-phone.png`, fullPage: true })
await page.setViewportSize({ width: 1440, height: 900 })

// --- Blocking and removing another account ---------------------------------------
const other = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
// Signed out by the block: its requests' 401s, and the refused link, are what's checked.
watchErrors(other, errors, /status of (401|403)/)
await demoSession(other)
await other.getByRole('button', { name: 'Use sample data' }).click()
await other.waitForSelector('[data-row-id]')
await publish(other)
const otherToken = await tokenFor(other)
const otherEmail = `blocked-${Date.now()}@example.com`
await keepWork(other, otherEmail, `${BASE}/app`)
await other.waitForSelector('[data-campaign]')
const them = (await other.evaluate(() => fetch('/api/session').then(r => r.json()))).user
const recapStatus = () => fetch(`${BASE}/api/r/${otherToken}`).then(r => r.status)
expect(await recapStatus() === 200, 'its published Highreel opens')

// Block it from its row's menu, with a note.
await page.goto(`${BASE}/app/admin/users`)
await page.getByLabel('Search users').fill(otherEmail)
await page.waitForFunction(() => document.querySelectorAll('tbody [data-row]').length === 1)
await page.locator(`[data-row="${them.id}"] [data-testid="user-actions"]`).click()
await page.getByRole('menuitem', { name: 'Block…' }).click()
await page.getByRole('dialog').getByLabel(/Note for admins/).fill('Sent spam')
await page.getByTestId('confirm-block').click()
await page.waitForSelector(`[data-row="${them.id}"] [data-testid="blocked-badge"]`)
expect(new URL(page.url()).pathname === '/app/admin/users', 'Block happens in place, and the row says blocked')
const blockedRow = sql(`select email, reason, blocked_by from blocked_emails where email = '${otherEmail}'`)[0]
expect(blockedRow?.reason === 'Sent spam' && blockedRow?.blocked_by === me.id, 'the address is on the block list with the note and who blocked it', blockedRow)
expect(sql(`select count(*) as n from session where "userId" = '${them.id}'`)[0].n === 0, 'its sessions ended')
const theirApi = await other.evaluate(() => fetch('/api/home').then(r => r.status))
expect(theirApi === 401, 'its next request is refused (signed out)', theirApi)
expect(await recapStatus() === 404, 'its Highreel stops opening')
// Typed once the page has started (before that, the form isn't listening yet).
await other.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await other.getByLabel('Work email').fill(otherEmail)
await other.getByRole('button', { name: 'Email me a sign-in link' }).click()
const refusal = await other.getByRole('alert').innerText()
expect(/can't sign in to Highreel/.test(refusal), 'asking for a sign-in link says the address can\'t sign in', refusal)
await page.screenshot({ path: `${OUT}admin-blocked-row.png` })

// The Blocked list, and unblocking from it.
await page.getByLabel('Search users').fill('')
await page.locator('[aria-label="Which users"] button', { hasText: 'Blocked' }).click()
await page.waitForURL(u => new URL(u).searchParams.get('kind') === 'blocked')
const listed = page.locator(`[data-row="${otherEmail}"]`)
await listed.waitFor()
const row = Object.fromEntries(await listed.locator('td').evaluateAll(tds => tds.map(td => [td.dataset.col, td.innerText.trim()])))
expect(row.account === 'Open account' && row.reason === 'Sent spam' && row.by === email, 'Blocked lists the address, its account, the note and who blocked it', row)
await page.screenshot({ path: `${OUT}admin-blocked.png` })
await listed.getByTestId('unblock').click()
await listed.waitFor({ state: 'detached' })
expect(sql(`select count(*) as n from blocked_emails where email = '${otherEmail}'`)[0].n === 0 && await recapStatus() === 200, 'Unblock lifts it: the Highreel opens again')

// An admin can't be blocked, even through the API.
// (Through Playwright's request, so the expected 409 isn't a console error.)
const blocking = await page.request.post(`${BASE}/api/admin/users/${me.id}/block`, { data: {}, headers: { origin: BASE } })
const selfBlock = [blocking.status(), (await blocking.json().catch(() => null))?.message]
expect(selfBlock[0] === 409 && sql(`select count(*) as n from blocked_emails where email = '${email}'`)[0].n === 0, 'blocking an admin is refused', selfBlock)

// Remove it from its page, blocking the address too.
const theirBusiness = sql(`select id from businesses where owner_id = '${them.id}'`)[0].id
await page.goto(`${BASE}/app/admin/users/${them.id}`)
await page.waitForSelector('[data-figures]')
await page.getByRole('button', { name: 'Remove account' }).click()
const dialog = page.getByRole('dialog')
expect(await dialog.getByTestId('remove-block').getAttribute('data-state') === 'checked', 'Remove offers to block the address too, ticked')
await page.getByTestId('confirm-remove').click()
await page.waitForURL(u => new URL(u).pathname === '/app/admin/users')
const gone = sql(`select (select count(*) from "user" where id = '${them.id}') as users, (select count(*) from businesses where id = '${theirBusiness}') as businesses,
  (select count(*) from campaigns where business_id = '${theirBusiness}') as campaigns, (select count(*) from blocked_emails where email = '${otherEmail}') as blocked`)[0]
expect(gone.users === 0 && gone.businesses === 0 && gone.campaigns === 0 && gone.blocked === 1, 'Remove deletes the account, its business and Highreels, and blocks the address', gone)
expect(await recapStatus() === 404, 'its Highreel is gone')
await page.goto(`${BASE}/app/admin/users?kind=blocked`)
await page.locator(`[data-row="${otherEmail}"] [data-col="account"]`, { hasText: 'removed' }).waitFor()
expect(true, 'the Blocked list shows the address with its account removed')
sql(`delete from blocked_emails where email = '${otherEmail}'`)

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
