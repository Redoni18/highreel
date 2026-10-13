// Save images (SPEC M2.13): "Save image" on the last slide shrinks the story
// up and opens a picker with every slide as a card, the summary card ticked.
// Laptop: hovering a card swells it (and its neighbours a little) and shows
// it in the story; ticking two more and saving downloads three 1080×1920
// PNGs, each a real picture of its slide; the save counts once. Escape or a
// tap on the story closes it. Cards keep clear of each other when hovered or
// ticked. Phone: a tap ticks, press-and-hold shows the slide without ticking
// it. Reduced motion: nothing animates.
import { readFileSync } from 'node:fs'
import { BASE, demoSession, expect, finish, launch, OUT, publish, tokenFor, watchErrors, rowsOf } from './lib.mjs'

const browser = await launch()
const errors = []
const missing = []
const setup = await (await browser.newContext()).newPage()
await demoSession(setup)
await setup.getByRole('button', { name: 'Use sample data' }).click()
await setup.waitForSelector('[data-row-id]')
await publish(setup)
const token = await tokenFor(setup, 'r => r.token && r.data.computed_top_percent <= 12 && r.data.personal_note')

const picker = p => p.getByRole('dialog', { name: 'Save images' })
async function toLastSlide(p) {
  await p.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' })
  for (let i = 0; i < 20; i++) {
    if (await p.locator('[data-save-image]').isVisible().catch(() => false))
      break
    await p.keyboard.press('ArrowRight')
    await p.waitForTimeout(150)
  }
  await p.locator('[data-save-image]').waitFor()
  await p.waitForTimeout(1400)
}
/** A PNG's size, and how many distinct colours a 24×42 sample of it has (a blank or broken capture has a handful). */
const look = (p, file) => p.evaluate(async (b64) => {
  const img = new Image()
  img.src = `data:image/png;base64,${b64}`
  await img.decode()
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 42
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, 24, 42)
  const d = ctx.getImageData(0, 0, 24, 42).data
  const colours = new Set()
  for (let i = 0; i < d.length; i += 4)
    colours.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`)
  return { size: `${img.naturalWidth}x${img.naturalHeight}`, colours: colours.size }
}, readFileSync(file).toString('base64'))

// --- Laptop -------------------------------------------------------------------------------
const desk = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })).newPage()
watchErrors(desk, errors)
desk.on('response', r => r.status() >= 400 && missing.push(`${r.status()} ${r.url()}`))
await toLastSlide(desk)
const slideCount = await desk.evaluate(() => Number(document.querySelector('.recap .sr-only[aria-live]').textContent.match(/of (\d+)/)[1]))
await desk.getByRole('button', { name: 'Save image' }).click()
await picker(desk).waitFor()
await desk.waitForTimeout(700)
const cards = picker(desk).locator('[data-card]')
const keys = await cards.evaluateAll(els => els.map(e => e.dataset.card))
const pressed = await cards.evaluateAll(els => els.filter(e => e.getAttribute('aria-pressed') === 'true').map(e => e.dataset.card))
expect(keys.length === slideCount && keys.at(-1) === 'share' && pressed.join() === 'share', 'every slide is a card, the summary card ticked', { slideCount, keys, pressed })
const shrunk = await desk.evaluate(() => {
  const stage = document.querySelector('.recap .stage')
  return { shrunk: stage.classList.contains('shrunk'), scale: new DOMMatrix(getComputedStyle(stage).transform).a }
})
expect(shrunk.shrunk && shrunk.scale > 0.5 && shrunk.scale < 0.62, 'the story shrinks up out of the way', shrunk)
await desk.screenshot({ path: `${OUT}/save-picker-desk.png` })

// Hover: the card swells, its neighbour a little, and the story shows that slide.
const third = cards.nth(2)
await third.hover()
await desk.waitForTimeout(900)
const hover = await desk.evaluate(() => {
  const all = [...document.querySelectorAll('[data-card]')]
  const scale = el => new DOMMatrix(getComputedStyle(el).transform).a
  return { card: scale(all[2]), next: scale(all[3]), far: scale(all[5]), peek: document.querySelector('.peek')?.dataset.peek ?? null }
})
expect(hover.card > 1.1 && hover.next > 1.02 && hover.next < hover.card && Math.abs(hover.far - 1) < 0.01, 'the hovered card swells like a dock, its neighbours a little', hover)
expect(hover.peek === keys[2], 'and the story above shows that slide', hover.peek)
// Clear of each other: the hovered card and its swollen neighbours never touch, rings included.
const clear = await desk.evaluate(() => {
  const r = [...document.querySelectorAll('[data-card]')].map(e => e.getBoundingClientRect())
  const ring = parseFloat(getComputedStyle(document.querySelector('[data-card]'), '::after').left) * -1 + 3
  return { ring: Math.round(ring), gaps: [r[2].left - r[1].right, r[3].left - r[2].right].map(Math.round) }
})
expect(clear.gaps.every(g => g >= 2 * clear.ring), 'a hovered card and its neighbours keep clear of each other, room for two tick rings', clear)
await desk.screenshot({ path: `${OUT}/save-picker-hover.png` })
await desk.mouse.move(10, 10)
// Hover intent waits ~260 ms before letting go, then the preview fades for 300 ms.
await desk.waitForTimeout(900)
expect(await desk.locator('.peek').count() === 0, 'moving away puts the story back')

// Tick two more and save three images.
await cards.nth(1).click()
await cards.nth(2).click()
const save = picker(desk).getByTestId('save-images')
await desk.waitForFunction(() => document.querySelector('[data-testid="save-images"]')?.textContent?.trim() === 'Save 3 images', null, { timeout: 30000 })
const downloads = []
desk.on('download', d => downloads.push(d))
await save.click()
await desk.waitForFunction(() => document.querySelector('[data-testid="save-images"]')?.textContent?.trim() === 'Saved', null, { timeout: 10000 })
await desk.waitForTimeout(1200)
const names = downloads.map(d => d.suggestedFilename())
expect(downloads.length === 3 && /-02\.png$/.test(names[0]) && /-03\.png$/.test(names[1]) && !/-\d\d\.png$/.test(names[2]), 'Save downloads three images, numbered by slide, the summary card by its usual name', names)
const looks = []
for (const d of downloads) {
  const file = `${OUT}/${d.suggestedFilename()}`
  await d.saveAs(file)
  looks.push(await look(desk, file))
}
expect(looks.every(l => l.size === '1080x1920' && l.colours >= 12), 'each is a 1080×1920 PNG with a real picture in it', looks)
const saved = (await rowsOf(setup)).find(r => r.token === token).saved_at
expect(!!saved, 'the business sees it was saved', saved)

// Escape closes; so does a tap on the story.
await desk.keyboard.press('Escape')
await picker(desk).waitFor({ state: 'detached' })
expect(await desk.evaluate(() => document.activeElement?.hasAttribute('data-save-image')), 'Escape closes it and puts you back on Save image')
await desk.getByRole('button', { name: 'Save image' }).click()
await picker(desk).waitFor()
await desk.waitForTimeout(600)
await desk.locator('.recap .stage').click({ position: { x: 200, y: 200 } })
await picker(desk).waitFor({ state: 'detached' })
expect(true, 'a tap on the shrunken story closes it')

// --- Phone --------------------------------------------------------------------------------
const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage()
watchErrors(phone, errors)
await toLastSlide(phone)
await phone.getByRole('button', { name: 'Save image' }).tap()
await picker(phone).waitFor()
await phone.waitForTimeout(700)
await phone.screenshot({ path: `${OUT}/save-picker-phone.png` })
const pc = picker(phone).locator('[data-card]')
await pc.first().scrollIntoViewIfNeeded()
await pc.first().tap()
expect(await pc.first().getAttribute('aria-pressed') === 'true', 'a tap ticks a card')
// Press and hold: the slide shows above while held; letting go doesn't tick it.
const second = pc.nth(1)
await second.scrollIntoViewIfNeeded()
const b = await second.boundingBox()
const at = { pointerType: 'touch', isPrimary: true, button: 0, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2 }
await second.dispatchEvent('pointerdown', at)
await phone.waitForTimeout(600)
const peeked = await phone.locator('.peek').getAttribute('data-peek').catch(() => null)
await phone.screenshot({ path: `${OUT}/save-picker-phone-hold.png` })
await second.dispatchEvent('pointerup', at)
await second.dispatchEvent('click', at)
await phone.waitForTimeout(700)
expect(peeked === await second.getAttribute('data-card') && await phone.locator('.peek').count() === 0 && await second.getAttribute('aria-pressed') === 'false', 'press and hold shows that slide above, and letting go leaves it unticked', peeked)
// Saving on a phone hands the images to the share sheet ("Save 2 Images" to Photos).
await phone.evaluate(() => {
  Object.defineProperty(navigator, 'canShare', { value: d => !!d?.files?.length, configurable: true })
  Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = d.files.map(f => `${f.name} ${f.type} ${f.size > 20000}`) }, configurable: true })
})
await phone.waitForFunction(() => document.querySelector('[data-testid="save-images"]')?.textContent?.trim() === 'Save 2 images', null, { timeout: 30000 })
await picker(phone).getByTestId('save-images').tap()
await phone.waitForFunction(() => window.__shared, null, { timeout: 10000 })
const shared = await phone.evaluate(() => window.__shared)
expect(shared.length === 2 && /-01\.png image\/png true$/.test(shared[0]) && /elif\.png image\/png true$|[a-z]\.png image\/png true$/.test(shared[1]), 'on a phone Save hands both images to the share sheet, to save to Photos', shared)
const fits = await phone.evaluate(() => {
  const sheet = document.querySelector('[role="dialog"][aria-label="Save images"]').getBoundingClientRect()
  const story = document.querySelector('.recap .stage').getBoundingClientRect()
  return { overlap: Math.round(story.bottom - sheet.top), sheetBottom: Math.round(sheet.bottom), height: innerHeight }
})
expect(fits.overlap <= 0 && fits.sheetBottom <= fits.height, 'on a phone the story and the picker share the screen without overlapping', fits)

// --- Reduced motion ---------------------------------------------------------------------
const still = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage()
watchErrors(still, errors)
await toLastSlide(still)
await still.getByRole('button', { name: 'Save image' }).click()
await picker(still).waitFor()
const moving = await still.evaluate(() => [document.querySelector('[role="dialog"][aria-label="Save images"]'), document.querySelector('.recap .stage')].reduce((n, el) => n + el.getAnimations().length, 0))
expect(moving === 0, 'reduced motion: the picker and the story just appear', moving)

if (missing.length)
  console.log('failed requests:', missing)
await browser.close()
finish(errors)
