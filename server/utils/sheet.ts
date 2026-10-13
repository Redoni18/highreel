// Checking a whole sheet again, a page at a time (SPEC M2.14 P1: no route
// holds a whole sheet; 50,000 rows at once outgrew a Worker's 128 MB). Publish
// and the Sheet's column menu run it: every row is validated against the
// current template, an id used again anywhere in the sheet is flagged on its
// later rows (validateSheet's rule, found in SQL), and only rows whose results
// changed are written back. Ranks from the last publish stay until the next
// one; ranks of columns that are gone are dropped.

import type { Template } from '#shared/templates/types'
import type { ParsedRow } from '#shared/templates/types'
import { idColumnOf } from '#shared/templates'
import { rankableColumns, storedRankKey } from '#shared/templates/own'
import { duplicateErrors, hasErrors, validateRow } from '#shared/utils/validate'

/** What publish needs of each row: never its cells. */
export interface CheckedRow {
  id: string
  valid: boolean
  token: string | null
  customer_id: string
  /** this row's values of `collect`'s columns, in order */
  values: unknown[]
}

/** The rank keys publish keeps in `data`. */
const rankKeysOf = (template: Template) => ['computed_top_percent', ...rankableColumns(template).map(storedRankKey)]

/** Every row's duplicate-id message, by row_index, across the whole sheet. */
async function sheetDuplicates(db: Db, campaignId: string): Promise<Map<number, string>> {
  return duplicateErrors((await duplicateIdRows(db, campaignId)).map(r => ({ rowIndex: r.row_index, value: r.customer_id })))
}

export async function checkSheet(db: Db, campaignId: string, template: Template, opts: { business?: boolean, collect?: string[] } = {}): Promise<CheckedRow[]> {
  const idColumn = idColumnOf(template)
  const keep = new Set(rankKeysOf(template))
  const dups = opts.business ? new Map<number, string>() : await sheetDuplicates(db, campaignId)
  const out: CheckedRow[] = []
  for (let after = -1; ;) {
    const page = await rowsForCheck(db, campaignId, after)
    const changed: Array<{ id: string, data: ParsedRow, errors: Record<string, string> }> = []
    for (const row of page) {
      const { data, errors } = validateRow(row.raw, template)
      const dup = dups.get(row.row_index)
      // A cell error (too long, blank) is the more useful message.
      if (dup)
        errors[idColumn] ??= dup
      const before = JSON.parse(row.dataText) as ParsedRow
      for (const [key, value] of Object.entries(before)) {
        if (keep.has(key))
          data[key] = value
      }
      if (JSON.stringify(data) !== row.dataText || JSON.stringify(errors) !== row.errorsText)
        changed.push({ id: row.id, data, errors })
      if (opts.collect)
        out.push({ id: row.id, valid: !hasErrors(errors), token: row.token, customer_id: row.customer_id, values: opts.collect.map(k => data[k]) })
    }
    await runBatch(db, revalidatedRowStatements(db, campaignId, changed))
    if (page.length < PAGE_ROWS)
      return out
    after = page.at(-1)!.row_index
  }
}
