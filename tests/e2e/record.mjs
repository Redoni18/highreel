// Phone-size screen recordings of a recap for review (SPEC M2.5 P1): an app
// recap (Habitly sample, Guess first on, one right and one wrong guess) and
// a visit recap (farm sample with group photos). Plays at the real pace.
// Writes tests/e2e/.out/recap-app.mp4 and recap-visit.mp4. Frames come from
// Chrome's screencast (no Playwright video download); the system ffmpeg
// encodes them with their real timing.
//
//   node tests/e2e/record.mjs            # both
//   node tests/e2e/record.mjs visit      # one
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { BASE, demoSession, designItem, FIX, launch, needFixtures, OUT, publish, tab, tokenFor } from './lib.mjs'

needFixtures()
const which = process.argv[2]
const browser = await launch()

async function workspace(name) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await demoSession(page)
  await page.getByLabel(/what's your business called/).fill(name)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(400)
  return page
}

/** A logo on Your brand, then this recap's Design (filled in by `fill`), then publish. */
async function brand(page, fill) {
  const sheet = page.url()
  await page.goto(`${BASE}/app/brand`)
  await page.locator('[data-testid="logo-input"]').setInputFiles(`${FIX}/logo.png`)
  await page.locator('img[src^="/media/"]').first().waitFor()
  await page.goto(sheet)
  await page.waitForSelector('[data-row-id]')
  await tab(page, 'Design')
  await fill(page)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForSelector('text=Design saved')
  await publish(page)
}

/** Record one recap until its share slide has played; `onSlide` can tap guesses. */
async function record(token, name, onSlide = async () => {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  const frames = []
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await p.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' })
  await p.reload({ waitUntil: 'networkidle' })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 })
  let seen = ''
  for (let guard = 0; guard < 400; guard++) {
    const label = await p.locator('.recap .sr-only[aria-live]').innerText()
    if (label !== seen) {
      seen = label
      await onSlide(p, label)
    }
    const [n, of] = label.replace('Slide ', '').split(' of ').map(Number)
    if (n === of)
      break
    await p.waitForTimeout(250)
  }
  await p.waitForTimeout(4000)
  await cdp.send('Page.stopScreencast')
  await ctx.close()

  // Each frame stays on screen until the next one arrived.
  const dir = `${OUT}/frames-${name}`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir)
  const list = frames.map((f, i) => {
    const file = `${dir}/${String(i).padStart(5, '0')}.jpg`
    writeFileSync(file, Buffer.from(f.data, 'base64'))
    const next = frames[i + 1]?.t ?? f.t + 0.5
    return `file '${file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}`
  })
  writeFileSync(`${dir}/list.txt`, `ffconcat version 1.0\n${list.join('\n')}\nfile '${dir}/${String(frames.length - 1).padStart(5, '0')}.jpg'\n`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${dir}/list.txt`, '-vf', 'fps=30,scale=780:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', `${OUT}/recap-${name}.mp4`])
  rmSync(dir, { recursive: true, force: true })
  console.log(`wrote ${OUT}recap-${name}.mp4 (${frames.length} frames)`)
}

if (!which || which === 'app') {
  const page = await workspace('Habitly')
  await page.getByRole('button', { name: 'Use sample data' }).click()
  await page.waitForSelector('[data-row-id]')
  await brand(page, async (pg) => {
    await designItem(pg, 'items')
    await pg.getByLabel('Items label').fill('habits checked off')
    await pg.locator('[data-testid="guess-first"]').check()
  })
  const token = await tokenFor(page, 'r => r.token && r.data.computed_top_percent <= 12 && r.data.personal_note')
  const values = (await (await fetch(`${BASE}/api/r/${token}`)).json()).recipient.values
  await record(token, 'app', async (p, label) => {
    const group = p.getByRole('group', { name: 'Your guess' })
    if (!(await group.isVisible().catch(() => false)))
      return
    await p.waitForTimeout(1800)
    const buttons = await group.getByRole('button').allInnerTexts()
    // Right on the first guess, wrong on the second.
    const real = (label.startsWith('Slide 2') ? values.active_days : values.longest_streak_days).toLocaleString('en-US')
    await group.getByRole('button', { name: label.startsWith('Slide 2') ? real : buttons.find(b => b !== real), exact: true }).click()
  })
}

if (!which || which === 'visit') {
  const page = await workspace('Green Valley Farm')
  await page.getByRole('button', { name: 'Switch campaign' }).click()
  await page.getByRole('menuitem', { name: 'New Highreel' }).click()
  await page.getByLabel('Name').fill('Summer farm days')
  await page.getByRole('radio', { name: /Summer camp/ }).click()
  await page.getByRole('button', { name: 'Create' }).click()
  await page.waitForSelector('text=Visits and camps template')
  await page.getByRole('button', { name: 'Use sample data' }).click()
  await page.waitForSelector('[data-row-id]')
  await brand(page, async (pg) => {
    await designItem(pg, 'activities')
    await pg.getByLabel('Activities label').fill('animals fed')
    await designItem(pg, 'note')
    await pg.getByLabel('Note from the team').fill('Thank you for spending your days with us. The animals already miss you!')
    await designItem(pg, 'photos')
    await pg.locator('[data-testid="photo-consent"]').check()
    await pg.locator('[data-testid="photo-input"]').setInputFiles([`${FIX}/farm-1.jpg`, `${FIX}/farm-2.jpg`])
    await pg.waitForFunction(() => document.querySelectorAll('[data-inspector="photos"] li img').length === 2, null, { timeout: 20000 })
    await pg.getByLabel('Caption for photo 1').fill('Feeding the baby goats')
    await pg.getByLabel('Caption for photo 1').press('Tab')
    await pg.waitForTimeout(600)
  })
  const token = await tokenFor(page, 'r => r.token && r.data.badge && r.data.days >= 3')
  await record(token, 'visit')
}

await browser.close()
