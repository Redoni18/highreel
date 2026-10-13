// Delete a campaign, its rows (cascade), and its photos and link previews in R2.

export default defineEventHandler(async (event) => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { business } = await loadWorkspace(db, id) // 404 unless it's yours
  await removeFolder(event, `${business.id}/${id}`)
  await deleteCampaign(db, id)
  setResponseStatus(event, 204)
  return null
})
