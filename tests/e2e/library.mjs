// The scene library (SPEC M2.10): every scene a slide's data allows renders in
// Design's phone, and its still end state (reduced motion) shows that
// person's value: numbers, words, top %, dates and lists. A published recap
// plays the new scenes it was given. No page errors on the way.
import { BASE, campaignId, demoSession, designItem, expect, finish, launch, publish, tab, tokenFor, watchErrors } from './lib.mjs'

const browser = await launch()
const errors = []
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage()
watchErrors(page, errors)
const slide = () => page.locator('aside[aria-label="Highlight reel preview"] .recap .slide').last()
const squash = s => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** Click each animation of a slide; return what the phone drew and whether `expected` reads in it. */
async function every(key, expected) {
  const insp = await designItem(page, key)
  const options = await insp.locator('[data-scene-option]').evaluateAll(els => els.map(e => e.dataset.sceneOption))
  const out = []
  for (const sc of options) {
    await insp.locator(`[data-scene-option="${sc}"]`).click()
    await page.waitForTimeout(350)
    const drawn = await slide().getAttribute('data-scene')
    // What reads: the text, and the labels of things drawn in pieces (rolling digits).
    const text = squash(await slide().evaluate(el => [el.innerText, ...[...el.querySelectorAll('[aria-label]')].map(x => x.getAttribute('aria-label'))].join(' ')))
    out.push({ sc, drawn, shows: expected.every(e => text.includes(e)) })
  }
  return out
}
const ok = rows => rows.every(r => r.sc === r.drawn && r.shows)
const bad = rows => rows.filter(r => r.sc !== r.drawn || !r.shows)

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await tab(page, 'Design')

const numbers = await every('active_days', ['148'])
expect(numbers.length === 10 && ok(numbers), 'a number has 10 animations, each drawing Emma\'s 148', bad(numbers))
const words = await every('top_feature', ['reading goal'])
expect(words.length === 8 && ok(words), 'a word has 8, each spelling her favourite out', bad(words))
// Everyone gets the top % slide when it shows to the top 100%.
await designItem(page, 'top_percent')
await page.locator('#d-max-top_percent').fill('100')
await page.locator('#d-max-top_percent').press('Enter')
const tops = await every('top_percent', ['54'])
expect(tops.length === 5 && ok(tops), 'a top % has 5, each with her 54 %', bad(tops))
await page.getByRole('button', { name: 'Discard' }).click()

// Dates and lists, on a "Your own sheet" recap (Keepsake).
await page.getByRole('link', { name: 'All highlight reels' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app')
await page.getByRole('button', { name: 'New highlight reel' }).click()
await page.getByRole('dialog').getByRole('radio', { name: /Your own sheet/ }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click()
await page.waitForSelector('text=Use sample data')
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.getByRole('button', { name: /Import 150 rows/ }).click()
await page.waitForSelector('[data-row-id]')
await tab(page, 'Design')
const dates = await every('c_first_gift', ['21'])
expect(dates.length === 6 && ok(dates), 'a date has 6, each with Lea\'s first gift day', bad(dates))
await designItem(page, 'add')
await page.getByTestId('add-list').click()
await page.waitForSelector('[data-inspector="list_1"]')
const lists = await every('list_1', ['birthday', 'memory box'])
expect(lists.length === 4 && ok(lists), 'a list has 4, each showing its items', bad(lists))

// Save a few and publish: the public recap plays them.
await (await designItem(page, 'c_gifts_made')).locator('[data-scene-option="tally"]').click()
await (await designItem(page, 'c_favorite_style')).locator('[data-scene-option="flap"]').click()
await (await designItem(page, 'list_1')).locator('[data-scene-option="receipt"]').click()
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Design saved')
const saved = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).campaign.settings.slides, campaignId(page))
expect(['tally', 'flap', 'receipt'].every(sc => saved.some(s => s.scene === sc)), 'the picks are saved', saved.map(s => s.scene).filter(Boolean))
await tab(page, 'Sheet')
await publish(page)
const token = await tokenFor(page, 'r => r.token && r.data.gifts_made && r.data.favorite_style && r.data.favorite_occasion')
const r = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
watchErrors(r, errors)
await r.goto(`${BASE}/r/${token}`)
await r.waitForSelector('.recap')
const played = []
for (let i = 0; i < 16; i++) {
  played.push(await r.locator('.recap .slide').last().getAttribute('data-scene'))
  if (played.at(-1) === 'share')
    break
  await r.keyboard.press('ArrowRight')
  await r.waitForTimeout(250)
}
expect(['tally', 'flap', 'receipt'].every(sc => played.includes(sc)), 'the published recap plays them', played)

await browser.close()
finish(errors)
