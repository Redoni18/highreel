// The home's budget (SPEC M2.5 P3, M2.14 P1): under 300 ms with 10 campaigns
// × 10,000 rows. A demo session gets a business; 100k rows go straight into
// the local D1 database (some with views, saves and shares, a few with
// errors); then GET /api/home is timed through the app, and the business is
// deleted again.
//
//   corepack pnpm dev            # in another terminal (or E2E_BASE=http://localhost:3047 for wrangler dev)
//   node scripts/perf-home.mjs

import { demoSession, launch, sql } from '../tests/e2e/lib.mjs'

const CAMPAIGNS = 10
const ROWS = 10_000

const browser = await launch()
const page = await (await browser.newContext()).newPage()
await demoSession(page)
const home = () => page.evaluate(async () => {
  const t = performance.now()
  const r = await fetch('/api/home?year=2026')
  const body = await r.json()
  return { ms: performance.now() - t, status: r.status, campaigns: body.campaigns?.length, activity: body.activity?.length, published: body.campaigns?.reduce((n, c) => n + c.published, 0) }
})
const { business } = await page.evaluate(async () => (await fetch('/api/business')).json())

const t0 = Date.now()
for (let c = 0; c < CAMPAIGNS; c++) {
  const id = crypto.randomUUID()
  sql(`insert into campaigns (id, business_id, name, year, status) values ('${id}', '${business.id}', 'Perf ${c}', 2026, 'published')`)
  sql(`insert into recipients (id, campaign_id, row_index, customer_id, first_name, raw, data, errors, has_errors, token, view_count, first_viewed_at, saved_at, shared_at)
    with recursive n(i) as (select 0 union all select i + 1 from n where i < ${ROWS - 1})
    select lower(hex(randomblob(16))), '${id}', i, 'u' || i, 'Name' || i,
      json_object('customer_id', 'u' || i, 'first_name', 'Name' || i, 'active_days', cast(i % 366 as text)),
      json_object('customer_id', 'u' || i, 'first_name', 'Name' || i, 'active_days', i % 366, 'items_created', i % 900),
      case when i % 97 = 0 then '{"active_days":"Needs a whole number"}' else '{}' end,
      i % 97 = 0,
      substr('${c}p' || i || 'xxxxxxxxxxxx', 1, 12),
      case when i % 3 = 0 then 1 + i % 4 else 0 end,
      case when i % 3 = 0 then strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || i || ' minutes') end,
      case when i % 7 = 0 then strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || (i * 30) || ' seconds') end,
      case when i % 19 = 0 then strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || (i * 20) || ' seconds') end
    from n`)
}
console.log(`seeded ${CAMPAIGNS} × ${ROWS.toLocaleString('en-US')} rows in ${((Date.now() - t0) / 1000).toFixed(1)} s`)

await home() // warm up
const runs = []
for (let i = 0; i < 7; i++)
  runs.push(await home())
runs.sort((a, b) => a.ms - b.ms)
const median = runs[3]
console.log(`GET /api/home: median ${median.ms.toFixed(0)} ms, worst ${runs.at(-1).ms.toFixed(0)} ms (${median.campaigns} campaigns with the demo's own draft, ${median.published?.toLocaleString('en-US')} published, ${median.activity} activity lines)`)

sql(`delete from businesses where id = '${business.id}'`)
const left = sql(`select count(*) as n from campaigns where business_id = '${business.id}'`)[0].n
await browser.close()
const ok = median.status === 200 && median.campaigns >= CAMPAIGNS && median.ms < 300
console.log(left ? `cleanup left ${left} campaigns` : 'cleaned up')
console.log(ok ? 'within the 300 ms budget' : 'OVER the 300 ms budget (or the home failed)')
process.exit(ok ? 0 : 1)
