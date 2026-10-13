// What sending looks like for this recap (SPEC M2.8, M2.9): the business's
// connected email account (none: email is off, WhatsApp and the links file
// remain), who gets it, and today's count against the account's limit.
// Bounced addresses (M2.11) are counted apart. Counted in SQL (M2.14 P1).

export default defineEventHandler(async (event) => {
  const { db, anonymous, email } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  await loadWorkspace(db, id) // 404 unless it's yours
  const [a, today, connection] = await Promise.all([audienceCounts(db, id), sendsSince(db, null, true), loadConnection(db)])
  return {
    connection: connection ? publicConnection(connection) : null,
    accountEmail: anonymous ? null : email,
    anonymous,
    pending: a.pending,
    sent: a.sent,
    failed: a.failed,
    noEmail: a.noEmail,
    unsubscribed: a.unsubscribed,
    bounced: a.bounced,
    sentToday: today,
    limit: connection?.daily_limit ?? 0,
  }
})
