// Terms and privacy (SPEC M2.12): linked from the landing's footer and the
// sign-in page; each names HighReel and hello@highreel.app, says "highlight
// reel" rather than "recap", has its canonical
// link and a description, its contents list jumps to real sections, the two
// link to each other, nothing scrolls sideways on a phone, no third-party
// requests or errors.
import { BASE, expect, finish, launch, watchErrors } from './lib.mjs'

const SITE = 'https://highreel.app'
const browser = await launch()
const errors = []
const thirdParty = []
async function open(viewport) {
  const page = await (await browser.newContext({ viewport })).newPage()
  watchErrors(page, errors)
  page.on('request', (r) => {
    if (!r.url().startsWith(BASE) && !/^(data|blob):/.test(r.url()))
      thirdParty.push(r.url())
  })
  return page
}

// The landing's footer and the sign-in page link to both.
const page = await open({ width: 1280, height: 800 })
await page.goto(BASE, { waitUntil: 'networkidle' })
const foot = await page.locator('.foot a').evaluateAll(as => as.map(a => a.getAttribute('href')))
expect(['/terms', '/privacy', 'mailto:hello@highreel.app'].every(h => foot.includes(h)) && !(await page.locator('.foot').innerText()).includes('at launch'), 'the landing\'s footer links the terms, privacy and the contact address', foot)
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
  expect(text.includes('HighReel') && (await page.locator('main a[href="mailto:hello@highreel.app"]').count()) >= 2 && text.includes('Last updated'), `${path}: names HighReel, links hello@highreel.app, says when it was updated`)
  // The owner's words (2026-10-12): customers get a "highlight reel" here, and no "Made in Kosovo".
  const whole = (await page.locator('body').innerText()).toLowerCase()
  expect(!whole.includes('recap') && !whole.includes('made in kosovo') && whole.includes('highlight reel'), `${path}: says "highlight reel", never "recap", and no "Made in Kosovo"`)
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
const named = ['Supabase', 'Cloudflare', 'Whop', '06/L-082', 'Information and Privacy Agency', 'Article 28']
expect(named.every(t => privacy.includes(t)), 'privacy names the providers, the law, the authority and the processing terms', named.filter(t => !privacy.includes(t)))
expect(privacy.includes('Never an email address, phone number or customer ID') && privacy.includes('no recipient addresses'), 'privacy says what a recap never shows and what the send log never holds')
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

expect(!thirdParty.length, 'no third-party requests', thirdParty.slice(0, 3))
await browser.close()
finish(errors)
