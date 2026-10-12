// Recap scenes (SPEC M2.5 P1): the scene per slide, varied entrances, hold
// freezes the scene, reduced motion shows every scene's end state, and
// "Guess first" waits for a pick before revealing.
import { BASE, demoSession, expect, finish, launch, publish, tab, tokenFor, watchErrors } from './lib.mjs'

const browser = await launch()
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
watchErrors(page, errors)
await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await publish(page)
// A Habitly row with every slide: top ≤ 12 % and a personal note.
const token = await tokenFor(page, 'r => r.token && r.data.computed_top_percent <= 12 && r.data.personal_note')
const url = `${BASE}/r/${token}`
const values = (await (await fetch(`${BASE}/api/r/${token}`)).json()).recipient.values

const current = p => p.evaluate(() => {
  const el = [...document.querySelectorAll('.recap .slide')].at(-1)
  return { scene: el?.dataset.scene, duration: Number(el?.dataset.duration), label: document.querySelector('.recap .sr-only[aria-live]')?.textContent }
})

// 1. Scene per slide, entrances, durations
{
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  watchErrors(p, errors)
  await p.goto(url, { waitUntil: 'networkidle' })
  const scenes = []
  const entrances = new Set()
  const durations = []
  for (let i = 0; i < 10; i++) {
    const s = await current(p)
    scenes.push(s.scene)
    durations.push(s.duration)
    if (s.scene === 'share')
      break
    await p.keyboard.press('ArrowRight')
    await p.waitForTimeout(80)
    const t = await p.evaluate(() => [...document.querySelectorAll('.recap .slide')].flatMap(e => [...e.classList]).find(c => /^t-\w+-enter-active$/.test(c)))
    if (t)
      entrances.add(t.replace(/^t-|-enter-active$/g, ''))
    await p.waitForTimeout(700)
  }
  expect(JSON.stringify(scenes) === JSON.stringify(['cover', 'days', 'streak', 'count', 'word', 'rank', 'note', 'share']), 'each slide plays its scene', scenes)
  expect(new Set(scenes).size >= 4, 'at least 4 different scenes', new Set(scenes).size)
  expect(entrances.size >= 4, 'slides enter in different ways', [...entrances])
  expect(durations.slice(1, -1).every(d => d >= 5000 && d <= 7000) && durations.at(-1) === 0, 'scene durations 5–7 s, share waits', durations)

  // Back always crossfades
  await p.keyboard.press('ArrowLeft')
  await p.waitForTimeout(60)
  const back = await p.evaluate(() => !!document.querySelector('.recap .t-back-enter-active'))
  expect(back, 'going back crossfades')
}

// 2. Hold freezes the scene (the calendar and its number stop)
{
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.mouse.click(300, 400)
  await p.waitForTimeout(900)
  await p.mouse.move(300, 400)
  await p.mouse.down()
  await p.waitForTimeout(500)
  const before = await p.locator('.slide[data-scene="days"] .big').innerText()
  const running = await p.evaluate(() => document.getAnimations().filter(a => a instanceof CSSAnimation && a.playState === 'running').length)
  await p.waitForTimeout(900)
  const after = await p.locator('.slide[data-scene="days"] .big').innerText()
  await p.mouse.up()
  await p.waitForTimeout(1500)
  const later = await p.locator('.slide[data-scene="days"] .big').innerText()
  expect(running === 0 && before === after, 'holding freezes the scene', { running, before, after })
  expect(later === String(values.active_days), 'releasing finishes the count', later)
}

// 3. Reduced motion: every scene shows its end state, with no animations
{
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage()
  await p.goto(url, { waitUntil: 'networkidle' })
  const checks = {}
  for (let i = 0; i < 10; i++) {
    await p.waitForTimeout(150)
    const s = await p.evaluate(() => {
      const el = [...document.querySelectorAll('.recap .slide')].at(-1)
      const op = n => n && Number(getComputedStyle(n).opacity)
      return {
        scene: el.dataset.scene,
        animations: document.getAnimations().filter(a => a instanceof CSSAnimation).length,
        big: el.querySelector('.big')?.textContent?.trim(),
        lit: el.querySelectorAll('.cell.lit').length,
        links: el.querySelectorAll('.link').length,
        odometer: el.querySelector('.odometer')?.getAttribute('aria-label'),
        kept: el.querySelectorAll('.dot.kept').length,
        label: op(el.querySelector('.you-label')),
        words: [...el.querySelectorAll('.nw')].every(w => op(w) === 1),
        confetti: el.querySelectorAll('.confetti').length,
        tiles: el.querySelectorAll('.tile').length,
      }
    })
    checks[s.scene] = s
    if (s.scene === 'share')
      break
    await p.keyboard.press('ArrowRight')
  }
  const num = n => Number(String(n).replace(/\D/g, ''))
  expect(Object.values(checks).every(c => c.animations === 0), 'reduced motion: no animations on any slide', Object.fromEntries(Object.entries(checks).map(([k, c]) => [k, c.animations])))
  expect(checks.days.lit === values.active_days && num(checks.days.big) === values.active_days, 'days: the calendar is filled to the value', checks.days)
  expect(checks.streak.links === Math.min(120, values.longest_streak_days) && num(checks.streak.big) === values.longest_streak_days, 'streak: every link is there', checks.streak)
  expect(num(checks.count.odometer) === values.items_created, 'count: the digits show the value', checks.count.odometer)
  expect(checks.rank.kept === values.top_percent && num(checks.rank.big) === values.top_percent && checks.rank.label === 1, 'rank: top X dots lit, "You\'re here" shown', checks.rank)
  expect(checks.note.words, 'note: every word visible')
  expect(checks.share.confetti === 0 && checks.share.tiles >= 3, 'share: tiles in place, no confetti', checks.share)
}

// 4. Guess first
{
  await tab(page, 'Design')
  await page.locator('[data-testid="guess-first"]').check()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForSelector('text=Design saved')
  await tab(page, 'Sheet')

  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage()
  watchErrors(p, errors)
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.keyboard.press('ArrowRight')
  const group = p.getByRole('group', { name: 'Your guess' })
  await group.waitFor()
  const choices = await group.getByRole('button').allInnerTexts()
  const real = values.active_days.toLocaleString('en-US')
  expect(choices.length === 3 && choices.includes(real), 'three choices including the real one', choices)
  await p.waitForTimeout(6800)
  expect((await current(p)).label === 'Slide 2 of 8' && await group.isVisible(), 'the story waits for the guess')
  await group.getByRole('button', { name: real, exact: true }).click()
  await p.waitForSelector('.guess-chip')
  const chip = await p.locator('.guess-chip').innerText()
  const revealed = await p.locator('.slide[data-scene="days"] .cell.lit').count()
  expect(chip === 'Spot on' && revealed === values.active_days, 'a pick reveals the scene', { chip, revealed })
  const t0 = Date.now()
  await p.waitForFunction(() => document.querySelector('.recap .sr-only[aria-live]')?.textContent === 'Slide 3 of 8', null, { timeout: 9000 })
  expect(Date.now() - t0 > 5500, 'then the slide plays its full time', `${Date.now() - t0} ms`)
  expect(await group.isVisible(), 'the second number slide asks too')
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(400)
  expect((await current(p)).label === 'Slide 3 of 8' && !(await group.isVisible()) && await p.locator('.slide[data-scene="streak"] .link').count() > 0, 'skipping reveals without a guess')
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(500)
  expect((await current(p)).scene === 'count' && !(await group.isVisible()), 'no more than two guesses per recap')
}

await browser.close()
finish(errors)
