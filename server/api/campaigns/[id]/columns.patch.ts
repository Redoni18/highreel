// Change one of the recap's own columns (SPEC M2.7, the Sheet's column
// menu): its type, or remove it. Its slides keep what still fits
// (changeColumn), and every row is checked again against the new columns, so
// cells that don't fit the new type turn red like any other error. Published
// rows keep their links; a row with an error is skipped by /r until fixed.

import type { CampaignSettings, Recipient } from '#shared/types/recap'
import { getTemplate } from '#shared/templates'
import { changeColumn, withOwn } from '#shared/templates/own'
import type { ParsedRow } from '#shared/templates/types'
import { storableSettings } from '#shared/utils/recap'
import { validateSheet } from '#shared/utils/validate'

const TYPES = ['int', 'decimal', 'text', 'date'] as const

export default defineEventHandler(async (event): Promise<{ settings: CampaignSettings, recipients: Recipient[] }> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = await readBody<{ key?: unknown, type?: unknown, remove?: unknown }>(event)
  const { campaign } = await loadWorkspace(db, id)
  if (campaign.kind === 'business')
    throw createError({ statusCode: 400, message: 'A business highlight reel has no sheet columns' })
  const column = campaign.settings.columns?.find(c => c.key === body?.key)
  if (!column)
    throw createError({ statusCode: 404, message: 'Not one of this highlight reel\'s own columns' })
  if (body.remove !== true && !TYPES.includes(body.type as typeof TYPES[number]))
    throw createError({ statusCode: 400, message: 'Type: int, decimal, text or date' })

  const change = body.remove === true ? { remove: true as const } : { type: body.type as typeof TYPES[number] }
  const settings: CampaignSettings = { ...campaign.settings, ...changeColumn(campaign.settings, column.key, change) }
  const { error } = await db.from('campaigns').update({ settings: storableSettings(settings) }).eq('id', id)
  if (error)
    dbError(error, 'Saving columns')

  // Every row against the new columns. Ranks from the last publish stay until the next one.
  const template = withOwn(getTemplate(campaign.template_key), settings)
  const rows = await loadRecipients(db, id)
  const results = validateSheet(rows.map(r => r.raw), template)
  const kept = (data: ParsedRow) => Object.fromEntries(Object.entries(data).filter(([k]) => k === 'computed_top_percent' || k.startsWith('computed_top:')))
  const recipients = rows.length
    ? await bulkUpdateRecipients(db, rows.map((row, i) => ({
        id: row.id,
        customer_id: row.customer_id,
        data: { ...results[i]!.data, ...kept(row.data) },
        errors: results[i]!.errors,
        token: row.token,
      })))
    : []

  return { settings, recipients }
})
