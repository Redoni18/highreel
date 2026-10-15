// SPEC M2.16 on the business side. Design: every option has an (i) that
// opens what it does (and it never submits the form); Calendar says what the
// previewed person sees, and that a short visit only changes numbers up to 70
// (owner, 2026-10-15: switching it on 212 days "does nothing"). New Highreel
// picks a business type, then a look (SPEC M2.17: a design and colourway,
// following the type until picked by hand); Your brand has no colour. The
// home opens with cards.
import { BASE, demoSession, designItem, expect, finish, launch, OUT, publish, tab, watchErrors } from './lib.mjs'

const browser = await launch()
const errors = []
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
watchErrors(page, errors)

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await tab(page, 'Design')

// Opens an (i), checks its panel says something, and closes it.
async function explains(topic) {
  const button = page.locator(`[data-info="${topic}"]`).first()
  await button.click()
  const panel = page.locator(`[data-info-panel="${topic}"]`)
  await panel.waitFor()
  const text = (await panel.innerText()).replace(/\s+/g, ' ').trim()
  await page.keyboard.press('Escape')
  await panel.waitFor({ state: 'detached' })
  return text
}

// --- The rail: theme, guess first, the slides, the end ---------------------------
const rail = {}
for (const topic of ['look', 'guess', 'slides', 'end'])
  rail[topic] = await explains(topic)
expect(/Stories/.test(rail.look) && /Paper/.test(rail.look) && /colors/.test(rail.look) && !/colour/i.test(rail.look), 'Look explains the designs and their colors (American spelling)', rail.look)
expect(/first 2 number slides/.test(rail.guess), 'Guess first says which slides ask', rail.guess)
expect(rail.slides.length > 80 && rail.end.length > 40, 'the slide list and its end are explained')
// Opening one inside the form doesn't save or submit it.
expect(await page.getByText('All changes saved').count() === 1, 'an (i) doesn\'t touch the form')

// --- A calendar slide: every option, and what this person sees ------------------
await designItem(page, 'active_days')
const slideTopics = await page.locator('[data-inspector="active_days"] [data-info]').evaluateAll(els => els.map(e => e.dataset.info))
expect(['line', 'animation', 'calendar', 'showsFrom'].every(t => slideTopics.includes(t)), 'the slide\'s line, animation, calendar and rule each have an (i)', slideTopics)
const person = (await page.getByTestId('calendar-now').innerText()).trim()
expect(/^\S+ has \d+ days?: the year, with \d+ days? lit\.$/.test(person), 'under Calendar: what the previewed person sees with a year', person)
const days = Number(person.match(/has (\d+)/)[1])
await page.locator('[data-testid="calendar-span"] [data-value="visit"]').click()
const visit = (await page.getByTestId('calendar-now').innerText()).trim()
expect(days > 70 ? /more than 70, so they see the year either way/.test(visit) : /calendar page|grid of/.test(visit), 'switched to a short visit, it says what changes for them, or why nothing does', { days, visit })
const calendar = await explains('calendar')
expect(/A year/.test(calendar) && /A short visit/.test(calendar) && /Above 70 days/.test(calendar) && calendar.includes(visit), 'the Calendar (i) explains both and the 70-day limit, with this person\'s line', calendar)
await page.screenshot({ path: `${OUT}explain-calendar.png` })
await page.locator('[data-info="calendar"]').click()
await page.locator('[data-info-panel="calendar"]').waitFor()
await page.screenshot({ path: `${OUT}explain-calendar-open.png` })
await page.keyboard.press('Escape')
await page.getByRole('button', { name: 'Discard' }).click()

// The other places with options.
const elsewhere = {}
await designItem(page, 'items')
elsewhere.items = await page.locator('[data-inspector="items"] [data-info]').evaluateAll(els => els.map(e => e.dataset.info))
await designItem(page, 'add')
elsewhere.add = await page.locator('[data-inspector="add"] [data-info]').evaluateAll(els => els.map(e => e.dataset.info))
await designItem(page, 'note')
elsewhere.note = await page.locator('[data-inspector="note"] [data-info]').evaluateAll(els => els.map(e => e.dataset.info))
await designItem(page, 'share')
elsewhere.button = await page.locator('[data-inspector="share"] [data-info]').evaluateAll(els => els.map(e => e.dataset.info))
await designItem(page, 'photos')
elsewhere.photos = await page.locator('[data-inspector="photos"] [data-info]').evaluateAll(els => els.map(e => e.dataset.info))
await designItem(page, 'cover')
elsewhere.cover = await page.locator('[data-inspector="cover"] [data-info]').evaluateAll(els => els.map(e => e.dataset.info))
expect(elsewhere.items.includes('itemsLabel') && elsewhere.items.includes('tokens')
  && JSON.stringify(elsewhere.add) === JSON.stringify(['addValue', 'addTop', 'addList', 'addColumn'])
  && elsewhere.note.includes('note') && elsewhere.button.includes('button') && elsewhere.photos.includes('photos') && elsewhere.cover.includes('coverLine'), 'the count label, tokens, the four ways to add a slide, the note, the button, photos and the cover each have one', elsewhere)
for (const topic of ['itemsLabel', 'tokens', 'addValue', 'addTop', 'addList', 'addColumn', 'note', 'button', 'photos', 'coverLine']) {
  if (topic === 'itemsLabel' || topic === 'tokens')
    await designItem(page, 'items')
  else if (topic.startsWith('add'))
    await designItem(page, 'add')
  else if (topic === 'button')
    await designItem(page, 'share')
  else
    await designItem(page, topic === 'coverLine' ? 'cover' : topic)
  const text = await explains(topic)
  expect(text.length > 60, `${topic} explains itself`, text.slice(0, 80))
}

// --- New Highreel: a business type, then a look (SPEC M2.17) ----------------------
await page.goto(`${BASE}/app`)
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
await page.getByRole('button', { name: 'New Highreel' }).click()
const dialog = page.getByRole('dialog')
const where = async () => ({ step: await dialog.locator('form').getAttribute('data-step'), progress: (await dialog.getByTestId('wizard-progress').innerText()).trim(), title: await dialog.getByTestId('step-title').innerText(), back: await dialog.getByTestId('wizard-back').innerText(), next: await dialog.getByTestId('wizard-next').innerText() })
const next = () => dialog.getByRole('button', { name: 'Continue' }).click()
const back = () => dialog.getByRole('button', { name: 'Back' }).click()
const picked = async () => ({ design: await dialog.locator('[data-design][data-checked="true"]').getAttribute('data-design'), colorway: await dialog.locator('[data-colorway][data-state="on"]').getAttribute('data-colorway') })
// A wizard (owner, 2026-10-15): what it is and its name, the business type, the look.
const one = await where()
expect(one.step === 'what' && one.progress === 'Step 1 of 3' && one.back === 'Cancel' && one.next === 'Continue' && await dialog.getByLabel('Name').count() === 1 && await dialog.locator('[data-starter], [data-design]').count() === 0, 'step 1: what it\'s for, its name and year; Cancel and Continue', one)
await page.screenshot({ path: `${OUT}explain-new-1.png` })
await dialog.getByLabel('Name').fill('')
expect(await dialog.getByRole('button', { name: 'Continue' }).isDisabled(), 'no name, no next step')
await dialog.getByLabel('Name').fill('2026 Highreels')
await next()
const two = await where()
expect(two.step === 'type' && two.progress === 'Step 2 of 3' && two.title === 'What kind of business is it for?' && two.back === 'Back' && await dialog.locator('[data-starter]').count() === 11 && await dialog.locator('[data-starter] .swatch').count() === 0, 'step 2: the business type (no colours of its own); Back and Continue', two)
await page.screenshot({ path: `${OUT}explain-new-2.png` })
await dialog.getByRole('radio', { name: /Newsletter/ }).click()
await next()
const three = await where()
expect(three.step === 'look' && three.progress === 'Step 3 of 3' && three.next === 'Create' && JSON.stringify(await picked()) === JSON.stringify({ design: 'stories', colorway: 'poppy' }) && /Newsletter starts you in Stories, Poppy/.test(await dialog.getByTestId('look-from').innerText()), 'step 3: the look, starting at the type\'s suggestion; Create', { ...three, look: await picked() })
await back()
await dialog.getByRole('radio', { name: /Software tool/ }).click()
await next()
expect(JSON.stringify(await picked()) === JSON.stringify({ design: 'paper', colorway: 'teal' }), 'Back to another type, another suggestion (Paper in teal)', await picked())
await dialog.locator('[data-colorway="sunflower"]').click()
await page.screenshot({ path: `${OUT}explain-new-3.png` })
await back()
await dialog.getByRole('radio', { name: /Newsletter/ }).click()
await next()
expect(JSON.stringify(await picked()) === JSON.stringify({ design: 'paper', colorway: 'sunflower' }) && (await dialog.getByTestId('colorway-name').innerText()) === 'Sunflower' && await dialog.getByTestId('look-from').count() === 0, 'picked by hand, the look stays when the type changes', await picked())
// Back to the start keeps what was picked; a business year skips the business type.
await back()
await back()
expect((await dialog.getByLabel('Name').inputValue()) === '2026 Highreels', 'Back to step 1 keeps the name')
await dialog.getByRole('radio', { name: /Your business year/ }).click()
await next()
const biz = await where()
expect(biz.step === 'look' && biz.progress === 'Step 2 of 2', 'a business year goes straight to its look (two steps)', biz)
await page.keyboard.press('Escape')
await page.getByRole('button', { name: 'New Highreel' }).click()
expect((await where()).step === 'what' && (await dialog.getByLabel('Name').inputValue()) === `${new Date().getFullYear()} Highreels`, 'opened again, it starts over at step 1', await where())
await page.keyboard.press('Escape')

await page.goto(`${BASE}/app/brand`)
await page.waitForSelector('#br-name')
expect(await page.locator('.set-row', { hasText: /Colou?r/ }).count() === 0 && await page.locator('input[type="color"]').count() === 0, 'Your brand has no color')

// --- The home's cards ------------------------------------------------------------
await page.goto(`${BASE}/app`)
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
const before = await page.locator('[data-card]').evaluateAll(els => els.map(e => [e.dataset.card, e.querySelector('[data-value]').textContent.trim()]))
expect(JSON.stringify(before) === JSON.stringify([['sent', '0'], ['opened', '0'], ['shared', '0'], ['clicked', '0']]), 'the home opens with four cards, all 0 before anything goes out', before)
await page.locator('[data-campaign]').first().click()
await page.waitForSelector('[data-row-id]')
await publish(page)
await page.getByRole('link', { name: 'All Highreels' }).click()
await page.waitForSelector('main[aria-busy="false"] [data-card="sent"]')
await page.waitForFunction(() => document.querySelector('[data-card="sent"] [data-value]')?.textContent.trim() === '195')
const sent = (await page.locator('[data-card="sent"]').innerText()).replace(/\s+/g, ' ')
expect(sent === 'Sent 195 in 1 campaign', 'published, Sent says 195 in 1 campaign', sent)
const row = await page.locator('[data-card]').evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().top))).size)
expect(row === 1, 'the cards sit in one row on a computer', row)
await page.screenshot({ path: `${OUT}explain-home.png` })
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(200)
const phone = await page.evaluate(() => ({ cols: new Set([...document.querySelectorAll('[data-card]')].map(e => Math.round(e.getBoundingClientRect().left))).size, wide: document.documentElement.scrollWidth > innerWidth }))
expect(phone.cols === 2 && !phone.wide, 'two by two on a phone, no sideways scroll', phone)
await page.screenshot({ path: `${OUT}explain-home-phone.png`, fullPage: true })

await browser.close()
finish(errors)
