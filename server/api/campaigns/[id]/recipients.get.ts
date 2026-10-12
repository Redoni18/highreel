import type { Recipient } from '#shared/types/recap'

export default defineEventHandler(async (event): Promise<Recipient[]> => {
  const { db } = await requireUser(event)
  return loadRecipients(db, requireUuid(getRouterParam(event, 'id')))
})
