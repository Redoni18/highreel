// The scheduled jobs (SPEC M2.14 P4): a demo started 35 days ago goes with its
// business, published Highreel and files; one started 29 days ago stays; an
// account the owner was asked to delete goes, and its request is marked done;
// expired sign-in records go while a live session keeps working.
//
// On the dev server the jobs run through Nitro's task endpoint
// (POST /_nitro/tasks/:name). On the built Worker they run from its Cron
// Triggers, the way Cloudflare fires them:
//   corepack pnpm exec wrangler dev --port 3047 --inspector-port 9339 --test-scheduled
//   E2E_BASE=http://localhost:3047 node tests/e2e/cleanup.mjs
import { BASE, demoSession, expect, finish, FIX, launch, needFixtures, publish, sql, tokenFor, watchErrors } from './lib.mjs'

needFixtures()
// The expressions in server/schedule.ts (tests/cloudflare.test.ts holds them to wrangler.jsonc).
const CRON = { 'cleanup:auth': '0 * * * *', 'cleanup:demo': '0 3 * * *', 'accounts:delete': '0 3 * * *' }
const onDev = (await fetch(`${BASE}/_nitro/tasks`)).ok

/** Run a job now; on the Worker, by firing its Cron Trigger (which also runs the other tasks of that expression). */
async function run(name) {
  if (onDev) {
    const res = await fetch(`${BASE}/_nitro/tasks/${name}`, { method: 'POST' })
    return (await res.json()).result
  }
  const res = await fetch(`${BASE}/__scheduled?cron=${encodeURIComponent(CRON[name])}`)
  if (!res.ok)
    throw new Error(`/__scheduled answered ${res.status}: start wrangler dev with --test-scheduled`)
  return null
}
/** The Worker runs a trigger's tasks in the background: wait until `done` holds. */
async function until(done) {
  for (let i = 0; i < 40 && !done(); i++)
    await new Promise(r => setTimeout(r, 250))
}

const browser = await launch()
const errors = []
const daysAgo = n => new Date(Date.now() - n * 86_400_000).toISOString()

/** A demo session with a logo on Your brand: its first draft, user, business and signed logo link. */
async function demoWithLogo() {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  watchErrors(page, errors)
  await demoSession(page)
  const draft = page.url()
  await page.goto(`${BASE}/app/brand`)
  await page.locator('[data-testid="logo-input"]').setInputFiles(`${FIX}/logo.png`)
  await page.locator('img[src^="/media/"]').first().waitFor()
  const { user } = await page.evaluate(() => fetch('/api/session').then(r => r.json()))
  const { business } = await page.evaluate(() => fetch('/api/business').then(r => r.json()))
  return { page, draft, user: user.id, business: business.id, logo: `${BASE}${business.logo_url}` }
}
const status = url => fetch(url).then(r => r.status)
const sessionOf = page => page.evaluate(() => fetch('/api/session').then(r => r.json()))
const left = business => ({
  businesses: sql(`select count(*) as n from businesses where id = '${business}'`)[0].n,
  campaigns: sql(`select count(*) as n from campaigns where business_id = '${business}'`)[0].n,
})

if (!onDev)
  expect((await fetch(`${BASE}/_nitro/tasks/cleanup:demo`, { method: 'POST' })).status === 404, 'the Worker has no task endpoint (jobs run from its Cron Triggers only)')

// A demo past its 30 days, with a published Highreel; one a day short of them.
const old = await demoWithLogo()
await old.page.goto(old.draft)
await old.page.getByRole('button', { name: 'Use sample data' }).click()
await old.page.waitForSelector('[data-row-id]')
await publish(old.page)
const token = await tokenFor(old.page)
expect((await status(`${BASE}/r/${token}`)) === 200 && (await status(old.logo)) === 200, 'before: the old demo\'s Highreel and logo open')
const recent = await demoWithLogo()
sql(`update "user" set "createdAt" = '${daysAgo(35)}' where id = '${old.user}'`)
sql(`update "user" set "createdAt" = '${daysAgo(29)}' where id = '${recent.user}'`)

// An account (a demo given an address behind the app's back) whose deletion the owner was asked for.
const account = await demoWithLogo()
const email = `delete-me-${Date.now()}@example.com`
const nobody = `nobody-${Date.now()}@example.com`
sql(`update "user" set "isAnonymous" = 0, email = '${email}' where id = '${account.user}'`)
sql(`insert into account_deletions (email) values ('${email.toUpperCase()}'), ('${nobody}')`)

const demoResult = await run('cleanup:demo')
const accountResult = onDev ? await run('accounts:delete') : null
await until(() => sql(`select count(*) as n from "user" where id in ('${old.user}', '${account.user}')`)[0].n === 0)
if (onDev) {
  expect(demoResult.deleted >= 1 && demoResult.failed === 0, 'cleanup:demo answers with counts', demoResult)
  expect(accountResult.deleted === 1 && accountResult.noAccount === 1 && accountResult.failed === 0, 'accounts:delete answers with counts', accountResult)
}

// The old demo: user, sessions, business, Highreels and files.
expect(sql(`select count(*) as n from "user" where id = '${old.user}'`)[0].n === 0, 'the 35-day-old demo\'s user is gone')
expect(sql(`select count(*) as n from session where "userId" = '${old.user}'`)[0].n === 0, '… its sessions too')
expect(JSON.stringify(left(old.business)) === '{"businesses":0,"campaigns":0}', '… its business and Highreels too', left(old.business))
expect(await status(old.logo) === 404, '… its logo (the link still verifies; the file is gone)')
expect(await status(`${BASE}/r/${token}`) === 404 && await status(`${BASE}/api/r/${token}`) === 404, '… and its shared Highreel no longer opens')
const oldSession = await sessionOf(old.page)
expect(oldSession.user === null && oldSession.ended === true, 'its browser is told the session ended', oldSession)

// The 29-day-old demo is untouched.
expect(sql(`select count(*) as n from "user" where id = '${recent.user}'`)[0].n === 1 && left(recent.business).campaigns === 1, 'the 29-day-old demo stays')
expect(await status(recent.logo) === 200 && (await sessionOf(recent.page)).user?.id === recent.user, '… with its logo and session')

// The account: gone, and the requests marked.
expect(sql(`select count(*) as n from "user" where id = '${account.user}'`)[0].n === 0 && left(account.business).businesses === 0, 'the account at the requested address is gone, with its business')
expect(await status(account.logo) === 404, '… and its files')
const requests = sql(`select email, result, done_at from account_deletions where email in ('${email.toUpperCase()}', '${nobody}') order by id`)
expect(requests.map(r => r.result).join() === 'deleted,no account' && requests.every(r => r.done_at), 'requests are marked done ("no account" for an address without one)', requests)

// Sign-in records: an ended session, a used-up link and an idle rate-limit count go; the live session stays.
const stamp = Date.now()
sql(`insert into session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") values ('e2e-ended-${stamp}', '${daysAgo(1)}', 'e2e-ended-${stamp}', '${daysAgo(31)}', '${daysAgo(2)}', '${recent.user}')`)
sql(`insert into verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") values ('e2e-link-${stamp}', 'magic-link:e2e-${stamp}', '{}', '${daysAgo(0.01)}', '${daysAgo(0.1)}', '${daysAgo(0.1)}')`)
sql(`insert into "rateLimit" (id, key, count, "lastRequest") values ('e2e-rl-${stamp}', 'e2e-rl-${stamp}', 1, ${stamp - 2 * 3600_000})`)
const authResult = await run('cleanup:auth')
const records = () => sql(`select (select count(*) from session where id = 'e2e-ended-${stamp}') + (select count(*) from verification where id = 'e2e-link-${stamp}') + (select count(*) from "rateLimit" where id = 'e2e-rl-${stamp}') as n`)[0].n
await until(() => records() === 0)
expect(records() === 0, 'cleanup:auth: the ended session, the expired link and the idle count are gone', authResult)
expect((await sessionOf(recent.page)).user?.id === recent.user, '… and a live session still works')

sql(`delete from account_deletions where email in ('${email.toUpperCase()}', '${nobody}')`)
await browser.close()
finish(errors)
