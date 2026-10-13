// Clear all rows of a draft campaign (SPEC M2b), and any unfinished upload.

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { campaign } = await loadWorkspace(db, id)
  if (campaign.status !== 'draft')
    throw createError({ statusCode: 409, message: 'Published campaigns keep their rows. Delete the campaign instead.' })
  await runBatch(db, [clearRowsStatement(db, id), campaignUpdateStatement(db, id, { import_next: null })])
  setResponseStatus(event, 204)
  return null
})
