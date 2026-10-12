// Test files for the browser checks, all made up: two drawn "group photos",
// a logo, a farm's own .xlsx (Albanian/English headers, Excel dates) and the
// 10,000-row Habitly sheet. Written to tests/e2e/.fixtures (gitignored).

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { FIX, launch } from './lib.mjs'

mkdirSync(FIX, { recursive: true })

const browser = await launch()
const page = await browser.newPage()
const images = await page.evaluate(() => {
  function draw(w, h, paint, type) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    paint(c.getContext('2d'), w, h)
    return c.toDataURL(type, 0.9)
  }
  const farm = (sky, grass, sun) => (ctx, w, h) => {
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(w * 0.8, h * 0.22, h * 0.1, 0, 7); ctx.fill()
    ctx.fillStyle = grass; ctx.fillRect(0, h * 0.62, w, h)
    ctx.fillStyle = '#8B5A2B'; ctx.fillRect(w * 0.12, h * 0.38, w * 0.22, h * 0.26)
    ctx.fillStyle = '#B22222'; ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.4); ctx.lineTo(w * 0.23, h * 0.26); ctx.lineTo(w * 0.36, h * 0.4); ctx.fill()
    for (let i = 0; i < 6; i++) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(w * (0.45 + i * 0.08), h * 0.72, w * 0.03, h * 0.025, 0, 0, 7); ctx.fill() }
  }
  return {
    'farm-1.jpg': draw(2400, 1600, farm('#87CEEB', '#4CAF50', '#FFD54F'), 'image/jpeg'),
    'farm-2.jpg': draw(1600, 2000, farm('#FFB74D', '#689F38', '#FFF59D'), 'image/jpeg'),
    'logo.png': draw(600, 600, (ctx, w, h) => {
      ctx.fillStyle = '#2E7D32'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.42, 0, 7); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = 'bold 260px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('F', w / 2, h / 2 + 10)
    }, 'image/png'),
  }
})
await browser.close()
for (const [name, url] of Object.entries(images))
  writeFileSync(`${FIX}/${name}`, Buffer.from(url.split(',')[1], 'base64'))

execFileSync('python3', [new URL('./make-xlsx.py', import.meta.url).pathname, `${FIX}/ferma-korrik.xlsx`])
execFileSync('node', [new URL('../../scripts/generate-sample.mjs', import.meta.url).pathname, '--rows', '10000', '--out', `${FIX}/sample-10000.csv`])
console.log(`fixtures written to ${FIX}`)
