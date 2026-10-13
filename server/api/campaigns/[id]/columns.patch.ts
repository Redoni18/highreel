// Change one of the recap's own columns (SPEC M2.7, the Sheet's column
// menu): its type, or remove it. Its slides keep what still fits
// (changeColumn), and every row is checked again against the new columns
// (a page at a time, server/utils/sheet.ts), so cells that don't fit the new
// type turn red like any other error. Published rows keep their links; a row
// with an error is skipped by /r until fixed. The browser reloads the rows.

import type { CampaignSettings } from '#shared/types/recap'
import { getTemplate } from '#shared/templates'
import { changeColumn, withOwn } from '#shared/templates/own'
import { storableSettings } from '#shared/utils/recap'

const TYPES = ['int', 'decimal', 'text', 'date'] as const

export default defineEventHandler(async (event): Promise<{ settings: CampaignSettings }> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = await readBody<{ key?: unknown, type?: unknown, remove?: unknown }>(event)
  const { campaign } = await loadWorkspace(db, id)
  if (campaign.kind === 'business')
    throw createError({ statusCode: 400, message: 'A business Highreel has no sheet columns' })
  const column = campaign.settings.columns?.find(c => c.key === body?.key)
  if (!column)
    throw createError({ statusCode: 404, message: 'Not one of this Highreel\'s own columns' })
  if (body.remove !== true && !TYPES.includes(body.type as typeof TYPES[number]))
    throw createError({ statusCode: 400, message: 'Type: int, decimal, text or date' })

  const change = body.remove === true ? { remove: true as const } : { type: body.type as typeof TYPES[number] }
  const settings: CampaignSettings = { ...campaign.settings, ...changeColumn(campaign.settings, column.key, change) }
  await updateCampaign(db, id, { settings: storableSettings(settings) })
  await checkSheet(db, id, withOwn(getTemplate(campaign.template_key), settings))
  return { settings }
})
