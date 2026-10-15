// A recap's own columns and the scene library (SPEC M2.7). "Your own sheet"
// imports the Keepsake sample (a made-up gift-making site) with its columns
// detected and its planted errors flagged; Design changes scenes and
// options, reorders, adds a "top X%" and a new column, removes a slide;
// published recaps play the added slides (hearts, a calendar page) and carry
// no id or email. A template recap can hide one of its own slides.
import { BASE, campaignId, demoSession, designItem, expect, finish, launch, publish, sheetCounts, tab, watchErrors, rowsOf, newHighreel } from './lib.mjs'

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
watchErrors(page, errors)
const api = path => page.evaluate(async p => (await fetch(p)).json(), path)
const campaign = async () => (await api(`/api/campaigns/${campaignId(page)}`)).campaign
const preview = 'aside[aria-label="Highreel preview"] .recap .slide'
const slideScene = () => page.locator(preview).last().getAttribute('data-scene')

await demoSession(page)

// --- A template recap: hide one of its slides --------------------------------------
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await tab(page, 'Design')
await page.locator('[data-slide="streak"]').getByRole('button', { name: 'Hide slide 3' }).click()
expect((await page.locator('[data-slide="streak"]').getAttribute('class')).includes('off'), 'a template slide can be hidden with its eye')
const daysSlide = await designItem(page, 'active_days')
await daysSlide.locator('[data-scene-option="count"]').click()
await daysSlide.locator('[data-testid="tokens"] [data-value="stars"]').click()
await page.waitForTimeout(700)
expect(await slideScene() === 'count' && await page.locator(`${preview} .token.stars`).count() > 0, 'the active-days slide switches to Count up with stars', await slideScene())
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Design saved')
let c = await campaign()
const streak = c.settings.slides?.find(s => s.key === 'streak')
const days = c.settings.slides?.find(s => s.key === 'active_days')
expect(streak?.hidden === true && days?.scene === 'count' && days?.tokens === 'stars', 'Save keeps the slide list', c.settings.slides)

// --- "Your own sheet" with the Keepsake sample -------------------------------------
await page.getByRole('link', { name: 'All Highreels' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app')
await page.getByRole('button', { name: 'New Highreel' }).click()
await newHighreel(page, { type: /Your own sheet/ })
await page.waitForURL('**/app/c/*')
await page.waitForSelector('text=Your own sheet template')
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('text=Match your columns')
const fields = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[role="dialog"] [data-fields] tbody tr')].map((tr) => {
  // The column picked for each field: its Select's shown value.
  return [tr.querySelector('td').innerText.replace(' *', ''), tr.querySelector('[data-map]').innerText.trim()]
})))
expect(fields.customer_id === 'member_id' && fields.first_name === 'first_name', 'member_id is the id, first_name the name', fields)
const own = await page.locator('[data-own-column]').evaluateAll(trs => trs.map(tr => `${tr.dataset.ownColumn}:${tr.querySelector('[data-type]').innerText}:${tr.querySelector('[role="checkbox"]').getAttribute('aria-checked') === 'true'}`))
expect(JSON.stringify(own) === JSON.stringify(['joined:Date:true', 'gifts_made:Number:true', 'people_gifted:Number:true', 'photos_added:Number:true', 'times_opened:Number:true', 'favorite_occasion:Text:true', 'favorite_style:Text:true', 'first_gift:Date:true', 'maker_badge:Text:true']), 'nine own columns, types detected, all added', own)
await page.getByLabel('Add joined as a slide').uncheck()
await page.getByRole('button', { name: /Import 150 rows/ }).click()
await page.waitForSelector('[data-row-id]')
await page.waitForTimeout(300)
const counts = await sheetCounts(page)
expect(counts.all === 150 && counts.errors === 3, '150 rows, the 3 planted errors flagged', counts)
const rows = await rowsOf(page)
const flagged = rows.filter(r => Object.keys(r.errors).length).map(r => `${r.row_index + 1}:${Object.entries(r.errors).map(([k, v]) => `${k}=${v}`).join()}`)
expect(JSON.stringify(flagged) === JSON.stringify(['6:gifts_made=Needs a whole number', '31:first_gift=Use YYYY-MM-DD', '102:customer_id=Already used in row 101']), 'the planted errors, in the right cells', flagged)
expect(rows[0].raw.joined === undefined && rows[0].data.gifts_made === 14, 'an unticked column isn\'t imported; numbers are numbers', rows[0].data)
c = await campaign()
expect(c.settings.columns.length === 8 && c.settings.slides.length === 8, 'eight own columns, a slide each', { columns: c.settings.columns.map(x => x.key), slides: c.settings.slides?.map(x => x.key) })
const headerCols = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-row-id] [data-col]')].map(el => el.dataset.col))])
expect(['gifts_made', 'first_gift', 'maker_badge'].every(k => headerCols.includes(k)), 'the grid shows the own columns', headerCols)

// --- Design: the slide list ----------------------------------------------------------
await tab(page, 'Design')
const cards = await page.locator('[data-slide]').evaluateAll(els => els.map(e => e.dataset.slide))
expect(JSON.stringify(cards.slice(0, 10)) === JSON.stringify(['cover', 'c_gifts_made', 'c_people_gifted', 'c_photos_added', 'c_times_opened', 'c_favorite_occasion', 'c_favorite_style', 'c_first_gift', 'c_maker_badge', 'add']), 'Design lists the own slides, then Add a slide', cards)
expect(await page.locator('[data-starter]').count() === 0, 'no business-type templates to pick for your own sheet')

// Hearts on the gifts slide.
await (await designItem(page, 'c_gifts_made')).locator('[data-testid="tokens"] [data-value="hearts"]').click()
await page.waitForTimeout(700)
expect(await slideScene() === 'count' && await page.locator(`${preview} .token.hearts`).count() > 0, 'Count up with hearts, live in the phone')
await page.locator('#d-copy-c_gifts_made').fill('You made {gifts_made} gifts for {people_gifted} people.')
// The first gift as a calendar page, moved up to second.
await designItem(page, 'c_first_gift')
await page.waitForTimeout(700)
expect(await slideScene() === 'date', 'a date gets the calendar page', await slideScene())
for (let i = 0; i < 5; i++)
  await page.getByRole('button', { name: 'Move earlier' }).click()
// A badge for the style, a "top X%" for gifts, a new column, and one slide removed.
await (await designItem(page, 'c_favorite_style')).locator('[data-scene-option="badge"]').click()
await designItem(page, 'add')
await page.getByTestId('add-top').click()
await page.getByRole('option', { name: 'gifts_made' }).click()
await page.getByRole('button', { name: 'Add a top % slide' }).click()
await page.waitForSelector('[data-inspector="top_gifts_made"]')
await designItem(page, 'add')
await page.getByLabel('New column name').fill('Thank-you notes')
await page.getByRole('button', { name: 'Add column' }).click()
await designItem(page, 'c_photos_added')
await page.getByRole('button', { name: 'Remove slide' }).click()
// A list: words and dates first; take the style off, put the badge on.
await designItem(page, 'add')
await page.getByTestId('add-list').click()
await page.waitForSelector('[data-inspector="list_1"]')
const listed = () => page.locator('[data-list-columns="list_1"] [data-list-column]').evaluateAll(els => els.map(e => e.dataset.listColumn))
expect(JSON.stringify(await listed()) === JSON.stringify(['favorite_occasion', 'favorite_style', 'first_gift']), 'a new list starts with three word and date columns', await listed())
await page.getByRole('button', { name: 'Take favorite_style off the list' }).click()
await page.getByTestId('list-add').click()
await page.getByRole('menuitem', { name: 'maker_badge' }).click()
expect(JSON.stringify(await listed()) === JSON.stringify(['favorite_occasion', 'first_gift', 'maker_badge']), 'columns come off and on', await listed())
await designItem(page, 'list_1')
await page.waitForTimeout(900)
const tl = await page.locator(`${preview}`).last().evaluate(el => ({ scene: el.dataset.scene, labels: [...el.querySelectorAll('.tl-label')].map(x => x.textContent.trim()) }))
expect(tl.scene === 'timeline' && tl.labels.includes('Favorite occasion') && tl.labels.includes('First gift'), 'the list plays as a timeline, labelled by column', tl)
await page.waitForTimeout(200)
const order = await page.locator('[data-slide]').evaluateAll(els => els.map(e => e.dataset.slide).filter(k => /^(c|top|list)_/.test(k)))
expect(JSON.stringify(order) === JSON.stringify(['c_gifts_made', 'c_first_gift', 'c_people_gifted', 'c_times_opened', 'c_favorite_occasion', 'c_favorite_style', 'c_maker_badge', 'top_gifts_made', 'c_thank_you_notes', 'list_1']), 'reordered, added and removed', order)
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Design saved')
c = await campaign()
expect(c.settings.columns.some(x => x.key === 'thank_you_notes' && x.type === 'int') && c.settings.slides.find(s => s.key === 'c_gifts_made')?.tokens === 'hearts' && c.settings.copy.c_gifts_made?.includes('{people_gifted}'), 'saved: the new column, hearts, the line', c.settings)

await tab(page, 'Sheet')
await page.waitForSelector('[data-row-id]')
expect(await page.locator('[data-row-id] [data-col="thank_you_notes"]').count() > 0, 'the new column is in the grid')

// --- The Sheet's column menu: change a type (every row checked again), remove a column ---
const badges = rows.filter(r => r.raw.maker_badge).length
await page.locator('[data-column-menu="maker_badge"]').click()
await page.getByRole('menuitemradio', { name: 'Number' }).click()
const ask = await page.getByRole('dialog').innerText()
expect(ask.includes(`${badges} rows have cells that won't fit`), 'changing to a number says how many cells won\'t fit', ask.replace(/\s+/g, ' '))
await page.getByRole('dialog').getByRole('button', { name: 'Change type' }).click()
await page.waitForSelector('text=maker_badge is now a number')
await page.waitForTimeout(300)
let n = await sheetCounts(page)
const broken = rows.filter(r => r.raw.maker_badge || Object.keys(r.errors).length).length
expect(n.errors === broken, 'those rows need fixing now', { errors: n.errors, expected: broken })
await page.locator('[data-column-menu="maker_badge"]').click()
await page.getByRole('menuitemradio', { name: 'Text' }).click()
await page.waitForSelector('text=maker_badge is now text')
await page.waitForTimeout(300)
n = await sheetCounts(page)
c = await campaign()
expect(n.errors === 3 && c.settings.columns.find(x => x.key === 'maker_badge')?.type === 'text' && c.settings.slides.find(s => s.key === 'list_1')?.columns.includes('maker_badge'), 'back to text: fixed again, still in the list', { errors: n.errors })
await page.locator('[data-column-menu="thank_you_notes"]').click()
await page.getByRole('menuitem', { name: 'Remove column' }).click()
await page.getByRole('dialog').getByRole('button', { name: 'Remove column' }).click()
await page.waitForSelector('text=Removed thank_you_notes')
c = await campaign()
expect(await page.locator('[data-row-id] [data-col="thank_you_notes"]').count() === 0 && !c.settings.columns.some(x => x.key === 'thank_you_notes') && !c.settings.slides.some(s => s.column === 'thank_you_notes'), 'a removed column leaves the grid and takes its slide')

// --- Published: the recap plays the added slides ---------------------------------------
await publish(page)
const rowsNow = await rowsOf(page)
const lea = rowsNow.find(r => r.token && r.data.gifts_made >= 1 && r.data['computed_top:gifts_made'] <= 25 && r.data.first_gift && r.data.maker_badge)
const pub = await (await fetch(`${BASE}/api/r/${lea.token}`)).json()
const values = pub.recipient.values
expect(!('customer_id' in values) && !('email' in values) && !JSON.stringify(pub).includes(lea.raw.customer_id) && values.people_gifted === lea.data.people_gifted && typeof values.top_gifts_made === 'number', 'the payload: own columns and the rank, no id or email', values)
// Step through with the keys, slide by slide (the live region says where we are).
await page.goto(`${BASE}/r/${lea.token}`, { waitUntil: 'networkidle' })
const where = () => page.evaluate(() => document.querySelector('.recap .sr-only[aria-live]')?.textContent ?? '')
const total = Number((await where()).match(/of (\d+)/)?.[1] ?? 0)
const scenes = []
for (let n = 1; n <= total; n++) {
  await page.waitForFunction(k => document.querySelector('.recap .sr-only[aria-live]')?.textContent?.startsWith(`Slide ${k} `), n)
  await page.waitForTimeout(250)
  scenes.push(await page.locator('.recap .slide').last().getAttribute('data-scene'))
  if (n === 2) {
    const line = (await page.locator('.recap .slide').last().innerText()).replace(/\s+/g, ' ')
    expect(line.includes(`gifts for ${lea.data.people_gifted} people`) && await page.locator('.recap .slide .token.hearts').count() > 0, 'a line names another column; tokens are hearts', line)
  }
  if (n === 3) {
    await page.waitForTimeout(2200)
    const datePage = (await page.locator('.recap .slide').last().innerText()).replace(/\s+/g, ' ')
    expect(/(January|February|March|April|May|June|July|August|September) \d+, 2026/.test(datePage), 'the calendar page shows the date in words', datePage)
    await page.screenshot({ path: 'tests/e2e/.out/custom-date.png' })
  }
  if (n < total)
    await page.keyboard.press('ArrowRight')
}
expect(JSON.stringify(scenes) === JSON.stringify(['cover', 'count', 'date', 'count', 'count', 'word', 'badge', 'badge', 'rank', 'timeline', 'note', 'share']), 'the recap plays hearts, the calendar page, words, badges, the rank and the list', scenes)

// --- Decimals: amounts from another tool, currency signs and decimal commas ---------------
await page.goto(`${BASE}/app`)
await page.getByRole('button', { name: 'New Highreel' }).click()
await newHighreel(page, { type: /Your own sheet/ })
await page.waitForSelector('text=Your own sheet template')
await page.locator('[data-testid="file-input"]').setInputFiles({ name: 'orders.csv', mimeType: 'text/csv', buffer: Buffer.from('customer_id,first_name,spent,orders\na1,Ana,€24.99,3\na2,Ben,"1.204,50 €",5\na3,Cleo,12,1\n') })
await page.waitForSelector('text=Match your columns')
const types = await page.locator('[data-own-column]').evaluateAll(trs => trs.map(tr => `${tr.dataset.ownColumn}:${tr.querySelector('[data-type]').innerText}`))
expect(JSON.stringify(types) === JSON.stringify(['spent:Decimal', 'orders:Number']), 'amounts with cents are decimals', types)
await page.getByRole('button', { name: /Import 3 rows/ }).click()
await page.waitForSelector('[data-row-id]')
const spent = (await rowsOf(page)).map(r => r.data.spent)
expect(JSON.stringify(spent) === JSON.stringify([24.99, 1204.5, 12]), 'currency signs and decimal commas read as numbers', spent)
await tab(page, 'Design')
const spentSlide = await designItem(page, 'c_spent')
const decimalScenes = await spentSlide.locator('[data-scene-option]').evaluateAll(els => els.map(e => e.dataset.sceneOption))
expect(JSON.stringify(decimalScenes) === JSON.stringify(['count', 'fill', 'slots', 'bignumber', 'gauge']) && await spentSlide.locator('[data-testid="tokens"] [data-value]').count() === 4, 'a decimal gets the scenes that don\'t count units (no calendar, chain, tally or bubbles), tokens to choose', decimalScenes)
await page.waitForTimeout(2200)
const amount = await page.locator(`${preview} .odometer`).last().getAttribute('aria-label')
expect(amount === '24.99', 'the slide shows the cents', amount)

await browser.close()
finish(errors)
