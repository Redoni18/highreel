// Email each published row its recap (SPEC M2.8), through the business's own
// email account (M2.9: Highreel never sends from an address of its own). Up to
// 25 per call (SMTP is slower than an API); the Share tab calls again while
// `remaining` is above 0. Rows without an
// address, unsubscribed ones and rows already sent are skipped; a failed row
// waits for "Try again" (`retry`), so a bad address can't loop forever.
// `test` sends the previewed row's email to the owner instead. Only this
// business's recaps (server/utils/db.ts), and every email is logged for the
// account's daily limit. Bounces (M2.11, server/utils/bounces.ts): addresses
// are checked before sending (typos of big providers, domains that take no
// mail), dead ones are remembered for the business and skipped from then on,
// an answer about the account stops the run with the server's words, and a
// batch where too many bounce pauses it.

import type { Recipient } from '#shared/types/recap'
import type { Outcome } from '../../../utils/bounces'
import { resolveLook } from '#shared/templates/designs'
import { recapEmail } from '#shared/utils/email'

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
  const connection = await loadConnection(db)
  if (!connection)
    throw createError({ statusCode: 400, message: 'Connect your email first: Highreels go out from your own address' })
  const account = await accountFor(event, connection)
  if (campaign.kind === 'business')
    throw createError({ statusCode: 400, message: 'A business Highreel is for posting: copy its link instead' })
  const origin = siteOrigin(event)

  const mailFor = (row: Recipient, to: string, test = false) => {
    const url = `${origin}/r/${row.token}`
    const unsubscribe = `${origin}/unsubscribe/${row.token}`
    const m = recapEmail({
      business,
      accent: resolveLook(campaign.settings.look).accent,
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
    const row = await testRow(db, id, body.recipient_id)
    if (!row)
      throw createError({ statusCode: 400, message: 'Publish first: the test links to a real Highreel' })
    if (await sendsSince(db, 'test', false) >= TEST_LIMIT)
      throw createError({ statusCode: 429, message: `Up to ${TEST_LIMIT} tests a day` })
    const [result] = await sendMails(account, [mailFor(row, owner, true)])
    await logSends(db, [{ campaign_id: id, recipient_id: null, kind: 'test', ok: !!result?.ok, error: result?.error ?? null, provider_id: result?.id ?? null }])
    if (!result?.ok)
      throw createError({ statusCode: 502, message: `The test didn't go out: ${result?.error ?? 'unknown error'}` })
    return { to: owner }
  }

  if (campaign.status !== 'published')
    throw createError({ statusCode: 400, message: 'Publish first: the emails link to the Highreels' })
  if (!campaign.settings.email_consent_at)
    throw createError({ statusCode: 400, message: 'Confirm these people are your customers first' })

  const retry = body.retry === true
  const [a, sent] = await Promise.all([audienceCounts(db, id, retry), sendsSince(db, null, true)])
  const room = Math.max(0, account.daily_limit - sent)
  if (a.pending && !room)
    throw createError({ statusCode: 429, message: `You've reached today's limit for ${account.from_email} (${account.daily_limit}). The rest can go tomorrow.` })

  const batch = await pendingRows(db, id, retry, Math.min(BATCH, room))
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
  await markSent(db, id, okIds, now)
  const failures = [...outcomes].flatMap(([row, o]) => (o.ok || o.kind === 'account' ? [] : [{ row, kind: o.kind, reason: o.reason }]))
  await markFailed(db, id, failures.map(f => ({ id: f.row.id, error: (f.kind === 'bounce' ? `Bounced: ${f.reason}` : f.reason).slice(0, 200) })))
  const dead = failures.filter(f => f.kind === 'bounce')
  // One entry per address (two rows can share one).
  const byAddress = new Map(dead.map(f => [addressOf(f.row)!, f.reason.slice(0, 200)]))
  await addBounces(db, [...byAddress].map(([email, reason]) => ({ email, reason })))
  if (results.length) {
    await logSends(db, toSend.slice(0, results.length).map((r, i) => ({
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
  const left = a.pending - answered
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
