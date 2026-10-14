// Publish: check every row again (a page at a time, server/utils/sheet.ts),
// compute "top X%" among valid rows, give each valid row without a link a
// token, and mark the campaign published, all in one transaction. Publishing
// again refreshes ranks and links rows fixed since. Answers with counts; the
// browser reloads the rows (SPEC M2.14 P1).

import { nanoid } from 'nanoid'
import type { PublishResponse } from '#shared/types/recap'
import { templateFor } from '#shared/templates'
import { rankableColumns, storedRankKey } from '#shared/templates/own'
import { computeTopPercents } from '#shared/utils/validate'
import { bestTier } from '#shared/utils/pricing'

export default defineEventHandler(async (event): Promise<PublishResponse> => {
  const { db, anonymous } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { campaign } = await loadWorkspace(db, id)
  if (campaign.importing)
    throw createError({ statusCode: 409, message: 'The last sheet upload didn\'t finish. Upload the sheet again, then publish.' })
  const template = templateFor(campaign.template_key, campaign.settings)
  const by = template.rank?.by
  // "Top X%" by every number column too, so a "top" slide added after publishing has its numbers (M2.7).
  const ranked = rankableColumns(template)

  const rows = await checkSheet(db, id, template, { business: campaign.kind === 'business', collect: [by ?? '', ...ranked] })
  if (!rows.length)
    throw createError({ statusCode: 400, message: 'Nothing to publish yet' })

  const valid = rows.map(r => r.valid)
  const top = (k: number) => computeTopPercents(rows.map((r, i) => ({ valid: valid[i]!, value: r.values[k] })))
  const ranks = by ? top(0) : rows.map(() => null)
  const byColumn = ranked.map((col, j) => ({ key: storedRankKey(col), values: top(j + 1) }))

  // A row fixed after publishing could share its id with a row that already
  // has a link; the database refuses that, so it waits.
  const linkedIds = new Set(rows.filter(r => r.token).map(r => r.customer_id))
  let published = 0
  const updates = rows.map((row, i) => {
    let token: string | null = null
    if (!row.token && valid[i] && !linkedIds.has(row.customer_id)) {
      token = nanoid(12)
      linkedIds.add(row.customer_id)
    }
    if ((row.token || token) && valid[i])
      published++
    return {
      id: row.id,
      token,
      ranks: { computed_top_percent: ranks[i] ?? null, ...Object.fromEntries(byColumn.map(c => [c.key, c.values[i] ?? null])) },
    }
  })

  if (paysToPublish(event, anonymous, campaign)) {
    const covered = bestTier(campaign.paid)?.max ?? 0
    if (published > covered) {
      const fmt = (x: number) => x.toLocaleString('en-US')
      throw createError({
        statusCode: 402,
        message: covered
          ? `This campaign is paid for up to ${fmt(covered)} customers and ${fmt(published)} would get a Highreel. Upgrade it to publish them all.`
          : 'Pay for this campaign to publish it.',
      })
    }
  }

  try {
    await runBatch(db, [
      ...publishRowStatements(db, id, updates),
      campaignUpdateStatement(db, id, { status: 'published', published_at: campaign.published_at ?? new Date().toISOString() }),
    ])
  }
  catch (e) {
    if (e instanceof DuplicatePublishedId)
      throw createError({ statusCode: 409, message: 'Two rows with the same id would both get a link. Fix the duplicate and publish again.' })
    throw e
  }
  return { published, skipped: rows.length - published }
})
