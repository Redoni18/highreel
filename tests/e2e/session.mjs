// A session that outlives its user (deleted account, cleaned-up demo session,
// local `supabase db reset`): Save and reload go to sign-in, not raw errors.
import { BASE, demoSession, env, expect, finish, launch, tab, watchErrors } from './lib.mjs'

const admin = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` }
async function deleteNewestUser() {
  const { users } = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?per_page=200`, { headers: admin }).then(r => r.json())
  const newest = users.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
  await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${newest.id}`, { method: 'DELETE', headers: admin })
}

const browser = await launch()
const errors = []
for (const mode of ['save', 'reload']) {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
  // 401s from our API and 403s from Supabase Auth about the deleted user are the point of this test
  watchErrors(page, errors, /status of 40[13]/)
  await demoSession(page)
  await page.getByRole('button', { name: 'Use sample data' }).click()
  await page.waitForSelector('[data-row-id]')
  await deleteNewestUser()
  if (mode === 'save') {
    await tab(page, 'Design')
    await page.locator('#d-copy-cover').fill('{first_name}, your year')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
  }
  else {
    await page.goto(`${BASE}/app`)
  }
  await page.waitForURL('**/login**', { timeout: 10000 })
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  expect(!body.includes('foreign key') && !body.includes('Campaign not found'), `${mode} with a deleted user → sign-in page, no raw error`)
  if (mode === 'reload')
    expect(body.includes('Your session ended'), 'sign-in page explains why')
  await page.getByRole('button', { name: /Try it without an account/ }).click()
  await page.waitForURL('**/app**', { timeout: 10000 })
  expect(true, `${mode}: a new demo session works`)
}
await browser.close()
finish(errors)
