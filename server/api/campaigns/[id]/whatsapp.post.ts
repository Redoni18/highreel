// WhatsApp, one tap per person (SPEC M2.9): Share opens that person's chat and
// marks them sent (`sent: false` is Undo). We can't see whether the message
// was really sent in WhatsApp; this is the business's own checklist.

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = (await readBody<{ recipient_id?: string, sent?: boolean }>(event)) ?? {}
  const recipient = requireUuid(body.recipient_id, 'recipient')
  const at = body.sent === false ? null : new Date().toISOString()
  const { data, error } = await db
    .from('recipients')
    .update({ whatsapp_at: at })
    .eq('id', recipient)
    .eq('campaign_id', id)
    .not('token', 'is', null)
    .select('id, whatsapp_at')
    .maybeSingle()
  if (error)
    dbError(error, 'Saving WhatsApp')
  if (!data)
    throw createError({ statusCode: 404, message: 'Not found' })
  return data
})
