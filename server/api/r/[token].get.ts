// Public recap payload: first name, stats, brand and copy. Never the email
// or the customer id (SPEC §5, §7.5). 404 unless the row is published.

import type { RecapPayload } from '#shared/types/recap'

export default defineEventHandler(async (event): Promise<RecapPayload> => {
  setResponseHeader(event, 'X-Robots-Tag', 'noindex')
  const { recap } = await loadRecapPayload(event, getRouterParam(event, 'token') ?? '')
  return recap
})
