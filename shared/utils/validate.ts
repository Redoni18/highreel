// Spreadsheet validation (SPEC §4.2) and derived values (§4.3). Pure
// functions: the browser runs them for the header check and the live
// preview, the server runs the same code on import, on every cell edit and
// at publish.

import type { ParsedRow, RawRow, RowErrors, Template, TemplateColumn, CellValue } from '../templates/types'

export interface ValidateOptions {
  /** Today as YYYY-MM-DD (UTC). Injected by tests; defaults to now. */
  today?: string
}

export interface RowResult {
  data: ParsedRow
  errors: RowErrors
  warnings: RowErrors
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const INT_RE = /^-?\d+$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_INT = 1_000_000_000
const LEADING_DATE_RE = /^(\d{4}-\d{2}-\d{2})[T ].*$/
const NUMBER_RE = /^-?\d+(\.\d+)?$/
const MARKS_RE = /^[€$£¥]\s?|\s?(?:[€$£¥%]|EUR|USD|GBP)$/gi

/**
 * A number as written by other tools (M2.7), as plain digits: "€1,204.50",
 * "1.204,50 €", "24,5", "12%" → "1204.50", "1204.50", "24.5", "12". Anything
 * else comes back as it was (and fails the number check).
 */
export function plainNumber(input: string): string {
  const s = input.trim().replace(MARKS_RE, '').replace(/^(-?)\s+/, '$1')
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s))
    return s.replaceAll(',', '')
  // Dots as thousands only when that's the only reading: "1.204.000", "1.204,50" (not "24.999").
  if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s) || /^-?\d{1,3}(\.\d{3})+,\d+$/.test(s))
    return s.replaceAll('.', '').replace(',', '.')
  if (/^-?\d+,\d{1,2}$/.test(s))
    return s.replace(',', '.')
  return s
}

/** "1,234" → "1234", "€24.6" → "25" (M2.7: numbers from other tools). */
function lenientInt(s: string): string {
  const plain = plainNumber(s)
  return NUMBER_RE.test(plain) && plain.includes('.') ? String(Math.round(Number(plain))) : plain
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Keep only the template's columns, as trimmed strings. */
export function normalizeRaw(input: Record<string, unknown>, template: Template): RawRow {
  const raw: RawRow = {}
  for (const col of template.columns) {
    const v = input[col.key]
    raw[col.key] = v == null ? '' : String(v).trim()
  }
  return raw
}

/** Header check: missing required columns block the import, unknown ones are ignored. */
export function checkHeaders(headers: string[], template: Template) {
  const seen = new Set(headers.map(h => h.trim()))
  const known = new Set(template.columns.map(c => c.key))
  return {
    missing: template.columns.filter(c => c.required && !seen.has(c.key)).map(c => c.key),
    unknown: [...seen].filter(h => h && !known.has(h)),
  }
}

export function validateCell(col: TemplateColumn, input: string, opts: ValidateOptions = {}): { value: CellValue, error?: string } {
  const s = input.trim()
  if (s === '')
    return col.required ? { value: null, error: 'Required' } : { value: null }

  switch (col.type) {
    case 'text': {
      const length = [...s].length
      if (col.minLength != null && length < col.minLength)
        return { value: null, error: `At least ${col.minLength} characters` }
      if (col.maxLength != null && length > col.maxLength)
        return { value: null, error: `Max ${col.maxLength} characters` }
      return { value: s }
    }
    case 'email':
      return EMAIL_RE.test(s) ? { value: s } : { value: null, error: 'Not a valid email' }
    case 'phone': {
      // As written, minus spaces and punctuation: "+44 7700 900123" → "+447700900123" (SPEC M2.9).
      const compact = s.replace(/[\s().\-/]/g, '')
      return /^(?:\+|00)?\d{6,15}$/.test(compact) ? { value: compact } : { value: null, error: 'Not a phone number' }
    }
    case 'date': {
      // Lenient (M2.7): a database export's "2026-02-14 10:22:01+00" is that day.
      const day = col.lenient ? s.replace(LEADING_DATE_RE, '$1') : s
      const m = DATE_RE.exec(day)
      if (!m)
        return { value: null, error: 'Use YYYY-MM-DD' }
      const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
      const date = new Date(Date.UTC(y, mo - 1, d))
      if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
        return { value: null, error: 'Not a real date' }
      if (col.notFuture && day > (opts.today ?? todayUtc()))
        return { value: null, error: 'Can\'t be in the future' }
      return { value: day }
    }
    case 'decimal': {
      const plain = col.lenient ? plainNumber(s) : s
      if (!NUMBER_RE.test(plain))
        return { value: null, error: 'Needs a number' }
      const n = Math.round(Number(plain) * 100) / 100
      if (Math.abs(n) > MAX_INT)
        return { value: null, error: 'Number too large' }
      return { value: n }
    }
    case 'int': {
      const whole = col.lenient ? lenientInt(s) : s
      if (!INT_RE.test(whole))
        return { value: null, error: 'Needs a whole number' }
      const n = Number(whole)
      const { min, max } = col
      if (min != null && max != null && (n < min || n > max))
        return { value: null, error: `Must be ${min}–${max}` }
      if (min != null && n < min)
        return { value: null, error: `Must be ${min} or more` }
      if (max != null && n > max)
        return { value: null, error: `Must be ${max} or less` }
      if (n > MAX_INT)
        return { value: null, error: 'Number too large' }
      return { value: n }
    }
  }
}

/** Per-cell checks for one row. Duplicates need the whole sheet: see validateSheet. */
export function validateRow(raw: RawRow, template: Template, opts: ValidateOptions = {}): RowResult {
  const data: ParsedRow = {}
  const errors: RowErrors = {}
  for (const col of template.columns) {
    const { value, error } = validateCell(col, raw[col.key] ?? '', opts)
    data[col.key] = value
    if (error)
      errors[col.key] = error
  }
  for (const [col, message] of Object.entries(template.check?.(data) ?? {}))
    errors[col] ??= message
  const warnings = template.warnings?.(data) ?? {}
  return { data, errors, warnings }
}

/**
 * Duplicate check for one unique column. Every row after the first with the
 * same value gets "Already used in row N" (N is the 1-based sheet row).
 * Returns rowIndex → message for the duplicates only.
 */
export function duplicateErrors(entries: Array<{ rowIndex: number, value: string }>): Map<number, string> {
  const firstAt = new Map<string, number>()
  const sorted = [...entries].filter(e => e.value !== '').sort((a, b) => a.rowIndex - b.rowIndex)
  const out = new Map<number, string>()
  for (const { rowIndex, value } of sorted) {
    const first = firstAt.get(value)
    if (first == null)
      firstAt.set(value, rowIndex)
    else
      out.set(rowIndex, `Already used in row ${first + 1}`)
  }
  return out
}

/** Validate a whole sheet: per-cell checks plus duplicates in unique columns. */
export function validateSheet(raws: RawRow[], template: Template, opts: ValidateOptions = {}): RowResult[] {
  const results = raws.map(raw => validateRow(raw, template, opts))
  for (const col of template.columns.filter(c => c.unique)) {
    const dups = duplicateErrors(raws.map((raw, rowIndex) => ({ rowIndex, value: raw[col.key] ?? '' })))
    for (const [rowIndex, message] of dups) {
      const errors = results[rowIndex]!.errors
      // A cell error (too long, blank) is the more useful message.
      errors[col.key] ??= message
    }
  }
  return results
}

/**
 * "Top X%" among valid rows, ranked by the template's rank column (desc),
 * SPEC §4.3. Ties share a rank (1 + rows strictly ahead). Null for invalid rows.
 */
export function computeTopPercents(rows: Array<{ valid: boolean, value: unknown }>): Array<number | null> {
  const values = rows
    .filter(r => r.valid && typeof r.value === 'number')
    .map(r => r.value as number)
    .sort((a, b) => b - a)
  const count = values.length
  const rankOf = new Map<number, number>()
  values.forEach((v, i) => {
    if (!rankOf.has(v))
      rankOf.set(v, i + 1)
  })
  return rows.map((r) => {
    if (!r.valid || typeof r.value !== 'number' || count === 0)
      return null
    return Math.ceil(rankOf.get(r.value)! / count * 100)
  })
}

export function hasErrors(errors: RowErrors | null | undefined): boolean {
  return !!errors && Object.keys(errors).length > 0
}
