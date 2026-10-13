// Big sheets on the Worker (SPEC M2.14 P0, P1): against the built Worker on
// `wrangler dev`, a demo session imports a 10,000- and a 50,000-row sheet
// (in parts of 5,000 rows, as the browser does), loads the grid (a page at a
// time), publishes, exports and opens Share's send status, then opens one
// reel (page, data, link preview). Prints each request's time and size and,
// through workerd's inspector, the isolate's JS heap (the peak seen while it
// ran; Workers allow 128 MB per isolate) and its CPU time (profiler samples;
// 30 s by default, 5 min at most). P1's bar: no request grows the heap by
// more than 40 MB.
//
//   corepack pnpm build && corepack pnpm exec wrangler dev --port 3047 --inspector-port 9339
//   node scripts/worker-sheets.mjs [10000 50000]
//
// E2E_BASE and INSPECTOR change the Worker's address and inspector port.
// Local workerd enforces neither limit, so the numbers say how close we are.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'
import { chromium } from 'playwright-core'

const BASE = process.env.E2E_BASE ?? 'http://localhost:3047'
const INSPECTOR = process.env.INSPECTOR ?? '9339'
const sizes = process.argv.slice(2).map(Number).filter(Boolean)
if (!sizes.length)
  sizes.push(10_000, 50_000)
const FIX = fileURLToPath(new URL('../tests/e2e/.fixtures/', import.meta.url))
const sleep = ms => new Promise(r => setTimeout(r, ms))
const mb = n => `${(n / 1024 / 1024).toFixed(1)} MB`

/** A Chrome DevTools Protocol session with the Worker's isolate. */
async function inspector() {
  const [target] = await fetch(`http://127.0.0.1:${INSPECTOR}/json`).then(r => r.json())
  // wrangler's inspector proxy only takes DevTools' origin.
  const ws = new WebSocket(target.webSocketDebuggerUrl, { headers: { origin: 'https://devtools.devprod.cloudflare.dev' } })
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let next = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    pending.get(d.id)?.(d)
    pending.delete(d.id)
  }
  // Some calls never get an answer from workerd: give up after 10 s.
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++next
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method}: no answer`))
    }, 10_000)
    pending.set(id, (d) => {
      clearTimeout(timer)
      if (d.error)
        reject(new Error(`${method}: ${d.error.message}`))
      else
        resolve(d.result)
    })
    ws.send(JSON.stringify({ id, method, params }))
  })
  await send('Profiler.enable')
  await send('Profiler.setSamplingInterval', { interval: 1000 })
  return { send, close: () => ws.close() }
}

/** CPU time in a V8 profile: every sample that isn't idle. */
function cpuMs(profile) {
  const idle = new Set(profile.nodes.filter(n => n.callFrame.functionName === '(idle)').map(n => n.id))
  let us = 0
  profile.samples.forEach((node, i) => {
    if (!idle.has(node))
      us += profile.timeDeltas[i] ?? 0
  })
  return us / 1000
}

// INSPECTOR=0: times only.
const cdp = INSPECTOR === '0' ? null : await inspector()
const results = []

/** Run one request, watching the isolate's heap and CPU while it runs. */
async function measure(size, step, run) {
  if (!cdp) {
    const t = performance.now()
    const out = await run()
    const row = { size, step, status: out.status, ms: Math.round(performance.now() - t), body: out.bytes ? mb(out.bytes) : '', note: out.note ?? '' }
    results.push(row)
    console.log(`${String(size).padStart(6)}  ${step.padEnd(12)} ${out.status}  ${String(row.ms).padStart(6)} ms  ${row.body} ${row.note}`)
    return out
  }
  // (No HeapProfiler.collectGarbage first: workerd never answers it.)
  const before = await cdp.send('Runtime.getHeapUsage')
  let peakUsed = before.usedSize
  let peakTotal = before.totalSize
  let sampling = true
  // The inspector answers between the isolate's tasks, so this sees the heap
  // while the request waits on I/O, not inside one long synchronous stretch.
  const sampler = (async () => {
    while (sampling) {
      const u = await cdp.send('Runtime.getHeapUsage').catch(() => null)
      peakUsed = Math.max(peakUsed, u?.usedSize ?? 0)
      peakTotal = Math.max(peakTotal, u?.totalSize ?? 0)
      await sleep(20)
    }
  })()
  await cdp.send('Profiler.start')
  const t = performance.now()
  const out = await run()
  const ms = performance.now() - t
  const { profile } = await cdp.send('Profiler.stop').catch(() => ({ profile: { nodes: [], samples: [], timeDeltas: [] } }))
  sampling = false
  await sampler
  const row = { size, step, status: out.status, ms: Math.round(ms), cpuMs: Math.round(cpuMs(profile)), heapPeak: mb(peakUsed), heapTotalPeak: mb(peakTotal), heapBefore: mb(before.usedSize), body: out.bytes ? mb(out.bytes) : '', note: out.note ?? '' }
  results.push(row)
  console.log(`${String(size).padStart(6)}  ${step.padEnd(12)} ${out.status}  ${String(row.ms).padStart(6)} ms  cpu ${String(row.cpuMs).padStart(6)} ms  heap ${row.heapBefore} → peak ${row.heapPeak} (total ${row.heapTotalPeak})  ${row.body} ${row.note}`)
  return out
}

// A demo session, started in the browser like the landing's "Try the demo".
const browser = await chromium.launch({ channel: 'chrome' })
const page = await (await browser.newContext()).newPage()
await page.goto(`${BASE}/login?demo=1`)
await page.waitForURL('**/app/c/*', { timeout: 30000 })
const cookie = (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join('; ')
await browser.close()

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const buf = Buffer.from(await res.arrayBuffer())
  let json = null
  try {
    json = JSON.parse(buf.toString('utf8'))
  }
  catch {}
  return { status: res.status, bytes: buf.length, json, text: json ? null : buf.toString('utf8') }
}

for (const size of sizes) {
  const file = `${FIX}sample-${size}.csv`
  if (!existsSync(file))
    execFileSync('node', [fileURLToPath(new URL('./generate-sample.mjs', import.meta.url)), '--rows', String(size), '--out', file], { stdio: 'inherit' })
  const rows = Papa.parse(readFileSync(file, 'utf8'), { header: true, skipEmptyLines: true }).data
  const created = await call('POST', '/api/campaigns', { name: `Worker check ${size}`, year: 2026, template_key: 'app' })
  const id = created.json?.id ?? created.json?.campaign?.id
  if (!id)
    throw new Error(`Couldn't create a campaign: ${created.status} ${JSON.stringify(created.json).slice(0, 200)}`)

  const PART = 5000
  const parts = Math.ceil(rows.length / PART)
  let imported = null
  for (let part = 0; part < parts; part++) {
    const slice = rows.slice(part * PART, (part + 1) * PART)
    imported = await measure(size, `import ${part + 1}/${parts}`, async () => {
      const r = await call('POST', `/api/campaigns/${id}/import`, { part, parts, rows: slice })
      return { ...r, note: r.json?.total !== undefined ? `${r.json.total} rows in, request ${mb(JSON.stringify({ rows: slice }).length)}` : (r.json?.message ?? r.text?.slice(0, 120)) }
    })
    if (imported.status !== 200)
      break
  }
  if (imported?.status !== 200)
    continue
  await measure(size, 'campaign', () => call('GET', `/api/campaigns/${id}`))
  for (let after = -1, page = 1; after !== null; page++) {
    const r = await measure(size, `grid page ${page}`, async () => {
      const r = await call('GET', `/api/campaigns/${id}/recipients?after=${after}`)
      return { ...r, note: r.json?.rows ? `${r.json.rows.length} rows` : r.json?.message }
    })
    after = r.json?.next ?? null
  }
  await measure(size, 'publish', async () => {
    const r = await call('POST', `/api/campaigns/${id}/publish`)
    return { ...r, note: r.json?.published !== undefined ? `${r.json.published} published` : r.json?.message }
  })
  let token = null
  await measure(size, 'export', async () => {
    const r = await call('GET', `/api/campaigns/${id}/export.csv`)
    token = r.text?.match(/\/r\/([\w-]+)/)?.[1] ?? null
    return { ...r, note: r.text ? `${r.text.trim().split('\n').length - 1} lines` : r.json?.message }
  })
  // One highlight reel as its customer opens it: the page, its data, the link preview.
  if (token) {
    await measure(size, 'reel page', () => call('GET', `/r/${token}`))
    await measure(size, 'reel data', () => call('GET', `/api/r/${token}`))
    await measure(size, 'link preview', () => call('GET', `/api/r/${token}/og.png`))
  }
  await measure(size, 'send status', async () => {
    const r = await call('GET', `/api/campaigns/${id}/send`)
    return { ...r, note: r.json?.pending !== undefined ? `${r.json.pending} pending` : (r.json?.message ?? '') }
  })
  await measure(size, 'home', () => call('GET', '/api/home?year=2026'))
}

cdp?.close()
console.log(`\n${JSON.stringify(results)}`)
// P1's bar (SPEC M2.14): every request under 40 MB of heap growth, and all of them answered.
const over = results.filter(r => r.status !== 200 || (r.heapPeak && Number.parseFloat(r.heapPeak) - Number.parseFloat(r.heapBefore) > 40))
console.log(over.length ? `\n${over.length} request(s) failed or grew the heap by more than 40 MB: ${over.map(r => `${r.size} ${r.step}`).join(', ')}` : '\nEvery request answered within 40 MB of heap growth')
process.exit(over.length ? 1 : 0)
