// Landing (SPEC M2.5 P2, restyled after trysundrop.app): server-rendered
// headline and price, all five examples play on a shape in their business's
// colour (rendered once near the screen), the steps pop in as they scroll
// into view, the sticky Try the demo, self-hosted Outfit and Caveat subset,
// Open it full screen, no horizontal scroll at 390 px, the hero's opening
// burst, reduced motion, no
// third-party requests, link-preview image; search: canonical links,
// structured data, robots.txt, the sitemap, icons, noindex on private pages.
import { BASE, expect, finish, launch, watchErrors } from './lib.mjs'

// Mirrors app/data/examples.ts
const EXAMPLES = [
  { label: 'App', business: 'Habitly', accent: '#4F46E5' },
  { label: 'Newsletter', business: 'The Weekly Bite', accent: '#C8341B' },
  { label: 'Online shop', business: 'Bean & Leaf', accent: '#1F6F4A' },
  { label: 'Fitness studio', business: 'Forma Studio', accent: '#E2457A' },
  { label: 'Summer camp', business: 'Sunny Hill Camp', accent: '#F5C518' },
]

const html = await (await fetch(BASE)).text()
const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
expect(plain.includes('Give your customers their highlight reel.'), 'headline is in the server-rendered HTML')
expect(plain.includes('$99') && plain.includes('per campaign'), 'the $99 price is in the server-rendered HTML')
expect(!html.includes('aria-roledescription="story"') && !html.includes('v-sheet'), 'the phone\'s recap and the step pictures render near the screen, not in the server HTML')
// Named Highreel on 2026-10-12: the title and both wordmarks say so.
expect(html.includes('<title>Highreel · '), 'the page title names Highreel', html.match(/<title>[^<]*/)?.[0])
expect((html.match(/class="[^"]*\bwordmark\b[^"]*"[^>]*><span class="hr-word[^"]*"[^>]*>(?:<span class="hr-high"[^>]*>high<\/span>reel|<span class="hr-cap"[^>]*>H<\/span>ighreel)</g) ?? []).length === 2, 'both wordmarks read highreel (whichever logo LOGO picks: wordmark.mjs)')
// The page speaks to any business: example businesses only appear inside the phone.
const named = EXAMPLES.map(e => e.business).concat(['Farm', 'goat', 'barn']).filter(n => plain.toLowerCase().includes(n.toLowerCase()))
expect(!named.length, 'the page around the phone names no example business', named)
expect(EXAMPLES.every(e => plain.includes(e.label)), 'the switcher names five kinds of business')

// Search (SPEC M2.11): canonical and link previews name the public site; the
// structured data says what the page says; robots.txt, the sitemap, llms.txt and icons.
const SITE = 'https://highreel.app'
const attr = (re) => html.match(re)?.[1]
expect(attr(/<link rel="canonical" href="([^"]+)"/) === `${SITE}/` && attr(/<meta property="og:url" content="([^"]+)"/) === `${SITE}/`, 'canonical and og:url name the public site')
const desc = attr(/<meta name="description" content="([^"]+)"/) ?? ''
expect(desc.length >= 70 && desc.length <= 160, 'the description fits a search result (70–160 characters)', desc.length)
expect(!/<meta name="robots"[^>]*noindex/.test(html) && (html.match(/<h1\b/g) ?? []).length === 1, 'the landing is indexable and has one h1')
const ld = JSON.parse(attr(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) ?? '{}')
const graph = Object.fromEntries((ld['@graph'] ?? []).map(n => [n['@type'], n]))
const questions = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim())
expect(graph.Organization?.legalName === 'Redon Emini Tech' && graph.Organization.email === 'hello@highreel.app' && graph.WebSite && graph.FAQPage?.mainEntity.map(q => q.name).join('|') === questions.join('|'), 'structured data: the organisation (legal name, contact), the site and the questions as shown', questions)
expect(graph.SoftwareApplication?.offers.map(o => o.price).join(',') === '99,399,799' && graph.SoftwareApplication.offers.every(o => o.priceCurrency === 'USD'), 'structured data: the three prices', graph.SoftwareApplication?.offers)
const robots = await (await fetch(`${BASE}/robots.txt`)).text()
expect(/^Disallow: \/app$/m.test(robots) && !/^Disallow: \/(r\/?)?$/m.test(robots) && robots.includes(`Sitemap: ${SITE}/sitemap.xml`), 'robots.txt keeps search out of the workspace, not recaps, and names the sitemap', robots)
const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text()
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(SITE, ''))
const live = await Promise.all(listed.map(async u => (await fetch(`${BASE}${u}`)).status))
expect(listed[0] === '/' && listed.length === 8 && listed.includes('/terms') && listed.includes('/privacy') && live.every(st => st === 200), 'the sitemap lists the landing, the five examples, the terms and privacy, all live', listed)
// llms.txt (llmstxt.org): the page's own words for AI assistants, every page of the sitemap linked.
const llmsRes = await fetch(`${BASE}/llms.txt`)
const llms = await llmsRes.text()
const ledeHtml = html.match(/<p class="lede"[^>]*>([\s\S]*?)<\/p>/)?.[1]?.trim()
expect(llmsRes.status === 200 && llmsRes.headers.get('content-type')?.startsWith('text/plain') && llms.startsWith('# Highreel\n') && llms.includes(`> ${desc}`) && !!ledeHtml && llms.includes(ledeHtml), 'llms.txt: Markdown that opens with the page\'s description and lede', llmsRes.status)
expect(questions.every(q => llms.includes(`### ${q}`)) && ['$99', '$399', '$799'].every(p => llms.includes(p)) && listed.every(u => llms.includes(`(${SITE}${u})`)), 'llms.txt: the page\'s questions and prices, and every page in the sitemap', listed.filter(u => !llms.includes(`(${SITE}${u})`)))
const icons = await Promise.all([['/favicon.ico', 'image/vnd.microsoft.icon'], ['/icon.svg', 'image/svg+xml'], ['/apple-touch-icon.png', 'image/png'], ['/icon-512.png', 'image/png']]
  .map(async ([u, type]) => { const r = await fetch(`${BASE}${u}`); return r.status === 200 && r.headers.get('content-type') === type }))
const manifest = await (await fetch(`${BASE}/site.webmanifest`)).json()
expect(icons.every(Boolean) && html.includes('rel="icon" href="/icon.svg"') && html.includes('rel="apple-touch-icon"') && manifest.name === 'Highreel' && manifest.icons.length === 3, 'favicon, SVG icon, touch icon and web manifest', icons)
const noindex = await Promise.all(['/login', '/app', '/r/nope'].map(async u => (await fetch(`${BASE}${u}`, { redirect: 'manual' })).headers.get('x-robots-tag')))
expect(noindex.every(h => h === 'noindex'), 'sign-in, the workspace and recaps tell search engines not to index them', noindex)
const exampleHtml = await (await fetch(`${BASE}/example/camp`)).text()
expect(exampleHtml.includes(`<link rel="canonical" href="${SITE}/example/camp">`) && exampleHtml.includes('>← highreel<'), 'an example has its canonical link and the Highreel wordmark')

const browser = await launch()
const errors = []
const thirdParty = []
async function newPage(opts) {
  const page = await (await browser.newContext(opts)).newPage()
  // the unknown-example check below expects a 404
  watchErrors(page, errors, /status of 404/)
  page.on('request', (r) => {
    const u = r.url()
    // Sign-in's bot check (Turnstile, SPEC M2.14 P3) is the one allowed, and only on /login.
    const turnstile = u.startsWith('https://challenges.cloudflare.com/') && new URL(page.url()).pathname === '/login'
    if (!u.startsWith(BASE) && !/^(data|blob):/.test(u) && !turnstile)
      thirdParty.push(u)
  })
  return page
}

// The inbox bubbles show their whole line (Highreel made the first one longer: 2026-10-12).
const cutMail = p => p.evaluate(async () => {
  await document.fonts.ready
  return [...document.querySelectorAll('.hero .mail')].filter(el => getComputedStyle(el).display !== 'none').map(el => el.querySelector('.mail-text')).filter(t => t.scrollWidth > t.clientWidth).map(t => t.textContent)
})

// Desktop
const page = await newPage({ viewport: { width: 1280, height: 800 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
expect((await page.locator('h1.headline').innerText()).replace(/\s+/g, ' ') === 'Give your customers their highlight reel.', 'the headline reads right')
// Owner's ask (2026-10-12): the hero says what a Highreel is (a highlight reel);
// after it the page calls them Highreels, so the brand becomes the word for them.
// Since 2026-10-14 the headline says it, and the lede only names one, once.
const lede = (await page.locator('.hero .lede').innerText()).replace(/\s+/g, ' ')
const rest = await page.evaluate(() => [...document.querySelectorAll('.landing > :not(.hero)')].map(e => e.textContent).join(' ').replace(/\s+/g, ' '))
expect(lede.startsWith('Spotify Wrapped, for your business') && /\ba Highreel of their year\b/.test(lede) && !lede.includes('highlight reel') && !rest.includes('highlight reel') && (rest.match(/\bHighreels?\b/g) ?? []).length >= 8, 'the headline explains a Highreel, then the page says Highreel', { lede, highreels: rest.match(/\bHighreels?\b/g)?.length })
expect((await page.locator('.closing-title').innerText()).replace(/\s+/g, ' ') === 'Your customers had a great year. Show them.', 'the closing heading')
const fonts = await page.evaluate(async () => {
  await document.fonts.ready
  return document.fonts.check('600 40px Outfit') && document.fonts.check('400 24px "Recap Notes"')
})
expect(fonts, 'Outfit and the Caveat subset load (self-hosted)')
const cutDesk = await cutMail(page)
expect(!cutDesk.length, 'no inbox bubble cuts its line short', cutDesk)
expect(!(await page.locator('.sticky-cta').isVisible()), 'no sticky button while the hero\'s is on screen')
// The hero moves on its own: blobs morph (SMIL), lines draw, pieces float; it all stops off screen.
const hero = await page.evaluate(() => ({
  blobs: document.querySelectorAll('.hero svg.blob animate[attributeName="d"]').length,
  paused: [...document.querySelectorAll('.hero svg.blob')].some(s => s.animationsPaused()),
  lines: document.querySelectorAll('.hero .doodle path').length,
  flowers: document.querySelectorAll('.hero .bits > svg use').length,
}))
expect(hero.blobs >= 4 && !hero.paused && hero.lines >= 3 && hero.flowers === 0, 'the hero has morphing blobs and drawn lines, no flower shapes', hero)
// The example sits in an iPhone: island and status bar over a recap that fills the screen.
await page.evaluate(() => document.querySelector('#examples').scrollIntoView({ block: 'start', behavior: 'instant' }))
await page.waitForSelector('#examples .phone .recap')
await page.waitForTimeout(600)
const frame = await page.evaluate(() => {
  const glass = document.querySelector('#examples .phone .glass').getBoundingClientRect()
  const recap = document.querySelector('#examples .phone .recap').getBoundingClientRect()
  return {
    island: !!document.querySelector('#examples .phone .island'),
    fills: Math.abs(glass.width - recap.width) < 1 && Math.abs(glass.height - recap.height) < 1,
    morphPaused: [...document.querySelectorAll('.hero svg.blob')].every(s => s.animationsPaused()),
  }
})
expect(frame.island && frame.fills, 'the example recap fills an iPhone screen under its Dynamic Island', frame)
expect(frame.morphPaused, 'the hero\'s blobs stop morphing off screen')
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
const phone = page.locator('#examples .phone .recap')
for (const ex of EXAMPLES) {
  await page.locator('.switcher button', { hasText: ex.label }).click()
  await page.waitForTimeout(800) // the shape swap
  const label = await phone.getAttribute('aria-label')
  await phone.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }))
  const box = await phone.boundingBox()
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2)
  await page.waitForTimeout(150)
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2)
  await page.waitForTimeout(150)
  const progress = await page.locator('#examples .phone .sr-only[aria-live]').innerText()
  const scene = await page.locator('#examples .phone .slide').last().getAttribute('data-scene')
  const shape = await page.evaluate(() => {
    const on = document.querySelectorAll('#examples .stage-shape.on')
    return { count: on.length, color: on[0] && getComputedStyle(on[0]).color, opacity: on[0] && getComputedStyle(on[0]).opacity }
  })
  const hex = ex.accent.toLowerCase()
  const rgb = `rgb(${[1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
  expect(label.includes(ex.business) && progress.startsWith('Slide 3 of') && scene !== 'cover', `${ex.label} example plays (${ex.business}, ${progress}, ${scene})`)
  expect(shape.count === 1 && shape.color === rgb && shape.opacity === '1', `${ex.label}: the phone sits on ${ex.accent}`, shape)
}

// How it works: each step waits below the fold, then pops in with its picture.
expect(await page.locator('.step.gate').count() === 3, 'the steps wait below the fold')
for (const [i, name] of ['sheet', 'brand', 'share'].entries()) {
  await page.evaluate(i => document.querySelectorAll('.step')[i].scrollIntoView({ block: 'center' }), i)
  await page.waitForTimeout(1300)
  const step = await page.evaluate((i) => {
    const el = document.querySelectorAll('.step')[i]
    return { in: el.classList.contains('in'), window: getComputedStyle(el.querySelector('.window')).opacity, pictures: el.querySelectorAll('.v-sheet, .v-brand, .v-share').length }
  }, i)
  expect(step.in && step.window === '1' && step.pictures === 1, `step ${i + 1} (${name}) pops in with its picture`, step)
}
expect(await page.locator('.sticky-cta').isVisible(), 'the sticky Try the demo shows once the hero\'s button is gone')
expect(await page.locator('.qa').count() === 4, 'four questions under the price')
const tiers = (await page.locator('.tier').allInnerTexts()).map(t => t.replace(/\s+/g, ' '))
expect(tiers.length === 3 && tiers[0].includes('Up to 1,000 customers') && tiers[0].includes('$99') && tiers[0].includes('$199') && tiers[1].includes('$399') && tiers[2].includes('$799') && tiers.every(t => t.includes('for the whole campaign')),
  'three list sizes, each one price for the whole campaign', tiers)
// Pricing redone (2026-10-12): the founding card carries its sticker, and every card starts an account.
const tierLinks = await page.locator('.tier a').evaluateAll(as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]))
expect(tiers[0].includes('$100 off') && tierLinks.length === 3 && tierLinks.every(([t, h]) => t === 'Get started' && h === '/login?start=1'), 'the founding card says $100 off, and each card has Get started', tierLinks)
const cardTops = await page.locator('.tier').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().height)))
expect(new Set(cardTops).size === 1, 'the price cards are the same height side by side', cardTops)
// The step pictures use the same phone as the example.
expect(await page.locator('.v-brand .iphone').count() === 1 && await page.locator('.v-share .iphone').count() === 3, 'the step pictures use the iPhone frame')
// Owner (2026-10-14): a colour flooding a phone covers its whole screen; the
// circle once fell short of the corners and left the last colour showing.
const floods = await page.evaluate(() => [...document.querySelectorAll('.v-brand .flood, .v-share .flood')].map((el) => {
  const s = getComputedStyle(el)
  const [x, y, r] = [Number.parseFloat(s.left), Number.parseFloat(s.top), el.offsetWidth / 2]
  const [w, h] = [el.offsetParent.clientWidth, el.offsetParent.clientHeight]
  return Math.round(Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([cx, cy]) => Math.hypot(cx - x, cy - y))) / r * 100) / 100
}))
expect(floods.length === 5 && floods.every(f => f < 1), 'every colour flood reaches the phone\'s far corner (distance / radius)', floods)
// ...and what customers receive is an email or a WhatsApp message from the
// business, not a notification from an app with its logo.
const channels = await page.evaluate(() => ({
  hero: [...document.querySelectorAll('.hero .mail-mark')].map(m => m.className.match(/via-\w+/)?.[0]),
  preview: !!document.querySelector('.hero .mail .mail-more'),
  steps: [...document.querySelectorAll('.v-share .note .app')].map(m => m.className.match(/via-\w+/)?.[0]),
}))
expect(channels.hero.join() === 'via-mail,via-chat' && channels.preview && channels.steps.join() === 'via-mail,via-chat,via-mail', 'the hero and step 3 show an email and a WhatsApp message', channels)
await page.locator('.closing .btn').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
expect(!(await page.locator('.sticky-cta').isVisible()), 'the sticky button hides at the closing one')
const og = await page.locator('meta[property="og:image"]').getAttribute('content')
const ogRes = await fetch(`${BASE}/og.png`)
expect(og === `${SITE}/og.png?v=3` && ogRes.status === 200 && ogRes.headers.get('content-type') === 'image/png', 'the landing has a link-preview image', og)

// See an example
await page.evaluate(() => window.scrollTo(0, 0))
await page.locator('.switcher button', { hasText: 'Summer camp' }).click()
await page.getByRole('link', { name: 'Open it full screen' }).click()
await page.waitForURL('**/example/camp')
await page.waitForSelector('.recap')
expect((await page.locator('.recap').getAttribute('aria-label')).includes('Sunny Hill Camp'), 'Open it full screen opens the camp recap')
const missing = await page.goto(`${BASE}/example/nope`)
expect(missing.status() === 404, 'unknown examples are 404s', missing.status())

// Phone
const m = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await m.goto(BASE, { waitUntil: 'networkidle' })
const widths = await m.evaluate(async () => {
  const out = []
  for (const y of [0, 900, 2000, 3500, 5000, document.body.scrollHeight]) {
    window.scrollTo(0, y)
    await new Promise(r => setTimeout(r, 120))
    out.push(document.documentElement.scrollWidth)
  }
  return out
})
expect(widths.every(w => w <= 390), 'no horizontal scroll at 390 px', widths)
const pieces = await m.evaluate(() => [...document.querySelectorAll('.hero .bit')].filter(el => getComputedStyle(el).display !== 'none').length)
expect(pieces > 0 && pieces < 12, 'phones get fewer pieces around the hero', pieces)
const cutPhone = await cutMail(m)
expect(!cutPhone.length, 'no inbox bubble cuts its line short on a phone', cutPhone)
expect(await m.locator('.step .window').nth(2).isVisible(), 'phones get every step with its picture')

// The opening burst (2026-10-12): the hero's pieces start deep behind the
// screen, so small and near the middle, and fly out to where they rest.
const bp = await newPage({ viewport: { width: 1280, height: 800 } })
await bp.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
  const hold = document.createElement('style')
  hold.textContent = '.burst { animation-play-state: paused !important }'
  document.head.append(hold)
}))
await bp.goto(BASE, { waitUntil: 'networkidle' })
const flight = await bp.evaluate(() => {
  const box = document.querySelector('.hero .bits').getBoundingClientRect()
  const cx = box.left + box.width / 2
  const cy = box.top + box.height / 2
  const bits = [...document.querySelectorAll('.hero .bit')].filter(el => getComputedStyle(el).display !== 'none')
  const anims = bits.map(el => el.getAnimations().find(a => a.animationName?.startsWith('burst')))
  const at = (end) => {
    for (const a of anims.filter(Boolean)) {
      a.pause()
      a.currentTime = end ? a.effect.getComputedTiming().endTime - 1 : a.effect.getTiming().delay
    }
    return bits.map((el) => {
      const r = el.getBoundingClientRect()
      return { d: Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy), w: r.width }
    })
  }
  const start = at(false)
  const end = at(true)
  const round = n => Math.round(n * 100) / 100
  return { n: bits.length, animated: anims.filter(Boolean).length, out: start.map((s, i) => round(s.d / end[i].d)), size: start.map((s, i) => round(s.w / end[i].w)) }
})
expect(flight.n > 10 && flight.animated === flight.n && flight.out.every(r => r < 0.3) && flight.size.every(s => s < 0.4), 'the hero\'s pieces burst out of the middle: small near the centre at first, then out to their spots', flight)

// Reduced motion: still headline, still pictures.
const rm = await newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
await rm.goto(BASE, { waitUntil: 'networkidle' })
const running = await rm.evaluate(() => ({
  pieces: [...document.querySelectorAll('.pop, .rise, .burst')].reduce((n, el) => n + el.getAnimations().length, 0),
  vignettes: [...document.querySelectorAll('.v-sheet *, .v-brand *, .v-share *')].reduce((n, el) => n + el.getAnimations().length, 0),
  gated: document.querySelectorAll('.gate').length,
  closing: getComputedStyle(document.querySelector('.closing-title')).opacity,
  ambient: [...document.querySelectorAll('.hero .spin, .hero .doodle path, .hero .piece > span')].reduce((n, el) => n + el.getAnimations().length, 0),
  morphing: [...document.querySelectorAll('.hero svg.blob')].some(s => !s.animationsPaused()),
}))
expect(running.pieces === 0 && running.vignettes === 0 && running.ambient === 0 && !running.morphing && running.gated === 0 && running.closing === '1', 'reduced motion: nothing animates or waits on the page', running)
await rm.locator('.switcher button', { hasText: 'Shop' }).click()
await rm.waitForTimeout(60)
const swap = await rm.evaluate(() => getComputedStyle(document.querySelector('#examples .stage-shape.on')).opacity)
expect(swap === '1', 'reduced motion: switching examples swaps the shape at once', swap)

// Light or dark (2026-10-12): the header's button switches the page with a circle
// growing from it, the choice is the app's own Dark mode setting, and a reload
// paints dark straight away (the setting's script runs before the first paint).
const th = await newPage({ viewport: { width: 1280, height: 800 } })
await th.goto(BASE, { waitUntil: 'networkidle' })
const surface = () => th.evaluate(() => getComputedStyle(document.querySelector('.landing')).backgroundColor)
const before = { bg: await surface(), dark: await th.evaluate(() => document.documentElement.classList.contains('dark')) }
expect(before.bg === 'rgb(255, 255, 255)' && !before.dark, 'light by default', before)
await th.getByTestId('theme-toggle').click()
await th.waitForFunction(() => document.documentElement.classList.contains('dark'))
await th.waitForTimeout(900)
const after = await th.evaluate(() => ({ stored: localStorage.getItem('color-mode'), pressed: document.querySelector('[data-testid=theme-toggle]').getAttribute('aria-pressed'), ink: getComputedStyle(document.querySelector('.headline')).color, sun: getComputedStyle(document.querySelector('.theme-toggle .sun')).display }))
expect(await surface() === 'rgb(18, 18, 18)' && after.stored === 'dark' && after.pressed === 'true' && after.ink === 'rgb(242, 242, 242)' && after.sun === 'block', 'the toggle turns the page dark, shows the sun and keeps the choice', after)
// A visit with the choice stored and the app's scripts blocked (their failed loads aren't the page's errors).
const bare = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: { cookies: [], origins: [{ origin: new URL(BASE).origin, localStorage: [{ name: 'color-mode', value: 'dark' }] }] } })
const nojs = await bare.newPage()
await nojs.route('**/*', r => (r.request().resourceType() === 'script' ? r.abort() : r.continue()))
await nojs.goto(BASE)
const bareBg = await nojs.evaluate(() => getComputedStyle(document.querySelector('.landing')).backgroundColor)
expect(bareBg === 'rgb(18, 18, 18)', 'a stored dark choice paints dark from the HTML alone, before the app\'s scripts', bareBg)
await bare.close()
await th.goto(`${BASE}/login`)
const loginBg = await th.evaluate(() => getComputedStyle(document.body).backgroundColor)
expect(loginBg === 'rgb(20, 20, 20)', 'sign-in follows it (the app\'s dark colours)', loginBg)
// Scrollbars (2026-10-13): thin, a translucent thumb on no track, and the browser's
// own parts in the page's scheme (dark mode had white scrollbar tracks).
const bars = () => th.evaluate(() => {
  const html = getComputedStyle(document.documentElement)
  return { scheme: html.colorScheme, color: html.scrollbarColor, width: getComputedStyle(document.body).scrollbarWidth }
})
const darkBars = await bars()
expect(darkBars.scheme === 'dark' && darkBars.color === 'rgba(255, 255, 255, 0.2) rgba(0, 0, 0, 0)' && darkBars.width === 'thin', 'dark mode: dark browser parts, thin quiet scrollbars', darkBars)
await th.goto(BASE, { waitUntil: 'networkidle' })
await th.getByTestId('theme-toggle').click()
await th.waitForFunction(() => !document.documentElement.classList.contains('dark'))
await th.waitForTimeout(900)
expect(await surface() === 'rgb(255, 255, 255)' && await th.evaluate(() => localStorage.getItem('color-mode')) === 'light', 'and back to light')
const lightBars = await bars()
expect(lightBars.scheme === 'light' && lightBars.color === 'rgba(0, 0, 0, 0.2) rgba(0, 0, 0, 0)' && lightBars.width === 'thin', 'light mode: the same scrollbars in a dark grey', lightBars)
// The price cards' Get started opens the email form under its own heading.
await th.locator('.tier a').first().click()
await th.waitForURL('**/login?start=1')
await th.getByRole('heading', { level: 1, name: 'Get started' }).waitFor()
expect(await th.title() === 'Get started · Highreel' && await th.getByRole('button', { name: 'Email me a sign-in link' }).isVisible(), 'a price card\'s Get started opens the email form as "Get started"')

expect(thirdParty.length === 0, 'no third-party requests (Turnstile on /login aside)', thirdParty.slice(0, 3))
await browser.close()
finish(errors)
