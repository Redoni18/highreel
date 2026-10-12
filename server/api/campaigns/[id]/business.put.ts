// Save a business recap's form (SPEC M2.5 P4): its one row, validated like a
// sheet row. A published recap keeps its link and updates in place, so it
// only accepts a valid form.

import type { Recipient } from '#shared/types/recap'
import { getTemplate } from '#shared/templates'
import { hasErrors, normalizeRaw, validateRow } from '#shared/utils/validate'

export default defineEventHandler(async (event): Promise<Recipient> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = await readBody<{ raw?: unknown }>(event)
  if (!body?.raw || typeof body.raw !== 'object')
    throw createError({ statusCode: 400, message: 'Expected { raw: { column: value } }' })

  const { campaign } = await loadWorkspace(db, id) // 404 unless it's yours
  if (campaign.kind !== 'business')
    throw createError({ statusCode: 400, message: 'Only a business highlight reel has a form' })
  const template = getTemplate(campaign.template_key)
  const raw = normalizeRaw(body.raw as Record<string, unknown>, template)
  if (Object.values(raw).some(v => v.length > 2000))
    throw createError({ statusCode: 400, message: 'A value is too long' })
  const { data, errors } = validateRow(raw, template)

  const { data: current, error } = await db.from('recipients').select('id, token').eq('campaign_id', id).order('row_index').limit(1).maybeSingle()
  if (error)
    dbError(error, 'Loading the highlight reel')
  if (current?.token && hasErrors(errors))
    throw createError({ statusCode: 400, message: 'This highlight reel is published: fix the highlighted fields to update it' })

  const values = { raw, data, errors, customer_id: 'business', updated_at: new Date().toISOString() }
  const saved = current
    ? await db.from('recipients').update(values).eq('id', current.id).select(RECIPIENT_COLUMNS).single()
    : await db.from('recipients').insert({ ...values, campaign_id: id, row_index: 0 }).select(RECIPIENT_COLUMNS).single()
  if (saved.error)
    dbError(saved.error, 'Saving the highlight reel')
  // The home's "updated" column follows the campaign.
  await db.from('campaigns').update({ updated_at: new Date().toISOString() }).eq('id', id)
  return saved.data as unknown as Recipient
})
