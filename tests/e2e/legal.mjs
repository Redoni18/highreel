// Terms and privacy (SPEC M2.12): linked from the landing's footer and the
// sign-in page; each names Redon Emini Tech (who runs Highreel) and hello@highreel.app, calls what customers get a
// "Highreel" (never "recap"), has its canonical
// link and a description, its contents list jumps to real sections, the two
// link to each other, nothing scrolls sideways on a phone, in-page jumps
// glide but page changes don't, no third-party requests or errors.
import { BASE, expect, finish, launch, watchErrors } from './lib.mjs'

const SITE = 'https://highreel.app'
const browser = await launch()
const errors = []
const thirdParty = []
async function open(viewport) {
  const page = await (await browser.newContext({ viewport })).newPage()
  watchErrors(page, errors)
  page.on('request', (r) => {
    // Sign-in's bot check (Turnstile, SPEC M2.14 P3) is the one allowed, and only on /login.
    const turnstile = r.url().startsWith('https://challenges.cloudflare.com/') && new URL(page.url()).pathname === '/login'
    if (!r.url().startsWith(BASE) && !/^(data|blob):/.test(r.url()) && !turnstile)
      thirdParty.push(r.url())
  })
  return page
}

// The landing's footer and the sign-in page link to both.
const page = await open({ width: 1280, height: 800 })
await page.goto(BASE, { waitUntil: 'networkidle' })
const foot = await page.locator('.foot a').evaluateAll(as => as.map(a => a.getAttribute('href')))
expect(['/terms', '/privacy', 'mailto:hello@highreel.app'].every(h => foot.includes(h)) && !(await page.locator('.foot').innerText()).includes('at launch'), 'the landing\'s footer links the terms, privacy and the contact address', foot)
expect((await page.locator('.foot').innerText()).includes('© 2026 Redon Emini Tech'), 'the landing\'s footer says © 2026 Redon Emini Tech')
// The header: the light/dark toggle and one Sign in button; the footer: the copyright on the left, the links on the right.
const navLinks = await page.locator('.nav a.pill').evaluateAll(as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]))
expect(JSON.stringify(navLinks) === JSON.stringify([['Sign in', '/app']]) && await page.locator('.nav [data-testid=theme-toggle]').count() === 1, 'the header has the light/dark toggle and Sign in', navLinks)
const footSides = await page.evaluate(() => {
  const mark = document.querySelector('.foot-mark').getBoundingClientRect()
  const links = document.querySelector('.foot-links').getBoundingClientRect()
  return { mark: Math.round(mark.left), links: Math.round(links.right), width: innerWidth }
})
expect(footSides.mark <= 48 && footSides.links >= footSides.width - 48, 'the footer: the copyright on the left, the links on the right', footSides)
await page.goto(`${BASE}/login`)
const note = page.getByTestId('legal-note')
expect(await note.getByRole('link', { name: 'terms' }).getAttribute('href') === '/terms' && await note.getByRole('link', { name: 'privacy policy' }).getAttribute('href') === '/privacy', 'sign-in says continuing means agreeing, with both links')

for (const [path, title] of [['/terms', 'Terms of service'], ['/privacy', 'Privacy policy']]) {
  const html = await (await fetch(`${BASE}${path}`)).text()
  const desc = html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? ''
  expect(html.includes(`<link rel="canonical" href="${SITE}${path}">`) && html.includes(`<title>${title} · Highreel</title>`) && desc.length >= 70 && desc.length <= 160, `${path}: title, canonical and a description that fits`, desc.length)
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  expect((await page.locator('h1').innerText()) === title && (await page.locator('h1').count()) === 1, `${path}: one h1, "${title}"`)
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  expect(text.includes('is run by Redon Emini Tech, a business registered in Kosovo') && (await page.locator('main a[href="mailto:hello@highreel.app"]').count()) >= 2 && text.includes('Last updated'), `${path}: says Redon Emini Tech, registered in Kosovo, runs Highreel, links hello@highreel.app, says when it was updated`)
  expect((await page.locator('.nav a.pill').allInnerTexts()).join() === 'Sign in' && await page.locator('.nav [data-testid=theme-toggle]').count() === 1 && (await page.locator('.foot-mark').innerText()).includes('© 2026 Redon Emini Tech'), `${path}: the toggle, Sign in, and © 2026 Redon Emini Tech on the left`)
  // The owner's words (2026-10-12): what customers get is a "Highreel", defined once as their
  // highlight reel; never "recap", and no "Made in Kosovo".
  const body = await page.locator('body').innerText()
  const whole = body.toLowerCase()
  expect(!whole.includes('recap') && !whole.includes('made in kosovo') && [1, 2].includes((whole.match(/highlight reel/g) ?? []).length) && (body.match(/\bHighreels\b/g) ?? []).length >= 3, `${path}: defines a Highreel (once, and again for people who got one) and then says Highreels, never "recap", and no "Made in Kosovo"`)
  const anchors = await page.evaluate(() => [...document.querySelectorAll('.toc a')].map(a => a.getAttribute('href').slice(1)).filter(id => !document.getElementById(id)))
  expect(!anchors.length && (await page.locator('.toc a').count()) >= 13, `${path}: every entry in "On this page" jumps to its section`, anchors)
}

// Facts the pages state, checked against the product.
await page.goto(`${BASE}/terms`)
const terms = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
expect(terms.includes('laws of the Republic of Kosovo') && terms.includes('Whop') && terms.includes('within 14 days of paying') && terms.includes('from your own account'), 'the terms cover the law, payments through Whop, refunds and sending from your own account')
await page.getByRole('main').getByRole('link', { name: 'privacy policy' }).first().click()
await page.waitForURL('**/privacy')
const privacy = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
const named = ['Cloudflare', 'Turnstile', 'Whop', '06/L-082', 'Information and Privacy Agency', 'Article 28']
expect(named.every(t => privacy.includes(t)), 'privacy names the providers, the law, the authority and the processing terms', named.filter(t => !privacy.includes(t)))
expect(privacy.includes('Never an email address, phone number or customer ID') && privacy.includes('no recipient addresses'), 'privacy says what a recap never shows and what the send log never holds')
expect(privacy.includes('count visits with Cloudflare Web Analytics, which sets no cookies') && privacy.includes('Highreels and unsubscribe pages don\'t load it') && privacy.includes('counting visits to our public pages (Web Analytics)'), 'privacy says the public pages count visits with Cloudflare Web Analytics, without cookies, and Highreels don\'t')
expect(privacy.includes('within 30 days. We keep a note of the request') && privacy.includes('we delete it, and everything in it, after 30 days'), 'privacy says when accounts and demos are deleted (the scheduled jobs, SPEC M2.14 P4), and what stays of a deletion request')
expect(privacy.includes('our admin pages show us each account\'s email address') && privacy.includes('They don\'t show your sheets, your customers\' names or contact details') && privacy.includes('count a business\'s rows, opens and shares, never what\'s in them'), 'privacy says what the admin pages show and what they never do (SPEC M2.15)')
await page.getByRole('main').getByRole('link', { name: 'terms', exact: true }).first().click()
await page.waitForURL('**/terms**')
expect(true, 'the two pages link to each other')

// Phones: nothing scrolls sideways.
const phone = await open({ width: 390, height: 844 })
for (const path of ['/terms', '/privacy']) {
  await phone.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
  const w = await phone.evaluate(() => document.documentElement.scrollWidth)
  expect(w <= 390, `${path}: no horizontal scroll at 390 px`, w)
}

// Smooth scrolling (2026-10-12): a contents link glides to its section; a page
// change still starts at the top at once; reduced motion and the app jump.
const sm = await open({ width: 1280, height: 800 })
await sm.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
const glide = await sm.evaluate(async () => {
  const link = [...document.querySelectorAll('.toc a')].at(-2)
  const target = document.querySelector(link.getAttribute('href'))
  const from = scrollY
  link.click()
  await new Promise(r => setTimeout(r, 90))
  const mid = scrollY
  await new Promise(r => setTimeout(r, 1500))
  return { css: getComputedStyle(document.documentElement).scrollBehavior, from, mid, end: scrollY, top: Math.round(target.getBoundingClientRect().top) }
})
expect(glide.css === 'smooth' && glide.mid > glide.from && glide.mid < glide.end && Math.abs(glide.top - 24) <= 4, 'a contents link glides to its section', glide)
await sm.goto(BASE, { waitUntil: 'networkidle' })
await sm.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
await sm.waitForTimeout(300)
await sm.locator('.foot a[href="/terms"]').click()
await sm.waitForURL('**/terms')
await sm.waitForSelector('.legal h1')
await sm.waitForTimeout(150)
expect(await sm.evaluate(() => scrollY) === 0, 'following the footer to the terms starts them at the top at once, no glide')
await sm.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
const appCss = await sm.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
const still = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })).newPage()
await still.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
const stillCss = await still.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)
expect(appCss === 'auto' && stillCss === 'auto', 'sign-in and the app scroll instantly, and so does everything with reduced motion', { signIn: appCss, reduced: stillCss })

expect(!thirdParty.length, 'no third-party requests (Turnstile on /login aside)', thirdParty.slice(0, 3))
await browser.close()
finish(errors)
