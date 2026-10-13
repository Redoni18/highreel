// First-party counters for a recap: view, share, save, cta (SPEC §7.5).

import type { RecapEventType } from '#shared/types/recap'

const TYPES = new Set<RecapEventType>(['view', 'share', 'save', 'cta'])

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const body = await readBody<{ type?: string }>(event).catch(() => null)
  const type = body?.type as RecapEventType
  if (!isToken(token) || !TYPES.has(type))
    throw createError({ statusCode: 400, message: 'Bad event' })
  await recordRecapEvent(event, token, type)
  setResponseStatus(event, 204)
  return null
})
