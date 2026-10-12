// One cell edit: save the raw value, re-validate the row, and re-check
// duplicates of the id column for every row the edit touches (SPEC §4.2).

import type { ParsedRow } from '#shared/templates/types'
import type { PatchRecipientResponse, Recipient } from '#shared/types/recap'
import { idColumnOf, templateFor } from '#shared/templates'
import { normalizeSettings } from '#shared/utils/recap'
import { duplicateErrors, validateCell, validateRow } from '#shared/utils/validate'

export default defineEventHandler(async (event): Promise<PatchRecipientResponse> => {
  const id = requireUuid(getRouterParam(event, 'id'))
  const { db } = await requireUser(event)
  const body = await readBody<{ column?: unknown, value?: unknown }>(event)

  const { data: current, error } = await db
    .from('recipients')
    .select(`${RECIPIENT_COLUMNS}, campaign_id, campaigns(template_key, settings)`)
    .eq('id', id)
    .maybeSingle()
  if (error)
    dbError(error, 'Loading row')
  if (!current)
    throw createError({ statusCode: 404, message: 'Row not found' })

  const campaign = current.campaigns as unknown as { template_key: string, settings: unknown }
  const template = templateFor(campaign.template_key, normalizeSettings(campaign.settings))
  const column = template.columns.find(c => c.key === body.column)
  if (!column)
    throw createError({ statusCode: 400, message: 'Unknown column' })
  if (typeof body.value !== 'string' || body.value.length > 2000)
    throw createError({ statusCode: 400, message: 'Value must be text' })

  const idColumn = idColumnOf(template)
  const idCol = template.columns.find(c => c.key === idColumn)!
  const oldId = current.raw[idColumn] ?? ''
  const raw = { ...current.raw, [column.key]: body.value.trim() }
  const newId = raw[idColumn] ?? ''
  const { data, errors } = validateRow(raw, template)

  // Rows that share the old or new id: their duplicate status may change.
  const ids = [...new Set([oldId, newId].filter(Boolean))]
  let peers: Recipient[] = []
  if (ids.length) {
    const res = await db
      .from('recipients')
      .select(RECIPIENT_COLUMNS)
      .eq('campaign_id', current.campaign_id)
      .in('customer_id', ids)
      .neq('id', id)
    if (res.error)
      dbError(res.error, 'Checking duplicates')
    peers = res.data as unknown as Recipient[]
  }
  const dups = duplicateErrors([
    { rowIndex: current.row_index, value: newId },
    ...peers.map(p => ({ rowIndex: p.row_index, value: p.raw[idColumn] ?? '' })),
  ])
  if (!errors[idColumn] && dups.has(current.row_index))
    errors[idColumn] = dups.get(current.row_index)!

  // Keep the ranks computed at publish until the next publish.
  for (const [key, value] of Object.entries(current.data as ParsedRow)) {
    if (key === 'computed_top_percent' || key.startsWith('computed_top:'))
      data[key] = value
  }

  const { data: saved, error: saveError } = await db
    .from('recipients')
    .update({
      raw,
      data,
      errors,
      customer_id: newId,
      first_name: data.first_name ?? null,
      email: data.email ?? null,
      // A new address gets a fresh try (M2.11): the old one's error or bounce isn't its.
      ...(String(data.email ?? '') !== String((current.data as ParsedRow).email ?? '') ? { email_error: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(RECIPIENT_COLUMNS)
    .single()
  if (saveError) {
    if (saveError.code === '23505')
      throw createError({ statusCode: 409, message: `Another published row already uses ${idColumn} "${newId}"` })
    dbError(saveError, 'Saving row')
  }

  const others: Recipient[] = []
  for (const peer of peers) {
    const peerId = peer.raw[idColumn] ?? ''
    const message = validateCell(idCol, peerId).error ?? dups.get(peer.row_index)
    if ((peer.errors[idColumn] ?? undefined) === message)
      continue
    const peerErrors = { ...peer.errors }
    if (message)
      peerErrors[idColumn] = message
    else
      delete peerErrors[idColumn]
    const res = await db.from('recipients').update({ errors: peerErrors }).eq('id', peer.id).select(RECIPIENT_COLUMNS).single()
    if (res.error)
      dbError(res.error, 'Updating duplicate')
    others.push(res.data as unknown as Recipient)
  }

  return { row: saved as unknown as Recipient, others }
})
