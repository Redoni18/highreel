// Checks "every business sees only its own data" (SPEC M2) against the local
// Supabase, the way the browser would talk to it: publishable key + a user
// session. Two demo users, A and B; B must not read or change anything of A's.
//
//   supabase start && corepack pnpm check:rls
//
// Exits non-zero on the first broken rule.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => /^\w+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const url = env.SUPABASE_URL
const key = env.SUPABASE_KEY
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

let failed = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!ok)
    failed++
}

async function demoUser() {
  const c = client()
  const { data, error } = await c.auth.signInAnonymously()
  if (error)
    throw error
  return { c, id: data.user.id }
}

const A = await demoUser()
const B = await demoUser()

// A sets up a business, a campaign and a published row.
const biz = await A.c.from('businesses').insert({ owner_id: A.id, name: 'A Farm' }).select().single()
check('A creates its business', !biz.error, biz.error?.message)
const camp = await A.c.from('campaigns').insert({ business_id: biz.data.id, name: 'A 2026', year: 2026 }).select().single()
check('A creates a campaign', !camp.error, camp.error?.message)
const row = await A.c.from('recipients').insert({ campaign_id: camp.data.id, row_index: 0, customer_id: 'a1', raw: {}, data: {}, errors: {} }).select().single()
check('A adds a recipient', !row.error, row.error?.message)

// B sees nothing of A's
for (const table of ['businesses', 'campaigns', 'recipients']) {
  const r = await B.c.from(table).select('id')
  check(`B reads no ${table} of A's`, !r.error && r.data.length === 0, r.error?.message ?? `${r.data.length} rows`)
}
const upd = await B.c.from('campaigns').update({ name: 'hacked' }).eq('id', camp.data.id).select()
check('B can\'t rename A\'s campaign', !upd.error && upd.data.length === 0, upd.error?.message ?? `${upd.data.length} rows changed`)
const del = await B.c.from('recipients').delete().eq('id', row.data.id).select()
check('B can\'t delete A\'s recipient', !del.error && del.data.length === 0, del.error?.message ?? `${del.data.length} rows deleted`)
const ins = await B.c.from('recipients').insert({ campaign_id: camp.data.id, row_index: 1, customer_id: 'b1' })
check('B can\'t add rows to A\'s campaign', !!ins.error, ins.error?.code)
// Your brand (SPEC M2.6) saves through the user's session: another business's brand is out of reach.
const rebrand = await B.c.from('businesses').update({ name: 'hacked', accent_color: '#000000', logo_path: null }).eq('id', biz.data.id).select()
check('B can\'t change A\'s brand (name, colour, logo)', !rebrand.error && rebrand.data.length === 0, rebrand.error?.message ?? `${rebrand.data.length} rows changed`)
const steal = await B.c.from('businesses').insert({ owner_id: A.id, name: 'not mine' })
check('B can\'t create a business owned by A', !!steal.error, steal.error?.code)
const bulk = await B.c.rpc('bulk_update_recipients', { p_rows: [{ id: row.data.id, customer_id: 'x', data: {}, errors: {}, token: 'BBBBBBBBBBBB' }] })
check('B\'s bulk update can\'t touch A\'s rows', !bulk.error && bulk.data.length === 0, bulk.error?.message ?? `${bulk.data?.length} rows`)

// The home's counts (SPEC M2.5 P3) run as the caller, so RLS applies.
const service = createClient(url, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
await A.c.from('recipients').update({ token: `rls${Date.now().toString(36)}`.slice(0, 12).padEnd(12, 'x'), first_name: 'Ana' }).eq('id', row.data.id)
const tok = (await A.c.from('recipients').select('token').eq('id', row.data.id).single()).data.token
await service.rpc('record_recap_event', { p_token: tok, p_type: 'view' })
const aStats = await A.c.rpc('campaign_stats', { p_year: 2026 })
check('A counts its own campaign', !aStats.error && aStats.data.some(s => s.campaign_id === camp.data.id && s.row_count === 1 && s.views === 1), aStats.error?.message ?? JSON.stringify(aStats.data))
const bStats = await B.c.rpc('campaign_stats', { p_year: 2026 })
check('B\'s counts include nothing of A\'s', !bStats.error && !bStats.data.some(s => s.campaign_id === camp.data.id), bStats.error?.message ?? `${bStats.data.length} rows`)
const aAct = await A.c.rpc('recent_activity', { p_year: 2026, p_limit: 10 })
check('A sees its recap activity', !aAct.error && aAct.data.length === 1 && aAct.data[0].first_name === 'Ana', aAct.error?.message ?? JSON.stringify(aAct.data))
const bAct = await B.c.rpc('recent_activity', { p_year: 2026, p_limit: 10 })
check('B sees none of A\'s activity', !bAct.error && bAct.data.length === 0, bAct.error?.message ?? `${bAct.data.length} rows`)
const aSums = await A.c.rpc('campaign_sums', { p_year: 2026 })
check('A adds up its own recaps (business recap suggestions)', !aSums.error && aSums.data.some(s => s.campaign_id === camp.data.id && s.published === 1), aSums.error?.message ?? JSON.stringify(aSums.data))
const bSums = await B.c.rpc('campaign_sums', { p_year: 2026 })
check('B\'s sums include nothing of A\'s', !bSums.error && !bSums.data.some(s => s.campaign_id === camp.data.id), bSums.error?.message ?? `${bSums.data.length} rows`)
const anonStats = await client().rpc('campaign_stats', { p_year: 2026 })
check('Signed-out visitors can\'t count recaps', !!anonStats.error, anonStats.error?.code)

// Owners can't fake their counters; only the server records events.
const counters = await A.c.from('recipients').update({ view_count: 999 }).eq('id', row.data.id)
check('A can\'t edit view counters', !!counters.error, counters.error?.code)
const event = await A.c.rpc('record_recap_event', { p_token: 'x', p_type: 'view' })
check('A can\'t call the event counter', !!event.error, event.error?.code)

// Sending (SPEC M2.8): the send log, opt-outs and "emailed" stay with their business.
const log = await A.c.from('email_sends').insert({ business_id: biz.data.id, campaign_id: camp.data.id, recipient_id: row.data.id, kind: 'recap', ok: true }).select().single()
check('A logs a send for its own recap', !log.error, log.error?.message)
const bLogRead = await B.c.from('email_sends').select('id')
check('B reads none of A\'s send log', !bLogRead.error && bLogRead.data.length === 0, bLogRead.error?.message ?? `${bLogRead.data.length} rows`)
const bLogFake = await B.c.from('email_sends').insert({ business_id: biz.data.id, kind: 'recap', ok: true })
check('B can\'t log sends against A\'s business (to use up its limit)', !!bLogFake.error, bLogFake.error?.code)
const bOwnBiz = await B.c.from('businesses').insert({ owner_id: B.id, name: 'B Shop' }).select().single()
const bLogCross = await B.c.from('email_sends').insert({ business_id: bOwnBiz.data?.id, campaign_id: camp.data.id, kind: 'recap', ok: true })
check('B can\'t log a send for A\'s campaign under its own business', !!bLogCross.error, bLogCross.error?.code)
const aLogEdit = await A.c.from('email_sends').update({ ok: false }).eq('id', log.data?.id).select()
check('A can\'t rewrite its send log', !!aLogEdit.error || aLogEdit.data.length === 0, aLogEdit.error?.code ?? `${aLogEdit.data.length} rows changed`)
const aLogDel = await A.c.from('email_sends').delete().eq('id', log.data?.id).select()
check('A can\'t delete from its send log', !!aLogDel.error || aLogDel.data.length === 0, aLogDel.error?.code ?? `${aLogDel.data.length} rows deleted`)
const optout = await service.from('email_optouts').insert({ business_id: biz.data.id, email: 'leaver@example.com' })
check('The unsubscribe route (secret key) records an opt-out', !optout.error, optout.error?.message)
const aOpt = await A.c.from('email_optouts').select('email')
check('A reads its own opt-outs', !aOpt.error && aOpt.data.length === 1, aOpt.error?.message ?? `${aOpt.data.length} rows`)
const bOpt = await B.c.from('email_optouts').select('email')
check('B reads none of A\'s opt-outs', !bOpt.error && bOpt.data.length === 0, bOpt.error?.message ?? `${bOpt.data.length} rows`)
const aOptAdd = await A.c.from('email_optouts').insert({ business_id: biz.data.id, email: 'someone@example.com' })
check('Owners can\'t write opt-outs (only the unsubscribe link can)', !!aOptAdd.error, aOptAdd.error?.code)
const aOptDel = await A.c.from('email_optouts').delete().eq('business_id', biz.data.id).select()
check('Owners can\'t resubscribe people', !!aOptDel.error || aOptDel.data.length === 0, aOptDel.error?.code ?? `${aOptDel.data.length} rows deleted`)
// Bounced addresses (SPEC M2.11): the owner's send route records them; nobody else sees them, nobody rewrites them.
const bounce = await A.c.from('email_bounces').insert({ business_id: biz.data.id, email: 'gone@farm.test', reason: '550 5.1.1 User unknown' })
check('A records a bounce for its own business', !bounce.error, bounce.error?.message)
const bBounceRead = await B.c.from('email_bounces').select('email')
check('B reads none of A\'s bounced addresses', !bBounceRead.error && bBounceRead.data.length === 0, bBounceRead.error?.message ?? `${bBounceRead.data.length} rows`)
const bBounceAdd = await B.c.from('email_bounces').insert({ business_id: biz.data.id, email: 'loyal@farm.test', reason: 'x' })
check('B can\'t mark A\'s customers as bounced (to stop their emails)', !!bBounceAdd.error, bBounceAdd.error?.code)
const aBounceEdit = await A.c.from('email_bounces').update({ reason: 'x' }).eq('business_id', biz.data.id).select()
check('Bounces aren\'t rewritten', !!aBounceEdit.error || aBounceEdit.data.length === 0, aBounceEdit.error?.code ?? `${aBounceEdit.data.length} rows changed`)
const aBounceDel = await A.c.from('email_bounces').delete().eq('business_id', biz.data.id).select()
check('Bounces aren\'t cleared', !!aBounceDel.error || aBounceDel.data.length === 0, aBounceDel.error?.code ?? `${aBounceDel.data.length} rows deleted`)
const anonBounce = await client().from('email_bounces').select('email')
check('Signed-out visitors read no bounces', !!anonBounce.error || anonBounce.data.length === 0, anonBounce.error?.code ?? `${anonBounce.data.length} rows`)
const emailed = await A.c.from('recipients').update({ emailed_at: new Date().toISOString(), email_error: null }).eq('id', row.data.id).select('emailed_at')
check('A marks its own row emailed', !emailed.error && emailed.data.length === 1, emailed.error?.message ?? `${emailed.data.length} rows`)
const bEmailed = await B.c.from('recipients').update({ emailed_at: null }).eq('id', row.data.id).select()
check('B can\'t touch A\'s "emailed"', !bEmailed.error && bEmailed.data.length === 0, bEmailed.error?.message ?? `${bEmailed.data.length} rows changed`)
const anonLog = await client().from('email_sends').select('id')
check('Signed-out visitors read no send log', !!anonLog.error || anonLog.data.length === 0, anonLog.error?.code ?? `${anonLog.data.length} rows`)
// The business's own email account (SPEC M2.9): only its owner sees or changes it.
const conn = await A.c.from('email_connections').insert({ business_id: biz.data.id, provider: 'gmail', host: 'smtp.gmail.com', port: 465, secure: true, username: 'a@farm.test', password_enc: 'v1:x:y', from_email: 'a@farm.test', from_name: 'A Farm' })
check('A connects its email account', !conn.error, conn.error?.message)
const bConnRead = await B.c.from('email_connections').select('business_id, password_enc')
check('B reads none of A\'s email account (or its encrypted password)', !bConnRead.error && bConnRead.data.length === 0, bConnRead.error?.message ?? `${bConnRead.data.length} rows`)
const bConnEdit = await B.c.from('email_connections').update({ from_email: 'evil@b.test' }).eq('business_id', biz.data.id).select()
check('B can\'t change A\'s sending address', !bConnEdit.error && bConnEdit.data.length === 0, bConnEdit.error?.message ?? `${bConnEdit.data.length} rows changed`)
const bConnAdd = await B.c.from('email_connections').insert({ business_id: biz.data.id, provider: 'other', host: 'evil.test', port: 587, from_email: 'x@evil.test', from_name: 'x' })
check('B can\'t connect an account for A\'s business', !!bConnAdd.error, bConnAdd.error?.code)
const bConnDel = await B.c.from('email_connections').delete().eq('business_id', biz.data.id).select()
check('B can\'t disconnect A\'s account', !bConnDel.error && bConnDel.data.length === 0, bConnDel.error?.message ?? `${bConnDel.data.length} rows deleted`)
const anonConn = await client().from('email_connections').select('business_id')
check('Signed-out visitors read no email accounts', !!anonConn.error || anonConn.data.length === 0, anonConn.error?.code ?? `${anonConn.data.length} rows`)
const waMark = await A.c.from('recipients').update({ whatsapp_at: new Date().toISOString() }).eq('id', row.data.id).select('whatsapp_at')
check('A marks its own row sent on WhatsApp', !waMark.error && waMark.data.length === 1, waMark.error?.message ?? `${waMark.data.length} rows`)
const bWa = await B.c.from('recipients').update({ whatsapp_at: null }).eq('id', row.data.id).select()
check('B can\'t touch A\'s WhatsApp marks', !bWa.error && bWa.data.length === 0, bWa.error?.message ?? `${bWa.data.length} rows changed`)

if (bOwnBiz.data)
  await B.c.from('businesses').delete().eq('id', bOwnBiz.data.id)

// Storage: A's folder is A's alone (SPEC M2c)
const png = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), c => c.charCodeAt(0))], { type: 'image/png' })
const path = `${biz.data.id}/${camp.data.id}/check.png`
const up = await A.c.storage.from('media').upload(path, png, { contentType: 'image/png' })
check('A uploads into its own folder', !up.error, up.error?.message)
const bDown = await B.c.storage.from('media').download(path)
check('B can\'t download A\'s photo', !!bDown.error, bDown.error?.message)
const bList = await B.c.storage.from('media').list(`${biz.data.id}/${camp.data.id}`)
check('B can\'t list A\'s folder', !bList.error && bList.data.length === 0, bList.error?.message ?? `${bList.data.length} files`)
const bSign = await B.c.storage.from('media').createSignedUrl(path, 60)
check('B can\'t sign a link to A\'s photo', !!bSign.error, bSign.error?.message)
const bUp = await B.c.storage.from('media').upload(`${biz.data.id}/${camp.data.id}/intruder.png`, png, { contentType: 'image/png' })
check('B can\'t upload into A\'s folder', !!bUp.error, bUp.error?.message)
const bOwnRoot = await B.c.storage.from('media').upload(`not-a-business/intruder.png`, png, { contentType: 'image/png' })
check('Nobody can upload outside a business folder', !!bOwnRoot.error, bOwnRoot.error?.message)
const aDel = await A.c.storage.from('media').remove([path])
check('A removes its photo', !aDel.error && aDel.data.length === 1, aDel.error?.message)

// No session at all
const anon = client()
const anonRead = await anon.from('recipients').select('id')
check('Signed-out visitors read nothing', !!anonRead.error || anonRead.data.length === 0, anonRead.error?.code ?? `${anonRead.data.length} rows`)
const anonList = await anon.storage.from('media').list(biz.data.id)
check('Signed-out visitors list no media', !anonList.error && anonList.data.length === 0 || !!anonList.error, anonList.error?.message ?? `${anonList.data.length} files`)

// Clean up A's test data (cascades to the campaign and row).
await A.c.from('businesses').delete().eq('id', biz.data.id)

console.log(failed ? `\n${failed} check(s) failed` : '\nAll isolation checks passed')
process.exit(failed ? 1 : 0)
