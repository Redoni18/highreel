// One cell edit: save the raw value, re-validate the row, and re-check
// duplicates of the id column for every row the edit touches (SPEC §4.2).

import type { ParsedRow, RowErrors } from '#shared/templates/types'
import type { PatchRecipientResponse, Recipient } from '#shared/types/recap'
import { idColumnOf, templateFor } from '#shared/templates'
import { duplicateErrors, validateCell, validateRow } from '#shared/utils/validate'

export default defineEventHandler(async (event): Promise<PatchRecipientResponse> => {
  const id = requireUuid(getRouterParam(event, 'id'))
  const { db } = await requireUser(event)
  const body = await readBody<{ column?: unknown, value?: unknown }>(event)

  const { row: current, campaignId, templateKey, settings } = await recipientWithCampaign(db, id)
  const template = templateFor(templateKey, settings)
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
  const peers = await rowsWithIds(db, campaignId, [...new Set([oldId, newId].filter(Boolean))], id)
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

  let saved: Recipient | null
  try {
    saved = await saveRecipient(db, id, {
      raw,
      data,
      errors,
      customer_id: newId,
      first_name: (data.first_name as string | null | undefined) ?? null,
      email: (data.email as string | null | undefined) ?? null,
      // A new address gets a fresh try (M2.11): the old one's error or bounce isn't its.
      ...(String(data.email ?? '') !== String((current.data as ParsedRow).email ?? '') ? { email_error: null } : {}),
    })
  }
  catch (e) {
    if (e instanceof DuplicatePublishedId)
      throw createError({ statusCode: 409, message: `Another published row already uses ${idColumn} "${newId}"` })
    throw e
  }
  if (!saved)
    throw createError({ statusCode: 404, message: 'Row not found' })

  const others: Recipient[] = []
  const changed: Array<{ id: string, data: ParsedRow, errors: RowErrors }> = []
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
    changed.push({ id: peer.id, data: peer.data, errors: peerErrors })
    others.push({ ...peer, errors: peerErrors })
  }
  await runBatch(db, revalidatedRowStatements(db, campaignId, changed))

  return { row: saved, others }
})
