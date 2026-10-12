// Clear all rows of a draft campaign (SPEC M2b).

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { campaign } = await loadWorkspace(db, id)
  if (campaign.status !== 'draft')
    throw createError({ statusCode: 409, message: 'Published campaigns keep their rows. Delete the campaign instead.' })
  const { error } = await db.from('recipients').delete().eq('campaign_id', id)
  if (error)
    dbError(error, 'Clearing rows')
  setResponseStatus(event, 204)
  return null
})
