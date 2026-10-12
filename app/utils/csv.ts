// Read an uploaded sheet in the browser (SPEC §4.2, M2f): CSV via PapaParse,
// .xlsx via read-excel-file (first sheet). Cells become trimmed strings; Excel
// dates become YYYY-MM-DD. Headers are checked before anything is sent.

import Papa from 'papaparse'
import type { Template } from '#shared/templates/types'
import { checkHeaders } from '#shared/utils/validate'

export interface ParsedSheet {
  name: string
  headers: string[]
  /** Keyed by the sheet's own headers (renamed by the mapping step if needed) */
  rows: Record<string, string>[]
  missing: string[]
  unknown: string[]
}

export function isSheetFile(file: File): boolean {
  return /\.(csv|txt|xlsx)$/i.test(file.name) || file.type === 'text/csv'
}

export function isOldExcel(file: File): boolean {
  return /\.xls$/i.test(file.name)
}

function finish(name: string, headers: string[], rows: Record<string, string>[], template: Template): ParsedSheet {
  return { name, headers, rows, ...checkHeaders(headers, template) }
}

export function parseCsv(input: File | string, name: string, template: Template): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(input as File, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: h => h.trim().replace(/^\uFEFF/, ''),
      transform: v => v.trim(),
      complete(result) {
        resolve(finish(name, result.meta.fields ?? [], result.data, template))
      },
      error: (err: Error) => reject(err),
    })
  })
}

function cellText(v: unknown): string {
  if (v == null)
    return ''
  if (v instanceof Date)
    return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10)
  if (typeof v === 'boolean')
    return v ? 'TRUE' : 'FALSE'
  return String(v).trim()
}

export async function parseXlsx(file: File, template: Template): Promise<ParsedSheet> {
  const { readSheet } = await import('read-excel-file/browser')
  const data = (await readSheet(file)) as unknown[][]
  const [head = [], ...body] = data
  const headers = head.map(cellText)
  const rows = body
    .map(cells => Object.fromEntries(headers.map((h, i) => [h, cellText(cells[i])])))
    .filter(row => Object.values(row).some(v => v !== ''))
  return finish(file.name, headers.filter(Boolean), rows, template)
}

export function parseSheetFile(file: File, template: Template): Promise<ParsedSheet> {
  return /\.xlsx$/i.test(file.name) ? parseXlsx(file, template) : parseCsv(file, file.name, template)
}
