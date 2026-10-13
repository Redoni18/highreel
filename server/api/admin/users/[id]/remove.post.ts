// Remove an account or a demo now (SPEC M2.15), with its business, Highreels
// and files; `block: true` also keeps its address from signing up again. A
// POST with a body, not a DELETE: Nitro on Cloudflare drops a DELETE's body.
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody<{ block?: unknown, reason?: unknown }>(event).catch(() => null)
  await removeUser(admin, bindings(event).MEDIA, adminUserId(event), { block: body?.block === true, reason: blockReason(body?.reason) })
  return { ok: true }
})
