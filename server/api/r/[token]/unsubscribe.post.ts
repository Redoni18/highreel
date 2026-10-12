// Unsubscribe this recap's address from its business's recap emails (SPEC
// M2.8). Mail apps' one-click unsubscribe (List-Unsubscribe-Post) posts here
// and gets JSON; the unsubscribe page's form posts `page=1` and is sent back
// to the page, so the button works before (or without) JavaScript.

export default defineEventHandler(async (event) => {
  const { db, email, businessId } = await unsubscribeTarget(event)
  if (email) {
    const { error } = await db.from('email_optouts').upsert({ business_id: businessId, email }, { onConflict: 'business_id,email', ignoreDuplicates: true })
    if (error)
      dbError(error, 'Unsubscribing')
  }
  const body = await readBody<Record<string, unknown> | string | null>(event).catch(() => null)
  if (body && typeof body === 'object' && body.page === '1')
    return sendRedirect(event, `/unsubscribe/${getRouterParam(event, 'token')}`, 303)
  return { done: true }
})
