// Replace all recipients of a draft campaign with parsed sheet rows. The
// browser parses the file; the server validates again (SPEC §4.2). The sheet
// may bring the recap's own columns and slide list (M2.7), saved first so the
// rows are validated against them.
//
// A sheet arrives in parts of up to 5,000 rows, in order (SPEC M2.14 P1):
// { part, parts, rows }. Part 0 clears the old rows and saves the columns;
// each part is one transaction. Until the last part lands the campaign
// remembers the upload is unfinished (the Sheet says so; publish waits). After
// the last part, ids repeated across parts are flagged like any duplicate.
// The answer is counts; the browser loads the rows a page at a time.

import type { CampaignSettings } from '#shared/types/recap'
import type { ParsedRow, RowErrors } from '#shared/templates/types'
import { getTemplate, idColumnOf, templateFor } from '#shared/templates'
import { cleanColumns, cleanSlides, ownKeyOk } from '#shared/templates/own'
import { storableSettings } from '#shared/utils/recap'
import { checkHeaders, duplicateErrors, normalizeRaw, validateRow } from '#shared/utils/validate'

const MAX_ROWS = 50_000

export default defineEventHandler(async (event): Promise<{ total: number, errors: number, settings: CampaignSettings }> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = await readBody<{ rows?: unknown, part?: unknown, parts?: unknown, columns?: unknown, slides?: unknown }>(event)
  const rows = body?.rows
  const part = body?.part === undefined ? 0 : Number(body.part)
  const parts = body?.parts === undefined ? 1 : Number(body.parts)
  if (!Array.isArray(rows) || rows.some(r => !r || typeof r !== 'object'))
    throw createError({ statusCode: 400, message: 'Expected { rows: [...] }' })
  if (rows.length === 0)
    throw createError({ statusCode: 400, message: 'The sheet has no rows' })
  if (!Number.isInteger(parts) || parts < 1 || !Number.isInteger(part) || part < 0 || part >= parts)
    throw createError({ statusCode: 400, message: 'Expected part 0 to parts - 1' })
  if (parts * PAGE_ROWS > MAX_ROWS)
    throw createError({ statusCode: 413, message: `Up to ${MAX_ROWS.toLocaleString('en-US')} rows per campaign` })
  if (rows.length > PAGE_ROWS)
    throw createError({ statusCode: 413, message: `Send the sheet in parts of up to ${PAGE_ROWS.toLocaleString('en-US')} rows` })

  const { campaign } = await loadWorkspace(db, id)
  if (campaign.kind === 'business')
    throw createError({ statusCode: 400, message: 'A business Highreel is filled in with its form, not a sheet' })
  if (campaign.status !== 'draft')
    throw createError({ statusCode: 409, message: 'This campaign is published. Edit rows in the grid instead, or start a new campaign.' })
  if (part > 0 && await importNext(db, id) !== part)
    throw createError({ statusCode: 409, message: 'That upload was interrupted. Upload the sheet again.' })

  let settings = campaign.settings
  const first: ReturnType<typeof campaignUpdateStatement>[] = []
  if (part === 0) {
    if (body.columns !== undefined) {
      const base = getTemplate(campaign.template_key)
      settings = { ...settings, columns: cleanColumns(body.columns).filter(c => ownKeyOk(c.key, base)), slides: cleanSlides(body.slides) }
      first.push(campaignUpdateStatement(db, id, { settings: storableSettings(settings) }))
    }
    first.push(clearRowsStatement(db, id))
  }

  const template = templateFor(campaign.template_key, settings)
  const { missing } = checkHeaders(Object.keys(rows[0] as object), template)
  if (missing.length)
    throw createError({ statusCode: 400, message: `Missing required columns: ${missing.join(', ')}` })

  // Row numbers count from the sheet's first row, across parts.
  const start = part * PAGE_ROWS
  const idColumn = idColumnOf(template)
  const raws = (rows as Record<string, unknown>[]).map(r => normalizeRaw(r, template))
  const results = raws.map(raw => validateRow(raw, template))
  for (const [rowIndex, message] of duplicateErrors(raws.map((raw, i) => ({ rowIndex: start + i, value: raw[idColumn] ?? '' }))))
    results[rowIndex - start]!.errors[idColumn] ??= message

  const last = part === parts - 1
  await runBatch(db, [
    ...first,
    ...insertRowStatements(db, id, raws.map((raw, i) => ({
      row_index: start + i,
      customer_id: raw[idColumn] ?? '',
      first_name: (results[i]!.data.first_name as string | null | undefined) ?? null,
      email: (results[i]!.data.email as string | null | undefined) ?? null,
      raw,
      data: results[i]!.data,
      errors: results[i]!.errors,
    }))),
    campaignUpdateStatement(db, id, { import_next: last ? null : part + 1 }),
  ])

  // Ids used again in a later part: flag them now that the whole sheet is in.
  if (last && parts > 1) {
    const repeated = await duplicateIdRows(db, id)
    const dups = duplicateErrors(repeated.map(r => ({ rowIndex: r.row_index, value: r.customer_id })))
    const ids = [...new Set(repeated.map(r => r.customer_id))]
    const changed: Array<{ id: string, data: ParsedRow, errors: RowErrors }> = []
    for (const row of await rowsWithIds(db, id, ids, '')) {
      const message = dups.get(row.row_index)
      if (message && !row.errors[idColumn])
        changed.push({ id: row.id, data: row.data, errors: { ...row.errors, [idColumn]: message } })
    }
    await runBatch(db, revalidatedRowStatements(db, id, changed))
  }

  const counts = await rowCounts(db, id)
  return { total: counts.total, errors: counts.errors, settings }
})
