// Block an account (SPEC M2.15): it's signed out, its address can't sign in
// again and its Highreels stop opening, until an admin unblocks it.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody<{ reason?: unknown }>(event).catch(() => null)
  await blockUser(admin, adminUserId(event), blockReason(body?.reason))
  return { ok: true }
})
