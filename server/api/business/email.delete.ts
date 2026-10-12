// Disconnect the business's email account (SPEC M2.9): the saved password goes with it.

export default defineEventHandler(async (event) => {
  const { db, userId } = await requireUser(event)
  const business = await ensureBusiness(db, userId)
  const { error } = await db.from('email_connections').delete().eq('business_id', business.id)
  if (error)
    dbError(error, 'Disconnecting your email')
  setResponseStatus(event, 204)
  return null
})
