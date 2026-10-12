// The home's budget (SPEC M2.5 P3): under 300 ms with 10 campaigns × 10,000
// rows. Seeds a demo user's business with 100k recipients (inserted with the
// secret key so some have views, saves and shares), then times what
// GET /api/home asks Postgres for, as that user (RLS on), and cleans up.
//
//   supabase start && node scripts/perf-home.mjs

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => /^\w+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, opts)
const user = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, opts)
const { data: auth, error: authError } = await user.auth.signInAnonymously()
if (authError)
  throw authError

const { data: biz } = await user.from('businesses').insert({ owner_id: auth.user.id, name: 'Perf Farm' }).select().single()
const CAMPAIGNS = 10
const ROWS = 10_000
const t0 = Date.now()
for (let c = 0; c < CAMPAIGNS; c++) {
  const { data: camp } = await user.from('campaigns').insert({ business_id: biz.id, name: `Perf ${c}`, year: 2026, status: 'published' }).select().single()
  for (let from = 0; from < ROWS; from += 2000) {
    const rows = Array.from({ length: 2000 }, (_, k) => {
      const i = from + k
      const viewed = i % 3 === 0
      return {
        campaign_id: camp.id,
        row_index: i,
        customer_id: `u${i}`,
        first_name: `Name${i}`,
        raw: { customer_id: `u${i}`, first_name: `Name${i}`, active_days: String(i % 366) },
        data: { customer_id: `u${i}`, first_name: `Name${i}`, active_days: i % 366, items_created: i % 900 },
        errors: i % 97 === 0 ? { active_days: 'Needs a whole number' } : {},
        token: `${c}p${i}`.padEnd(12, 'x').slice(0, 12),
        view_count: viewed ? 1 + (i % 4) : 0,
        first_viewed_at: viewed ? new Date(Date.now() - i * 60_000).toISOString() : null,
        saved_at: i % 7 === 0 ? new Date(Date.now() - i * 30_000).toISOString() : null,
        shared_at: i % 19 === 0 ? new Date(Date.now() - i * 20_000).toISOString() : null,
      }
    })
    const { error } = await service.from('recipients').insert(rows)
    if (error)
      throw error
  }
}
console.log(`seeded ${CAMPAIGNS} × ${ROWS.toLocaleString('en-US')} rows in ${((Date.now() - t0) / 1000).toFixed(1)} s`)

async function homeQueries() {
  const t = performance.now()
  await user.auth.getUser()
  await user.from('businesses').select('*').maybeSingle()
  const [all, stats, activity] = await Promise.all([
    user.from('campaigns').select('id, name, year, template_key, kind, status, published_at, created_at'),
    user.rpc('campaign_stats', { p_year: 2026 }),
    user.rpc('recent_activity', { p_year: 2026, p_limit: 15 }),
  ])
  if (all.error || stats.error || activity.error)
    throw all.error ?? stats.error ?? activity.error
  return { ms: performance.now() - t, campaigns: stats.data.length, activity: activity.data.length }
}

await homeQueries() // warm up
const runs = []
for (let i = 0; i < 7; i++)
  runs.push(await homeQueries())
runs.sort((a, b) => a.ms - b.ms)
const median = runs[3]
console.log(`home queries: median ${median.ms.toFixed(0)} ms, worst ${runs.at(-1).ms.toFixed(0)} ms (${median.campaigns} campaigns, ${median.activity} activity lines)`)

await user.from('businesses').delete().eq('id', biz.id)
await service.auth.admin.deleteUser(auth.user.id)
const ok = median.ms < 300
console.log(ok ? 'within the 300 ms budget' : 'OVER the 300 ms budget')
process.exit(ok ? 0 : 1)
