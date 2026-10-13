import type { Workspace } from '#shared/types/recap'

export default defineEventHandler(async (event): Promise<Workspace> => {
  const { db } = await requireUser(event)
  return loadSignedWorkspace(event, db, requireUuid(getRouterParam(event, 'id')))
})
