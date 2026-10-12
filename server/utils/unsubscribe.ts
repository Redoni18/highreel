// Unsubscribing from a business's recap emails (SPEC M2.8), addressed by the
// recap's token like the other public recap routes, so it uses the secret key.
// Only the row's address and its business are read; nothing else leaves.

import type { H3Event } from 'h3'

export async function unsubscribeTarget(event: H3Event) {
  const token = getRouterParam(event, 'token') ?? ''
  if (!/^[\w-]{12}$/.test(token))
    throw createError({ statusCode: 404, message: 'Not found' })
  const db = tokenClient(event)
  const { data, error } = await db
    .from('recipients')
    .select('data, campaigns!inner(business_id, businesses!inner(name, accent_color))')
    .eq('token', token)
    .maybeSingle()
  if (error)
    dbError(error, 'Loading the highlight reel')
  const row = data as unknown as { data: Record<string, unknown>, campaigns: { business_id: string, businesses: { name: string, accent_color: string } } } | null
  if (!row)
    throw createError({ statusCode: 404, message: 'Not found' })
  const email = isEmail(row.data.email) ? row.data.email.trim().toLowerCase() : null
  return { db, email, businessId: row.campaigns.business_id, business: row.campaigns.businesses }
}
