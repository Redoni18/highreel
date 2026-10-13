// Fewer waits in the workspace (SPEC §7.7): a page load doesn't ask
// /api/session first (the HTML says who's signed in), pages seen earlier in
// the visit show their last answer at once while the server answers again
// (aria-busy until then), edits started meanwhile survive the fresh answer, a
// new Highreel opens without asking for itself again, and the next session in
// the same tab sees nothing cached from the last one.
import { BASE, demoSession, expect, finish, launch, watchErrors } from './lib.mjs'

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage()
const errors = []
watchErrors(page, errors)
const asked = []
page.on('request', (r) => {
  const { pathname } = new URL(r.url())
  if (pathname.startsWith('/api/'))
    asked.push(`${r.method()} ${pathname}`)
})
/** Hold the server's answers to these requests back for `ms` (a slow connection). */
const slow = (pattern, ms) => page.route(pattern, async (route) => {
  await new Promise(r => setTimeout(r, ms))
  await route.continue().catch(() => {})
})

await demoSession(page)
const name = `Speed ${Date.now()}`
await page.evaluate(n => fetch('/api/business', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n }) }), name)

// A page load asks for its data straight away.
asked.length = 0
await page.goto(`${BASE}/app`)
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
expect(!asked.includes('GET /api/session') && asked.includes('GET /api/home'), 'loading /app asks for its data, not /api/session first', asked)
const inPage = await page.evaluate(() => fetch('/app').then(r => r.text()).then(t => JSON.parse(t.match(/window\.__hrSession=(\{.*?\})<\/script>/)[1])))
expect(inPage.user?.isAnonymous === true && inPage.user.role === 'client' && inPage.ended === false, '/app\'s HTML says who\'s signed in', inPage)
const login = await page.evaluate(() => fetch('/login').then(r => r.headers.get('cache-control')))
expect(login === 'private, no-store', '/login (which carries it too) is never cached', login)

// Your brand, then back home: both at once, the server still answering.
await slow('**/api/business', 1500)
let t = Date.now()
await page.getByRole('link', { name: 'Your brand' }).click()
await page.waitForSelector('[aria-busy="true"] #br-name')
expect(Date.now() - t < 1000 && await page.inputValue('#br-name') === name, 'Your brand shows the business the home had, at once', `${Date.now() - t} ms`)
// Typing before the fresh answer arrives: the answer doesn't undo it.
await page.fill('#br-name', 'Typed meanwhile')
await page.waitForSelector('[aria-busy="false"] #br-name', { timeout: 5000 })
expect(await page.inputValue('#br-name') === 'Typed meanwhile', 'an edit started on the last answer survives the fresh one')
await page.unroute('**/api/business')
await page.getByRole('button', { name: 'Discard' }).click()

await slow('**/api/home?**', 1500)
t = Date.now()
await page.getByRole('link', { name: 'Your Highreels' }).click()
await page.waitForSelector('main[aria-busy="true"] [data-campaign]')
expect(Date.now() - t < 1000, 'back on the home: the last answer at once', `${Date.now() - t} ms`)
await page.waitForSelector('main[aria-busy="false"] [data-campaign]', { timeout: 5000 })
await page.unroute('**/api/home?**')

// A new Highreel: creating it is the only wait.
asked.length = 0
await page.getByRole('button', { name: 'New Highreel' }).first().click()
await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('text=Use sample data')
const again = asked.filter(a => /^GET \/api\/campaigns\/[\w-]+(?:\/recipients)?$/.test(a))
expect(asked.includes('POST /api/campaigns') && again.length === 0, 'a new Highreel opens with what creating it answered', asked)
expect((await page.locator('header').first().innerText()).includes(name), 'with its business')

// The next session in this tab starts with nothing cached.
await page.getByRole('link', { name: 'All Highreels' }).click()
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
await page.getByRole('button', { name: 'Account' }).click()
await page.getByRole('menuitem', { name: 'End demo session' }).click()
await page.getByRole('button', { name: 'End session' }).click()
await page.getByRole('heading', { name: 'Sign in' }).waitFor()
await page.evaluate((n) => {
  window.sawOld = false
  new MutationObserver(() => {
    if (document.body.innerText.includes(n))
      window.sawOld = true
  }).observe(document.body, { subtree: true, childList: true, characterData: true })
}, name)
await slow('**/api/home?**', 1000)
await page.getByRole('button', { name: /Try it without an account/ }).click()
await page.waitForURL('**/app/c/*', { timeout: 20000 })
await page.waitForSelector('text=Use sample data')
expect(!(await page.evaluate(() => window.sawOld)), 'a new demo never shows the last session\'s business')

await browser.close()
finish(errors)
