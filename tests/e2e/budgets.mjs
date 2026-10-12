// Recap budgets (SPEC M2.5 P1) and the landing's first paint (M2.11),
// measured on a production build, not the dev server (dev serves unbundled
// modules and doesn't prerender):
//   - /r JavaScript ≤ 150 KB gzipped
//   - first slide visible < 1.5 s on 4G (Slow 4G + 4× CPU, like Lighthouse mobile)
//   - 60 fps while scenes play on a mid Android (4× CPU throttle), for the
//     app template's scenes, a "Your own sheet" recap's (M2.7: hearts,
//     the calendar page, badges, a top %), and two own-sheet recaps that
//     use every scene of the M2.10 library between them
//
//   corepack pnpm build
//   PORT=3047 node --env-file=.env .output/server/index.mjs
//   E2E_BASE=http://localhost:3047 node tests/e2e/budgets.mjs
//
// Not part of `corepack pnpm e2e` (that runs against the dev server).
import { gzipSync } from 'node:zlib'
import { BASE, campaignId, demoSession, expect, finish, launch, publish, tokenFor } from './lib.mjs'

const browser = await launch()

// The landing (SPEC M2.11): prerendered and served compressed, its CSS
// inline, its fonts preloaded, and no script before its largest paint; the
// app still starts. Lighthouse is the full check (SPEC §7.6).
{
  const res = await fetch(BASE, { headers: { 'accept-encoding': 'br, gzip' } })
  const html = await res.text()
  expect(res.headers.get('content-encoding') === 'br', 'the landing is served brotli-compressed', res.headers.get('content-encoding'))
  expect(!/<link rel="(stylesheet|modulepreload)"/.test(html) && !/<script type="module" src=/.test(html) && (html.match(/<link rel="preload" as="font"/g) ?? []).length === 2,
    'the landing inlines its CSS, preloads its two fonts and has no script tags that load before the first paint')
  // The terms and privacy pages get the same treatment (M2.12): Outfit is their only font.
  for (const path of ['/terms', '/privacy']) {
    const r = await fetch(`${BASE}${path}`, { headers: { 'accept-encoding': 'br, gzip' } })
    const h = await r.text()
    expect(r.headers.get('content-encoding') === 'br' && !/<link rel="(stylesheet|modulepreload)"/.test(h) && !/<script type="module" src=/.test(h) && (h.match(/<link rel="preload" as="font"/g) ?? []).length === 1,
      `${path} is prerendered the same way: compressed, CSS inline, Outfit preloaded, no early scripts`)
  }
  const ctx = await browser.newContext({ viewport: { width: 412, height: 823 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const t = await page.evaluate(() => new Promise(resolve => new PerformanceObserver((list) => {
    const js = performance.getEntriesByType('resource').filter(r => /\/_nuxt\/.*\.js$/.test(r.name)).map(r => r.startTime)
    resolve({ lcp: Math.round(list.getEntries().at(-1).startTime), js: Math.round(Math.min(...js)), app: !!document.querySelector('#__nuxt').__vue_app__ })
  }).observe({ type: 'largest-contentful-paint', buffered: true })))
  expect(t.js > t.lcp && t.app, 'the landing\'s scripts start after its largest paint, and the app starts', t)
  await ctx.close()
}

const setup = await (await browser.newContext()).newPage()
await demoSession(setup)
await setup.getByRole('button', { name: 'Use sample data' }).click()
await setup.waitForSelector('[data-row-id]')
await publish(setup)
// A row with every app scene: days, streak, count, word, rank, note.
const token = await tokenFor(setup, 'r => r.token && r.data.computed_top_percent <= 12 && r.data.personal_note')
const url = `${BASE}/r/${token}`

// A "Your own sheet" recap from the Keepsake sample, gifts counted in hearts (M2.7).
const own = await setup.evaluate(async () => (await (await fetch('/api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Own', year: 2026, starter: 'own-sheet' }) })).json()).id)
await setup.goto(`${BASE}/app/c/${own}`)
await setup.getByRole('button', { name: 'Use sample data' }).click()
await setup.getByRole('button', { name: /Import 150 rows/ }).click()
await setup.waitForSelector('[data-row-id]')
await setup.evaluate(async (id) => {
  const { campaign } = await (await fetch(`/api/campaigns/${id}`)).json()
  const slides = campaign.settings.slides.map(s => (s.key === 'c_gifts_made' ? { ...s, tokens: 'hearts' } : s))
  slides.push({ key: 'top_gifts_made', column: 'gifts_made', show: 'top' })
  await fetch(`/api/campaigns/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings: { slides } }) })
}, campaignId(setup))
await setup.reload()
await setup.waitForSelector('[data-row-id]')
await publish(setup)
const ownToken = await tokenFor(setup, 'r => r.token && r.data["computed_top:gifts_made"] <= 25 && r.data.first_gift && r.data.maker_badge')
const ownUrl = `${BASE}/r/${ownToken}`

// Two more own-sheet recaps: every M2.10 scene once between them.
async function libraryRecap(name, scenes, lists) {
  const id = await setup.evaluate(async n => (await (await fetch('/api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, year: 2026, starter: 'own-sheet' }) })).json()).id, name)
  await setup.goto(`${BASE}/app/c/${id}`)
  await setup.getByRole('button', { name: 'Use sample data' }).click()
  await setup.getByRole('button', { name: /Import 150 rows/ }).click()
  await setup.waitForSelector('[data-row-id]')
  await setup.evaluate(async ([c, sc, ls]) => {
    const { campaign } = await (await fetch(`/api/campaigns/${c}`)).json()
    const slides = campaign.settings.slides.map(s => (sc[s.column] ? { ...s, scene: sc[s.column] } : s))
    slides.push({ key: 'top_gifts_made', column: 'gifts_made', show: 'top', scene: sc.top })
    ls.forEach((scene, i) => slides.push({ key: `list_${i + 1}`, show: 'list', columns: ['favorite_occasion', 'favorite_style', 'first_gift'], scene }))
    await fetch(`/api/campaigns/${c}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings: { slides } }) })
  }, [id, scenes, lists])
  await setup.reload()
  await setup.waitForSelector('[data-row-id]')
  await publish(setup)
  return `${BASE}/r/${await tokenFor(setup, 'r => r.token && r.data["computed_top:gifts_made"] <= 25 && r.data.first_gift && r.data.maker_badge && r.data.favorite_occasion')}`
}
const libA = await libraryRecap('Library A', { gifts_made: 'tally', people_gifted: 'fill', photos_added: 'slots', times_opened: 'bignumber', favorite_occasion: 'sticker', favorite_style: 'typewriter', first_gift: 'postmark', maker_badge: 'flap', top: 'podium' }, ['receipt'])
const libB = await libraryRecap('Library B', { gifts_made: 'bubbles', people_gifted: 'gauge', photos_added: 'climb', favorite_occasion: 'neon', favorite_style: 'scatter', maker_badge: 'spotlight', top: 'leaderboard' }, ['cards', 'checklist'])

// 1. JavaScript weight
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage()
  const scripts = []
  p.on('response', async (res) => {
    if (res.request().resourceType() === 'script')
      scripts.push(res.body().then(b => ({ url: res.url(), raw: b.length, gz: gzipSync(b, { level: 9 }).length })).catch(() => null))
  })
  await p.goto(url, { waitUntil: 'networkidle' })
  // Step through every slide so lazily loaded chunks count too.
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('ArrowRight')
    await p.waitForTimeout(250)
  }
  await p.waitForTimeout(500)
  const all = (await Promise.all(scripts)).filter(Boolean)
  const gz = all.reduce((s, x) => s + x.gz, 0)
  for (const s of all.sort((a, b) => b.gz - a.gz).slice(0, 6))
    console.log(`     ${(s.gz / 1024).toFixed(1).padStart(6)} KB gz  ${s.url.replace(BASE, '')}`)
  expect(gz <= 150 * 1024, '/r JavaScript ≤ 150 KB gzipped', `${(gz / 1024).toFixed(1)} KB in ${all.length} files`)
  await ctx.close()
}

// 2. First slide on 4G
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await p.goto(url, { waitUntil: 'load' })
  const t = await p.evaluate(() => new Promise((resolve) => {
    let lcp = 0
    new PerformanceObserver(l => l.getEntries().forEach((e) => { lcp = e.startTime })).observe({ type: 'largest-contentful-paint', buffered: true })
    setTimeout(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
      // The cover title is "visible" when its last word has finished rising.
      const words = [...document.querySelectorAll('.cover-title .wi')]
      const ends = words.flatMap(w => w.getAnimations().map(a => (a.startTime ?? 0) + Number(a.effect.getTiming().delay) + Number(a.effect.getTiming().duration)))
      resolve({ fcp, lcp, settled: ends.length ? Math.max(...ends) : fcp })
    }, 3000)
  }))
  console.log(`     FCP ${Math.round(t.fcp)} ms · LCP ${Math.round(t.lcp)} ms · last title word settled ${Math.round(t.settled)} ms`)
  expect(t.lcp > 0 && t.lcp < 1500, 'first slide visible < 1.5 s on Slow 4G + 4× CPU (LCP)', `${Math.round(t.lcp)} ms`)
  await ctx.close()
}

// 3. Frame rate per scene at 4× CPU
async function frameRates(target, label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await p.goto(target, { waitUntil: 'networkidle' })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const rows = []
  for (let i = 0; i < 16; i++) {
    const scene = await p.evaluate(() => [...document.querySelectorAll('.recap .slide')].at(-1)?.dataset.scene)
    const frames = await p.evaluate(() => new Promise((resolve) => {
      const out = []
      let last = performance.now()
      const start = last
      const step = (now) => {
        out.push(now - last)
        last = now
        if (now - start < 2500)
          requestAnimationFrame(step)
        else resolve(out.slice(1))
      }
      requestAnimationFrame(step)
    }))
    const sorted = [...frames].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const dropped = frames.filter(f => f > 25).length / frames.length
    rows.push({ scene, median, p95, dropped })
    console.log(`     ${String(scene).padEnd(11)} median ${median.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · ${(dropped * 100).toFixed(1)}% frames > 25 ms`)
    if (scene === 'share')
      break
    await p.keyboard.press('ArrowRight')
  }
  const worst = rows.reduce((a, b) => (b.dropped > a.dropped ? b : a))
  expect(rows.every(r => r.median < 17.5 && r.dropped < 0.05), `60 fps while ${label} scenes play at 4× CPU (median ≤ 17.5 ms, < 5% long frames)`, `worst: ${worst.scene} ${(worst.dropped * 100).toFixed(1)}%`)
  await ctx.close()
  return rows
}
await frameRates(url, 'the app recap\'s')
const ownRows = await frameRates(ownUrl, 'an own sheet\'s')
expect(['date', 'count', 'badge', 'rank'].every(sc => ownRows.some(r => r.scene === sc)), 'the own sheet\'s recap played the calendar page, hearts, a badge and a top %', ownRows.map(r => r.scene))
const libRows = [...await frameRates(libA, 'the library\'s first half of'), ...await frameRates(libB, 'the library\'s second half of')]
const library = ['tally', 'fill', 'slots', 'bignumber', 'bubbles', 'gauge', 'climb', 'sticker', 'typewriter', 'flap', 'neon', 'scatter', 'spotlight', 'postmark', 'podium', 'leaderboard', 'receipt', 'cards', 'checklist']
expect(library.every(sc => libRows.some(r => r.scene === sc)), 'every M2.10 scene was played and measured', library.filter(sc => !libRows.some(r => r.scene === sc)))

await browser.close()
finish()
