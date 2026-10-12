// Publish: re-validate every row, compute "top X%" among valid rows, give each
// valid row without a link a token, and mark the campaign published.
// Publishing again refreshes ranks and links rows fixed since.

import { nanoid } from 'nanoid'
import type { PublishResponse } from '#shared/types/recap'
import { idColumnOf, templateFor } from '#shared/templates'
import { rankableColumns, storedRankKey } from '#shared/templates/own'
import { computeTopPercents, hasErrors, validateSheet } from '#shared/utils/validate'

export default defineEventHandler(async (event): Promise<PublishResponse> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { campaign } = await loadWorkspace(db, id)
  const template = templateFor(campaign.template_key, campaign.settings)
  const idColumn = idColumnOf(template)

  const rows = await loadRecipients(db, id)
  if (!rows.length)
    throw createError({ statusCode: 400, message: 'Nothing to publish yet' })

  const results = validateSheet(rows.map(r => r.raw), template)
  const valid = results.map(r => !hasErrors(r.errors))
  const by = template.rank?.by
  const ranks = by
    ? computeTopPercents(results.map((r, i) => ({ valid: valid[i]!, value: r.data[by] })))
    : results.map(() => null)
  // "Top X%" by every number column, so a "top" slide added after publishing has its numbers (M2.7).
  const ranked = rankableColumns(template).map(col => ({
    key: storedRankKey(col),
    values: computeTopPercents(results.map((r, i) => ({ valid: valid[i]!, value: r.data[col] }))),
  }))

  // A row fixed after publishing could share its id with a row that already
  // has a link; the database refuses that, so it waits.
  const linkedIds = new Set(rows.filter(r => r.token).map(r => r.raw[idColumn] ?? ''))

  let published = 0
  const updates = rows.map((row, i) => {
    let token = row.token
    if (!token && valid[i] && !linkedIds.has(row.raw[idColumn] ?? '')) {
      token = nanoid(12)
      linkedIds.add(row.raw[idColumn] ?? '')
    }
    if (token && valid[i])
      published++
    return {
      id: row.id,
      // A business recap's one row has no id column (SPEC M2.5 P4).
      customer_id: campaign.kind === 'business' ? 'business' : row.raw[idColumn] ?? '',
      data: { ...results[i]!.data, computed_top_percent: ranks[i], ...Object.fromEntries(ranked.map(r => [r.key, r.values[i]])) },
      errors: results[i]!.errors,
      token,
    }
  })

  const recipients = await bulkUpdateRecipients(db, updates)

  const { error } = await db
    .from('campaigns')
    .update({ status: 'published', published_at: campaign.published_at ?? new Date().toISOString() })
    .eq('id', id)
  if (error)
    dbError(error, 'Publishing campaign')

  return { published, skipped: rows.length - published, recipients }
})
