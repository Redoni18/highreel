// Email each published row its recap (SPEC M2.8), through the business's own
// email account (M2.9: Highreel never sends from an address of its own). Up to
// 25 per call (SMTP is slower than an API); the Share tab calls again while
// `remaining` is above 0. Rows without an
// address, unsubscribed ones and rows already sent are skipped; a failed row
// waits for "Try again" (`retry`), so a bad address can't loop forever.
// `test` sends the previewed row's email to the owner instead. Runs as the
// user: RLS keeps it to their recaps, and every email is logged for the
// account's daily limit. Bounces (M2.11, server/utils/bounces.ts): addresses
// are checked before sending (typos of big providers, domains that take no
// mail), dead ones are remembered for the business and skipped from then on,
// an answer about the account stops the run with the server's words, and a
// batch where too many bounce pauses it.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Recipient } from '#shared/types/recap'
import type { Outcome } from '../../../utils/bounces'
import { recapEmail } from '#shared/utils/email'
import { hasErrors } from '#shared/utils/validate'

const BATCH = 25
/** Tests per business per day, so "Send a test" can't be a way around the limit. */
const TEST_LIMIT = 30

interface Body { test?: boolean, recipient_id?: string, retry?: boolean }

export default defineEventHandler(async (event) => {
  const { db, anonymous, email: owner } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = (await readBody<Body>(event).catch(() => null)) ?? {}
  // Someone else's recap is a 404 before anything else.
  const { business, campaign } = await loadWorkspace(db, id)
  if (anonymous || !owner)
    throw createError({ statusCode: 403, message: 'Add your email to keep your work first' })
  const connection = await loadConnection(db, business.id)
  if (!connection)
    throw createError({ statusCode: 400, message: 'Connect your email first: highlight reels go out from your own address' })
  const account = await accountFor(event, connection)
  if (campaign.kind === 'business')
    throw createError({ statusCode: 400, message: 'A business highlight reel is for posting: copy its link instead' })
  const rows = await loadRecipients(db, id)
  const origin = siteOrigin(event)

  const mailFor = (row: Recipient, to: string, test = false) => {
    const url = `${origin}/r/${row.token}`
    const unsubscribe = `${origin}/unsubscribe/${row.token}`
    const m = recapEmail({
      business,
      first_name: String(row.data.first_name ?? ''),
      year: campaign.year,
      copy: campaign.settings.email,
      url,
      unsubscribeUrl: unsubscribe,
    })
    return {
      to,
      subject: test ? `[Test] ${m.subject}` : m.subject,
      html: m.html,
      text: m.text,
      headers: {
        'List-Unsubscribe': `<${origin}/api/r/${row.token}/unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }
  }

  if (body.test) {
    const live = rows.filter(r => r.token && !hasErrors(r.errors))
    const row = live.find(r => r.id === body.recipient_id) ?? live[0]
    if (!row)
      throw createError({ statusCode: 400, message: 'Publish first: the test links to a real highlight reel' })
    if (await testsToday(db, business.id) >= TEST_LIMIT)
      throw createError({ statusCode: 429, message: `Up to ${TEST_LIMIT} tests a day` })
    const [result] = await sendMails(account, [mailFor(row, owner, true)])
    await log(db, [{ business_id: business.id, campaign_id: id, recipient_id: null, kind: 'test', ok: !!result?.ok, error: result?.error ?? null, provider_id: result?.id ?? null }])
    if (!result?.ok)
      throw createError({ statusCode: 502, message: `The test didn't go out: ${result?.error ?? 'unknown error'}` })
    return { to: owner }
  }

  if (campaign.status !== 'published')
    throw createError({ statusCode: 400, message: 'Publish first: the emails link to the highlight reels' })
  if (!campaign.settings.email_consent_at)
    throw createError({ statusCode: 400, message: 'Confirm these people are your customers first' })

  const [optouts, bounces] = await Promise.all([optedOut(db, business.id), bouncedAddresses(db, business.id)])
  const a = audience(rows, optouts, bounces, body.retry === true)
  const room = Math.max(0, account.daily_limit - await sentToday(db, business.id))
  if (a.pending.length && !room)
    throw createError({ statusCode: 429, message: `You've reached today's limit for ${account.from_email} (${account.daily_limit}). The rest can go tomorrow.` })

  const batch = a.pending.slice(0, Math.min(BATCH, room))
  // Typos and domains that take no mail are held back before anything is sent.
  const local = isLocalAccount(account)
  const held = await precheck(batch.map(r => addressOf(r)!), domain => local && reserved(`x@${domain}`))
  const toSend = batch.filter(r => !held.has(addressOf(r)!))
  const results = toSend.length ? await sendMails(account, toSend.map(r => mailFor(r, addressOf(r)!))) : []

  // Every row of the batch that got an answer; rows after a stop stay pending.
  const outcomes = new Map<Recipient, { ok: true } | { ok: false, kind: Outcome['kind'], reason: string }>()
  for (const r of batch) {
    const h = held.get(addressOf(r)!)
    if (h)
      outcomes.set(r, { ok: false, kind: h.kind, reason: h.reason })
  }
  toSend.forEach((r, i) => {
    const res = results[i]
    if (res)
      outcomes.set(r, res.ok ? { ok: true } : { ok: false, kind: res.kind ?? 'retry', reason: res.error ?? 'Not sent' })
  })
  const stop = results.find(r => r.kind === 'account')

  const now = new Date().toISOString()
  const okIds = [...outcomes].filter(([, o]) => o.ok).map(([r]) => r.id)
  // In fifties: the ids go in the request's URL.
  for (let i = 0; i < okIds.length; i += 50) {
    const { error } = await db.from('recipients').update({ emailed_at: now, email_error: null }).in('id', okIds.slice(i, i + 50))
    if (error)
      dbError(error, 'Saving sends')
  }
  const failures = [...outcomes].flatMap(([row, o]) => (o.ok || o.kind === 'account' ? [] : [{ row, kind: o.kind, reason: o.reason }]))
  for (const f of failures) {
    const { error } = await db.from('recipients').update({ email_error: (f.kind === 'bounce' ? `Bounced: ${f.reason}` : f.reason).slice(0, 200) }).eq('id', f.row.id)
    if (error)
      dbError(error, 'Saving sends')
  }
  const dead = failures.filter(f => f.kind === 'bounce')
  if (dead.length) {
    // One entry per address (two rows can share one).
    const byAddress = new Map(dead.map(f => [addressOf(f.row)!, f.reason.slice(0, 200)]))
    const { error } = await db.from('email_bounces').upsert(
      [...byAddress].map(([email, reason]) => ({ business_id: business.id, email, reason })),
      { onConflict: 'business_id,email', ignoreDuplicates: true },
    )
    if (error)
      dbError(error, 'Saving bounces')
  }
  if (results.length) {
    await log(db, toSend.slice(0, results.length).map((r, i) => ({
      business_id: business.id,
      campaign_id: id,
      recipient_id: r.id,
      kind: 'recap' as const,
      ok: !!results[i]?.ok,
      error: results[i]?.error?.slice(0, 200) ?? null,
      provider_id: results[i]?.id ?? null,
    })))
  }

  const answered = [...outcomes.values()].filter(o => o.ok || o.kind !== 'account').length
  const pause = tooManyBounces(dead.length, answered)
  const left = a.pending.length - answered
  const more = room > batch.length && !stop && !pause
  return {
    sent: okIds.length,
    failed: failures.length - dead.length,
    bounced: dead.length,
    // More to send now; when the limit cut the batch short, the rest waits for tomorrow.
    remaining: more ? left : 0,
    waiting: room > batch.length || stop || pause ? 0 : left,
    // Why the run stopped early: the account's server said no, or too many bounced.
    stopped: stop ? `Your mail server said: ${stop.error}` : pause ? `${dead.length} of the last ${answered} addresses bounced. Check the email column in your Sheet, then send the rest.` : null,
    sentAt: now,
  }
})

async function testsToday(db: SupabaseClient, businessId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await db.from('email_sends').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('kind', 'test').gte('created_at', since)
  if (error)
    dbError(error, 'Counting tests')
  return count ?? 0
}

async function log(db: SupabaseClient, entries: Record<string, unknown>[]) {
  const { error } = await db.from('email_sends').insert(entries)
  if (error)
    dbError(error, 'Logging sends')
}
