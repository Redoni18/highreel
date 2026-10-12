// Delete a campaign, its rows (cascade) and its photos in Storage.

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { business } = await loadWorkspace(db, id) // 404 unless it's yours
  await removeFolder(db, `${business.id}/${id}`)
  const { error } = await db.from('campaigns').delete().eq('id', id)
  if (error)
    dbError(error, 'Deleting campaign')
  setResponseStatus(event, 204)
  return null
})
