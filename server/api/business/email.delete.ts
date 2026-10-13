// Disconnect the business's email account (SPEC M2.9): the saved password goes with it.

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  await deleteConnection(db)
  setResponseStatus(event, 204)
  return null
})
