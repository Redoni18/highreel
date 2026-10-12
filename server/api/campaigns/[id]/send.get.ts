// What sending looks like for this recap (SPEC M2.8, M2.9): the business's
// connected email account (none: email is off, WhatsApp and the links file
// remain), who gets it, and today's count against the account's limit.
// Bounced addresses (M2.11) are counted apart.

export default defineEventHandler(async (event) => {
  const { db, anonymous, email } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { business } = await loadWorkspace(db, id)
  const [rows, optouts, bounces, today, connection] = await Promise.all([loadRecipients(db, id), optedOut(db, business.id), bouncedAddresses(db, business.id), sentToday(db, business.id), loadConnection(db, business.id)])
  const a = audience(rows, optouts, bounces)
  return {
    connection: connection ? publicConnection(connection) : null,
    accountEmail: anonymous ? null : email,
    anonymous,
    pending: a.pending.length,
    sent: a.sent,
    failed: a.failed,
    noEmail: a.noEmail,
    unsubscribed: a.unsubscribed,
    bounced: a.bounced,
    sentToday: today,
    limit: connection?.daily_limit ?? 0,
  }
})
