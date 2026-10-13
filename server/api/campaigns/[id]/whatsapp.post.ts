// WhatsApp, one tap per person (SPEC M2.9): Share opens that person's chat and
// marks them sent (`sent: false` is Undo). We can't see whether the message
// was really sent in WhatsApp; this is the business's own checklist.

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = (await readBody<{ recipient_id?: string, sent?: boolean }>(event)) ?? {}
  const recipient = requireUuid(body.recipient_id, 'recipient')
  const row = await setWhatsapp(db, id, recipient, body.sent === false ? null : new Date().toISOString())
  if (!row)
    throw createError({ statusCode: 404, message: 'Not found' })
  return row
})
