// The editor (SPEC M2.8): the workspace tabs and Your brand never scroll the
// page (only their panes do); Design is a rail of slides, an inspector and
// the phone: no template picker, drag a slide by its handle, move one with
// the keyboard, hide one with its eye, drop a placeholder in with a chip,
// and Save keeps the order. The recap page puts the frame on a moving
// backdrop in the business's colours with previous, next and pause.
import { BASE, demoSession, designItem, expect, finish, launch, publish, tab, tokenFor, watchErrors, campaignId } from './lib.mjs'

const browser = await launch()
const errors = []
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
watchErrors(page, errors)
const pageScroll = () => page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)
const rail = () => page.locator('[data-sort-key]').evaluateAll(els => els.map(e => e.dataset.sortKey))
const count = async () => Number((await page.getByTestId('stage-count').innerText()).split('/')[1])

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')

// --- No page scroll anywhere ------------------------------------------------------
for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }]) {
  await page.setViewportSize(size)
  const out = {}
  for (const t of ['Sheet', 'Design', 'Share']) {
    await tab(page, t)
    await page.waitForTimeout(400)
    if (t === 'Design') {
      for (const key of ['cover', 'streak', 'add', 'photos', 'share'])
        await designItem(page, key)
    }
    out[t] = await pageScroll()
  }
  await page.goto(`${BASE}/app/brand`)
  await page.waitForSelector('#br-name')
  out.brand = await pageScroll()
  await page.goBack()
  await page.waitForSelector('nav[aria-label="Steps"]')
  expect(Object.values(out).every(v => v <= 0), `no page scroll at ${size.width}×${size.height}: only the panes scroll`, out)
}
await page.setViewportSize({ width: 1440, height: 900 })

// --- Design: the rail ----------------------------------------------------------------
await tab(page, 'Design')
await page.waitForSelector('[data-sort-key]')
expect(await page.locator('[data-starter]').count() === 0, 'no template picker in Design (the template is picked in New recap)')
const start = await rail()
expect(JSON.stringify(start) === JSON.stringify(['active_days', 'streak', 'items', 'top_feature', 'top_percent']), 'the rail lists the slides that move', start)
const tail = await page.locator('[data-slide]').evaluateAll(els => els.map(e => e.dataset.slide).slice(-4))
expect(JSON.stringify(tail) === JSON.stringify(['add', 'photos', 'note', 'share']), 'then Add a slide and the fixed end', tail)

// Drag "Active days" two rows down by its handle.
const grip = page.locator('[data-slide="active_days"] .grip')
const box = await grip.boundingBox()
const step = (await page.locator('[data-slide="streak"]').boundingBox()).y - (await page.locator('[data-slide="active_days"]').boundingBox()).y
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + step + 6, { steps: 5 })
const lifted = await page.locator('[data-slide="active_days"]').getAttribute('class')
const shifted = await page.locator('[data-slide="streak"]').evaluate(el => el.style.transform)
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + step * 2 + 2, { steps: 5 })
await page.mouse.up()
await page.waitForTimeout(300)
expect(lifted.includes('lifted') && shifted.includes('translateY(-'), 'the dragged row lifts and the next one makes room', { lifted, shifted })
const dragged = await rail()
expect(JSON.stringify(dragged) === JSON.stringify(['streak', 'items', 'active_days', 'top_feature', 'top_percent']), 'dropping it moves it', dragged)
expect(await page.locator('nav[aria-label="Steps"] .step-dot.draft').count() === 1, 'a draft until saved')

// The keyboard: ↑ on a handle moves that slide up, focus stays on it.
await page.locator('[data-slide="top_feature"] .grip').focus()
await page.keyboard.press('ArrowUp')
await page.waitForTimeout(150)
const keyed = await rail()
const focused = await page.evaluate(() => document.activeElement?.closest('[data-sort-key]')?.dataset.sortKey)
expect(JSON.stringify(keyed) === JSON.stringify(['streak', 'items', 'top_feature', 'active_days', 'top_percent']) && focused === 'top_feature', 'arrow keys move a slide and keep focus on it', { keyed, focused })

// The eye hides a slide: the phone has one slide fewer.
const before = await count()
await page.locator('[data-slide="top_feature"] .eye').click()
await page.waitForTimeout(200)
expect((await page.locator('[data-slide="top_feature"]').getAttribute('class')).includes('off') && await count() === before - 1, 'the eye hides a slide', { before, after: await count() })
await page.locator('[data-slide="top_feature"] .eye').click()
expect(await count() === before, 'and shows it again')

// Selecting a slide jumps the phone there; a chip drops a placeholder in.
await designItem(page, 'streak')
await page.waitForTimeout(600)
const scene = await page.locator('aside[aria-label="Highreel preview"] .recap .slide').last().getAttribute('data-scene')
expect(scene === 'streak', 'selecting a slide shows it in the phone', scene)
await page.locator('[data-tokens="d-copy-streak"]').getByRole('button', { name: '{first_name}' }).click()
const line = await page.locator('#d-copy-streak').inputValue()
expect(line === 'Longest streak: {longest_streak_days} days in a row. {first_name}', 'a chip on a blank line starts from the default and adds the placeholder', line)
await page.locator('#d-copy-streak').fill('Your streak: ')
await page.locator('#d-copy-streak').press('End')
await page.locator('[data-tokens="d-copy-streak"]').getByRole('button', { name: '{longest_streak_days}' }).click()
expect(await page.locator('#d-copy-streak').inputValue() === 'Your streak: {longest_streak_days}', 'and goes in at the cursor', await page.locator('#d-copy-streak').inputValue())

// Save keeps the order.
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('text=Design saved')
const saved = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).campaign.settings, campaignId(page))
expect(JSON.stringify(saved.slides.map(s => s.key)) === JSON.stringify(['streak', 'items', 'top_feature', 'active_days', 'top_percent']) && saved.copy.streak === 'Your streak: {longest_streak_days}', 'Save keeps the new order and the line', saved.slides)

// --- Your brand: the phone goes to the cover while the colour changes ---------------
await page.goto(`${BASE}/app/brand`)
await page.waitForSelector('#br-name')
await page.getByRole('button', { name: 'Next slide' }).click()
await page.getByRole('button', { name: 'Next slide' }).click()
await page.getByRole('button', { name: 'Use #0F766E' }).click()
await page.waitForTimeout(300)
const brandCount = await page.getByTestId('stage-count').innerText()
expect(brandCount.startsWith('slide 1/'), 'picking a colour shows the cover', brandCount)
expect(await page.getByTestId('logo-drop').count() === 1, 'the logo has a drop zone')

// --- The recap page ----------------------------------------------------------------
await page.goto(`${BASE}/app`)
await page.waitForSelector('main[aria-busy="false"] [data-campaign]')
await page.locator('[data-campaign]').first().click()
await page.waitForSelector('[data-row-id]')
await publish(page)
const token = await tokenFor(page)
const r = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
watchErrors(r, errors)
await r.goto(`${BASE}/r/${token}`)
await r.waitForSelector('.recap')
const backdrop = await r.evaluate(() => ({
  shown: getComputedStyle(document.querySelector('.backdrop')).display !== 'none',
  blobs: document.querySelectorAll('.backdrop svg.blob').length,
  body: getComputedStyle(document.body).backgroundColor,
}))
expect(backdrop.shown && backdrop.blobs === 5 && backdrop.body !== 'rgb(10, 10, 10)', 'a moving backdrop in the business\'s colours behind the frame', backdrop)
await r.getByRole('button', { name: 'Next slide' }).click()
await r.waitForTimeout(200)
expect(await r.getByTestId('count').innerText() === '2 / 7', 'next moves on', await r.getByTestId('count').innerText())
await r.getByTestId('pause').click()
const fill = () => r.locator('.progress .segment').nth(1).locator('.fill').evaluate(el => el.style.transform)
const f1 = await fill()
await r.waitForTimeout(1200)
const f2 = await fill()
expect((await r.locator('.recap').getAttribute('class')).includes('is-held') && f1 === f2 && await r.getByTestId('pause').innerText() === 'Play', 'pause stops the story and freezes the scene', { f1, f2 })
await r.getByTestId('pause').click()
await r.waitForTimeout(600)
expect(await fill() !== f2 && !(await r.locator('.recap').getAttribute('class')).includes('is-held'), 'play goes on')
await r.keyboard.press('k')
expect((await r.locator('.recap').getAttribute('class')).includes('is-held'), 'K pauses too')
await r.getByRole('button', { name: 'Previous slide' }).click()
await r.waitForTimeout(200)
expect(await r.getByTestId('count').innerText() === '1 / 7' && !(await r.locator('.recap').getAttribute('class')).includes('is-held'), 'previous goes back and plays again')

// Phones keep the full-screen recap, no backdrop or buttons.
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
await phone.goto(`${BASE}/r/${token}`)
await phone.waitForSelector('.recap')
const small = await phone.evaluate(() => ({
  backdrop: getComputedStyle(document.querySelector('.backdrop')).display,
  nav: getComputedStyle(document.querySelector('button.nav')).display,
  frame: document.querySelector('.recap').getBoundingClientRect().width,
}))
expect(small.backdrop === 'none' && small.nav === 'none' && small.frame === 390, 'phones keep the full-screen recap', small)

// Reduced motion holds the backdrop still.
const still = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage()
await still.goto(`${BASE}/r/${token}`)
await still.waitForSelector('.recap')
await still.waitForTimeout(300)
const anim = await still.evaluate(() => ({
  spin: getComputedStyle(document.querySelector('.backdrop .spin')).animationName,
  smil: document.querySelector('.backdrop svg.blob').animationsPaused(),
}))
expect(anim.spin === 'none' && anim.smil, 'reduced motion: the backdrop holds still', anim)

await browser.close()
finish(errors)
