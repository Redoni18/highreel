// Unblock an address (SPEC M2.15): { email }, in the body (a DELETE's body
// doesn't reach the route on Cloudflare, and a query string would put the
// address in the request logs).
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody<{ email?: unknown }>(event).catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  if (!email || email.length > 320 || !await unblockEmail(admin, email))
    throw createError({ statusCode: 404, message: 'That address isn\'t blocked' })
  return { ok: true }
})
