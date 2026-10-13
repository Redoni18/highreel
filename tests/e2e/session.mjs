// A session that outlives its user (a deleted account, a cleaned-up demo) or
// runs out (SPEC M2.14 P3): Save and reload go to sign-in, which says why,
// not to raw errors; the user's business goes with them; signing in again
// works, by email link or a new demo.
import { BASE, demoSession, expect, finish, inApp, latestLink, launch, sql, tab, watchErrors } from './lib.mjs'

/** The user behind a page's session. */
const userOf = page => page.evaluate(() => fetch('/api/session').then(r => r.json()).then(s => s.user.id))

const browser = await launch()
const errors = []
for (const mode of ['save', 'reload', 'expired']) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  // 401s from our API about the ended session are the point of this test (and
  // the new account doesn't have the old Highreel that `next` points at: 404)
  watchErrors(page, errors, /status of 40[14]/)
  await demoSession(page)
  await page.getByRole('button', { name: 'Use sample data' }).click()
  await page.waitForSelector('[data-row-id]')
  const id = await userOf(page)
  if (mode === 'expired') {
    sql(`update session set "expiresAt" = '2000-01-01T00:00:00.000Z' where "userId" = '${id}'`)
  }
  else {
    sql(`delete from "user" where id = '${id}'`)
    expect(sql(`select count(*) as n from businesses where owner_id = '${id}'`)[0].n === 0, `${mode}: deleting the user deletes its business`)
  }
  if (mode === 'save') {
    await tab(page, 'Design')
    await page.locator('#d-copy-cover').fill('{first_name}, your year')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
  }
  else {
    await page.goto(`${BASE}/app`)
  }
  await page.waitForURL('**/login**', { timeout: 10000 })
  // A redirect inside the app changes the URL before the sign-in page has loaded.
  await page.getByRole('heading', { name: 'Sign in' }).waitFor()
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  expect(!body.includes('foreign key') && !body.includes('Campaign not found'), `${mode}: → sign-in page, no raw error`)
  expect(body.includes('Your session ended'), `${mode}: the sign-in page says the session ended`)
  if (mode === 'save')
    expect(new URL(page.url()).searchParams.get('next')?.startsWith('/app/c/'), 'save: signing in again comes back to the Highreel', page.url())
  if (mode === 'save') {
    // The browser still holds the dead session's cookie here (Better Auth 1.7.7
    // dropped the new session in that case; authRequest strips it).
    const email = `session-${Date.now()}@example.com`
    await page.getByLabel('Work email').fill(email)
    await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
    await page.waitForSelector('text=Check your email')
    await page.goto(await latestLink(email))
    await page.waitForURL(inApp, { timeout: 15000 })
    const now = await page.evaluate(() => fetch('/api/session').then(r => r.json()))
    expect(now.user?.email === email, 'save: an email link signs in, with the dead session\'s cookie still there', now.user?.email)
    continue
  }
  await page.getByRole('button', { name: /Try it without an account/ }).click()
  await page.waitForURL(inApp, { timeout: 10000 })
  expect(await userOf(page) !== id, `${mode}: a new demo session works`)
}

// Never signed in: /app goes to sign-in without "your session ended".
const fresh = await (await browser.newContext()).newPage()
await fresh.goto(`${BASE}/app/brand`)
await fresh.waitForURL('**/login**')
await fresh.getByRole('heading', { name: 'Sign in' }).waitFor()
expect(!(await fresh.locator('body').innerText()).includes('Your session ended') && new URL(fresh.url()).searchParams.get('next') === '/app/brand', 'never signed in: plain sign-in, back to the page afterwards', fresh.url())
await browser.close()
finish(errors)
