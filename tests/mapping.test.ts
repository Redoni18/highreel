// Column mapping (SPEC M2f): a farm's own sheet with Albanian/English headers.

import { describe, expect, test } from 'vitest'
import { templates } from '../shared/templates'
import { applyMapping, autoMap, missingRequired, needsMapping, normalizeHeader } from '../shared/utils/mapping'

describe('column mapping', () => {
  const visit = templates.visit!
  const app = templates.app!

  test('normalizes headers', () => {
    expect(normalizeHeader(' First Name ')).toBe('first_name')
    expect(normalizeHeader('E-mail')).toBe('e_mail')
    expect(normalizeHeader('Ditët')).toBe('ditet')
  })

  test('matches a farm sheet by synonyms', () => {
    const headers = ['Nr', 'Emri', 'Parent email', 'Date', 'Ditët', 'Animals fed', 'Best moment', 'Shënim']
    const m = autoMap(headers, visit)
    expect(m).toEqual({
      phone: null,
      participant_id: 'Nr',
      first_name: 'Emri',
      email: 'Parent email',
      visit_date: 'Date',
      days: 'Ditët',
      activities_done: 'Animals fed',
      highlight: 'Best moment',
      badge: null,
      personal_note: 'Shënim',
    })
    expect(needsMapping(headers, visit, m)).toBe(true)
    expect(missingRequired(visit, m)).toEqual([])
    expect(applyMapping([{ 'Nr': '7', 'Emri': 'Arta', 'Ditët': '2', 'Shënim': 'Bravo!' }], m)[0]).toEqual({
      participant_id: '7', first_name: 'Arta', email: '', visit_date: '', days: '2', activities_done: '', highlight: '', personal_note: 'Bravo!',
    })
  })

  test('exact headers skip the dialog', () => {
    const headers = app.columns.map(c => c.key)
    expect(needsMapping(headers, app, autoMap(headers, app))).toBe(false)
  })

  test('a header is used once; exact names win', () => {
    const m = autoMap(['days', 'Days active'], app)
    expect(m.active_days).toBe('Days active')
  })

  test('missing required columns are reported', () => {
    const m = autoMap(['Name', 'Email'], app)
    expect(missingRequired(app, m)).toEqual(['customer_id', 'active_days'])
  })
})
