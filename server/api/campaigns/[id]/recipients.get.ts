// The Sheet's rows, a page at a time (SPEC M2.14 P1): up to 5,000 rows after
// row `after` (-1 or none for the first page) and where the next page starts.
// The browser loads the pages one after another into the same grid.

import type { RecipientPage } from '#shared/types/recap'

export default defineEventHandler(async (event): Promise<RecipientPage> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const after = Number(getQuery(event).after ?? -1)
  if (!Number.isInteger(after) || after < -1)
    throw createError({ statusCode: 400, message: 'after: a row number' })
  await loadWorkspace(db, id) // 404 unless it's yours
  return recipientPage(db, id, after)
})
