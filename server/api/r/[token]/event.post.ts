// First-party counters for a recap: view, share, save, cta (SPEC §7.5).

import type { RecapEventType } from '#shared/types/recap'

const TYPES = new Set<RecapEventType>(['view', 'share', 'save', 'cta'])

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const body = await readBody<{ type?: string }>(event).catch(() => null)
  const type = body?.type as RecapEventType
  if (!/^[\w-]{12}$/.test(token) || !TYPES.has(type))
    throw createError({ statusCode: 400, message: 'Bad event' })

  const { error } = await tokenClient(event).rpc('record_recap_event', { p_token: token, p_type: type })
  if (error)
    dbError(error, 'Recording event')
  setResponseStatus(event, 204)
  return null
})
