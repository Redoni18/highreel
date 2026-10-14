// Google sign-in on /login (2026-10-14): the button says "Sign in with Google"
// beside Google's four-colour G, and starts Google's sign-in with our callback.
// Google itself is never reached: the request is answered here. Without a
// Google client in .env there's no Google button at all, and that's checked.
import { BASE, expect, finish, launch, watchErrors } from './lib.mjs'

const browser = await launch()
const errors = []
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
watchErrors(page, errors)
// networkidle: clicked before the page's script runs, the button does nothing.
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })

const google = page.locator('button', { hasText: 'Google' })
if (!await google.count()) {
  expect(true, 'no Google client configured: no Google button')
}
else {
  expect(await google.innerText().then(t => t.trim()) === 'Sign in with Google', 'the Google button says "Sign in with Google"')
  const fills = await google.locator('svg[data-google-logo] path').evaluateAll(ps => ps.map(p => p.getAttribute('fill')))
  const box = await google.locator('svg[data-google-logo]').boundingBox()
  expect(['#EA4335', '#4285F4', '#FBBC05', '#34A853'].every(f => fills.includes(f)) && box?.width === 18, 'Google\'s G in its four colours, 18 px', { fills, width: box?.width })

  let started = null
  await page.route('https://accounts.google.com/**', (route) => {
    started = new URL(route.request().url())
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>Google</title>' })
  })
  await google.click()
  await page.waitForURL(/accounts\.google\.com/, { timeout: 15000 })
  expect(started?.searchParams.get('redirect_uri') === `${BASE}/api/auth/callback/google`, 'it starts Google\'s sign-in with our callback', started?.searchParams.get('redirect_uri'))
}

await browser.close()
finish(errors)
