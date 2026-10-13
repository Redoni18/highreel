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
    throw createError({ statusCode: 400, message: 'Only a business Highreel has a form' })
  const template = getTemplate(campaign.template_key)
  const raw = normalizeRaw(body.raw as Record<string, unknown>, template)
  if (Object.values(raw).some(v => v.length > 2000))
    throw createError({ statusCode: 400, message: 'A value is too long' })
  const { data, errors } = validateRow(raw, template)

  const current = await businessRow(db, id)
  if (current?.token && hasErrors(errors))
    throw createError({ statusCode: 400, message: 'This Highreel is published: fix the highlighted fields to update it' })

  const saved = current
    ? await saveRecipient(db, current.id, { raw, data, errors, customer_id: 'business' })
    : await insertBusinessRow(db, id, { raw, data, errors })
  if (!saved)
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  // The home's "updated" column follows the campaign.
  await updateCampaign(db, id, {})
  return saved
})
