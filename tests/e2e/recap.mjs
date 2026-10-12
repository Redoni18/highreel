// The recap player on a phone and desktop (SPEC §5.2): tap, tap back,
// auto-advance after the scene's duration (M2.5 P1), press-and-hold pause,
// keys, Save image (1080×1920 PNG), no third-party requests, 9:16 frame on
// desktop, noindex.
import { BASE, demoSession, expect, finish, launch, OUT, publish, saveSummaryImage, tokenFor, watchErrors } from './lib.mjs'

const browser = await launch()
const setup = await (await browser.newContext()).newPage()
await demoSession(setup)
await setup.getByRole('button', { name: 'Use sample data' }).click()
await setup.waitForSelector('[data-row-id]')
await publish(setup)
const token = await tokenFor(setup, 'r => r.token && r.row_index === 1')

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, acceptDownloads: true })
const p = await ctx.newPage()
const errors = []
watchErrors(p, errors)
const requests = []
p.on('request', r => requests.push(r.url()))
const res = await p.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' })
expect(res.headers()['x-robots-tag'] === 'noindex', 'recap page is noindex')
const slide = () => p.evaluate(() => document.querySelector('.recap .sr-only[aria-live]')?.textContent)
expect(await slide() === 'Slide 1 of 7', 'starts on the cover', await slide())
await p.mouse.click(300, 400)
await p.waitForTimeout(800)
expect(await slide() === 'Slide 2 of 7', 'tap right → next', await slide())
await p.mouse.click(80, 400)
await p.waitForTimeout(500)
expect(await slide() === 'Slide 1 of 7', 'tap left → back', await slide())
await p.mouse.click(300, 400)
const t0 = Date.now()
const duration = await p.evaluate(() => Number([...document.querySelectorAll('.recap .slide')].at(-1)?.dataset.duration))
await p.waitForFunction(() => document.querySelector('.recap .sr-only[aria-live]')?.textContent?.startsWith('Slide 3'), null, { timeout: 10000 })
const advanced = Date.now() - t0
expect(duration >= 5000 && duration <= 7000 && Math.abs(advanced - duration) < 700, 'auto-advances after the scene\'s duration', `${advanced} ms for ${duration} ms`)
await p.mouse.move(300, 400)
await p.mouse.down()
await p.waitForTimeout(6000)
expect(await slide() === 'Slide 3 of 7', 'press and hold pauses', await slide())
await p.mouse.up()
await p.waitForTimeout(300)
expect(await slide() === 'Slide 3 of 7', 'releasing a hold does not navigate', await slide())
for (let i = 0; i < 10; i++) {
  await p.keyboard.press('ArrowRight')
  await p.waitForTimeout(120)
}
await p.waitForTimeout(1200)
expect(await slide() === 'Slide 7 of 7', 'arrow keys reach the share slide', await slide())
expect((await p.locator('.made-with').innerText()).trim() === 'Made with Highreel', 'the share slide links back with "Made with Highreel"')
const download = await saveSummaryImage(p)
const file = `${OUT}/${download.suggestedFilename()}`
await download.saveAs(file)
const size = await p.evaluate(async (b64) => {
  const img = new Image()
  img.src = `data:image/png;base64,${b64}`
  await img.decode()
  return `${img.naturalWidth}x${img.naturalHeight}`
}, (await import('node:fs')).readFileSync(file).toString('base64'))
expect(size === '1080x1920', 'Save image downloads a 1080×1920 PNG', size)
await p.keyboard.press('ArrowLeft')
await p.waitForTimeout(600)
expect(await slide() === 'Slide 6 of 7', 'arrow keys work with a button focused', await slide())
const outside = requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:') && !u.includes('/storage/v1/object/sign/'))
expect(outside.length === 0, 'no third-party requests', outside)

const desk = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await desk.goto(`${BASE}/r/${token}`, { waitUntil: 'networkidle' })
const box = await desk.locator('.recap').boundingBox()
expect(Math.abs(box.width / box.height - 9 / 16) < 0.01, 'desktop shows a 9:16 frame', `${Math.round(box.width)}×${Math.round(box.height)}`)
await browser.close()
finish(errors)
