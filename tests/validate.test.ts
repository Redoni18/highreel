// Validators against the demo sample (SPEC §8 M1.2): exactly the five planted
// errors at sheet rows 8, 24, 59, 92 and 141, with the messages the grid shows.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Papa from 'papaparse'
import { describe, expect, test } from 'vitest'
import { appTemplate } from '../shared/templates/app'
import { checkHeaders, computeTopPercents, normalizeRaw, validateCell, validateRow, validateSheet } from '../shared/utils/validate'

const TODAY = '2026-10-11'

function loadSample() {
  const csv = readFileSync(join(__dirname, '..', 'public', 'templates', 'sample-habitly-200.csv'), 'utf8')
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', transform: v => v.trim() })
  return parsed
}

describe('sample-habitly-200.csv', () => {
  const parsed = loadSample()
  const raws = parsed.data.map(r => normalizeRaw(r, appTemplate))
  const results = validateSheet(raws, appTemplate, { today: TODAY })

  test('has every template column', () => {
    expect(checkHeaders(parsed.meta.fields ?? [], appTemplate)).toEqual({ missing: [], unknown: [] })
    expect(raws).toHaveLength(200)
  })

  test('flags exactly the five planted errors', () => {
    const flagged = results
      .map((r, i) => ({ row: i + 1, errors: r.errors }))
      .filter(r => Object.keys(r.errors).length > 0)

    expect(flagged).toEqual([
      { row: 8, errors: { first_name: 'Required' } },
      { row: 24, errors: { active_days: 'Needs a whole number' } },
      { row: 59, errors: { customer_id: 'Already used in row 58' } },
      { row: 92, errors: { member_since: 'Use YYYY-MM-DD' } },
      { row: 141, errors: { top_percent: 'Must be 1–100' } },
    ])
  })

  test('fixing a cell clears its error', () => {
    const fixed = { ...raws[7]!, first_name: 'Clara' }
    expect(validateRow(fixed, appTemplate, { today: TODAY }).errors).toEqual({})
  })
})

describe('cells', () => {
  const col = (key: string) => appTemplate.columns.find(c => c.key === key)!

  test('dates', () => {
    expect(validateCell(col('member_since'), '2025-03-14', { today: TODAY })).toEqual({ value: '2025-03-14' })
    expect(validateCell(col('member_since'), '2025-02-31', { today: TODAY }).error).toBe('Not a real date')
    expect(validateCell(col('member_since'), '2026-10-12', { today: TODAY }).error).toBe('Can\'t be in the future')
    expect(validateCell(col('member_since'), '', { today: TODAY })).toEqual({ value: null })
  })

  test('numbers', () => {
    expect(validateCell(col('active_days'), '212')).toEqual({ value: 212 })
    expect(validateCell(col('active_days'), '367').error).toBe('Must be 0–366')
    expect(validateCell(col('active_days'), '12.5').error).toBe('Needs a whole number')
    expect(validateCell(col('sessions'), '-1').error).toBe('Must be 0 or more')
    expect(validateCell(col('active_days'), '').error).toBe('Required')
  })

  test('text and email', () => {
    expect(validateCell(col('first_name'), 'x'.repeat(31)).error).toBe('Max 30 characters')
    expect(validateCell(col('email'), 'ana@example').error).toBe('Not a valid email')
  })

  test('streak longer than active days is only a warning', () => {
    const raw = normalizeRaw({ customer_id: 'a', first_name: 'Ana', active_days: '10', longest_streak_days: '12' }, appTemplate)
    const r = validateRow(raw, appTemplate)
    expect(r.errors).toEqual({})
    expect(r.warnings).toEqual({ longest_streak_days: 'Longer than active_days' })
  })
})

describe('top percent', () => {
  test('ranks valid rows by active days, ties share a rank', () => {
    const rows = [300, 200, 200, 100, 50].map(d => ({ valid: true, value: d as unknown }))
    rows.push({ valid: false, value: 999 })
    expect(computeTopPercents(rows)).toEqual([20, 40, 40, 80, 100, null])
  })
})
