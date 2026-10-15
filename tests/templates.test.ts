// Every template (SPEC M2e): its sample has exactly the planted errors, its
// downloadable template rows are clean, and slides follow the template's rules.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import Papa from 'papaparse'
import { describe, expect, test } from 'vitest'
import { customerTemplates, templates } from '../shared/templates'
import type { Template } from '../shared/templates/types'
import type { RecapPayload } from '../shared/types/recap'
import { normalizeSettings, recapColumns, toRecapRecipient } from '../shared/utils/recap'
import { buildSlides, shareStats } from '../shared/utils/slides'
import { checkHeaders, normalizeRaw, validateSheet } from '../shared/utils/validate'

const TODAY = '2026-10-11'

function sheet(t: Template, file: string) {
  const csv = readFileSync(join(__dirname, '..', 'public', file), 'utf8')
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy', transform: v => v.trim() })
  expect(checkHeaders(parsed.meta.fields ?? [], t)).toEqual({ missing: [], unknown: [] })
  const results = validateSheet(parsed.data.map(r => normalizeRaw(r, t)), t, { today: TODAY })
  return { rows: parsed.data, flagged: results.map((r, i) => ({ row: i + 1, errors: r.errors })).filter(r => Object.keys(r.errors).length) }
}

const planted: Record<string, Array<{ row: number, errors: Record<string, string> }>> = {
  app: [
    { row: 8, errors: { first_name: 'Required' } },
    { row: 24, errors: { active_days: 'Needs a whole number' } },
    { row: 59, errors: { customer_id: 'Already used in row 58' } },
    { row: 92, errors: { member_since: 'Use YYYY-MM-DD' } },
    { row: 141, errors: { top_percent: 'Must be 1–100' } },
  ],
  newsletter: [
    { row: 5, errors: { issues_opened: 'Needs a whole number' } },
    { row: 33, errors: { email: 'Not a valid email' } },
    { row: 77, errors: { reading_streak_weeks: 'Must be 0–53' } },
  ],
  shop: [
    { row: 12, errors: { orders: 'Must be 0–10000' } },
    { row: 45, errors: { first_order_date: 'Can\'t be in the future' } },
    { row: 150, errors: { customer_id: 'Already used in row 149' } },
  ],
  visit: [
    { row: 9, errors: { first_name: 'Required' } },
    { row: 40, errors: { days: 'Must be 1–366' } },
    { row: 88, errors: { email: 'Not a valid email' } },
  ],
}

// "Your own sheet" (custom) has no fixed columns past the id and name: tests/own.test.ts covers it.
describe.each(customerTemplates.filter(t => t.key !== 'custom'))('template $key', (t) => {
  test('sample has exactly the planted errors', () => {
    expect(sheet(t, t.files.sample).flagged).toEqual(planted[t.key])
  })

  test('downloadable template rows are valid', () => {
    expect(sheet(t, t.files.template).flagged).toEqual([])
  })

  test('recaps never carry the id or the email', () => {
    const cols = recapColumns(t)
    expect(cols).not.toContain('email')
    expect(cols).not.toContain(t.columns.find(c => c.unique)!.key)
  })

})

describe.each(Object.values(templates))('template $key', (t) => {
  test('every slide and share stat points at a real column', () => {
    const keys = new Set(t.columns.map(c => c.key))
    for (const s of t.slides) {
      expect(keys.has(s.column)).toBe(true)
      if (s.small)
        expect(keys.has(s.small.column)).toBe(true)
      for (const c of s.list ?? [])
        expect(keys.has(c)).toBe(true)
    }
    for (const s of t.shareStats)
      expect(keys.has(s.column)).toBe(true)
    for (const s of t.totals ?? [])
      expect(keys.has(s.column)).toBe(true)
  })
})

describe('business template (SPEC M2.5 P4)', () => {
  const t = templates.business!
  const full = {
    stat_1: 1240, stat_1_label: 'kids visited', stat_2: 52, stat_2_label: 'baby goats born',
    stat_3: null, stat_3_label: null, stat_4: 3, stat_4_label: 'new barns',
    highlight: 'The first summer camp', milestone_1: 'March: opened the new barn', milestone_2: null, milestone_3: 'A goat named Pancake',
  }

  test('slides speak to followers, one per number, then highlight, milestones, note', () => {
    const slides = buildSlides(t, payload(t, full))
    expect(slides.map(s => s.key)).toEqual(['cover', 'stat_1', 'stat_2', 'stat_4', 'highlight', 'milestones', 'note', 'share'])
    expect(slides[0]!.title).toBe('Our 2026 at Green Valley Farm')
    expect(slides[1]).toMatchObject({ scene: 'count', value: 1240, after: 'kids visited' })
    expect(slides[5]).toMatchObject({ scene: 'timeline', before: 'Milestones of 2026', items: [{ label: 'March', text: 'opened the new barn' }, { label: null, text: 'A goat named Pancake' }] })
    expect(slides[6]).toMatchObject({ note: t.defaultSettings.founder_note })
    expect(shareStats(t, payload(t, full))).toEqual([
      { value: '1,240', label: 'kids visited' },
      { value: '52', label: 'baby goats born' },
      { value: '3', label: 'new barns' },
    ])
  })

  test('the labels reach the recap (they\'re named in the copy)', () => {
    expect(recapColumns(t)).toEqual(expect.arrayContaining(['stat_1', 'stat_1_label', 'milestone_3', 'highlight']))
  })

  test('a number needs its label and a label its number; the first number is required', () => {
    const raw = { stat_1: '', stat_1_label: '', stat_2: '52', stat_2_label: '', stat_3: '', stat_3_label: 'new barns' }
    expect(validateSheet([normalizeRaw(raw, t)], t, { today: TODAY })[0]!.errors).toEqual({
      stat_1: 'Required',
      stat_1_label: 'Required',
      stat_2_label: 'Say what this counts',
      stat_3: 'Add the number',
    })
  })
})

function payload(t: Template, data: Record<string, string | number | null>, settings: Record<string, unknown> = {}): RecapPayload {
  return {
    template_key: t.key,
    year: 2026,
    business: { name: 'Green Valley Farm', logo_url: null, website_url: null },
    settings: normalizeSettings({ ...t.defaultSettings, ...settings }),
    recipient: toRecapRecipient(t, data, null),
  }
}

describe('slides', () => {
  test('app: a 2-day streak has no streak slide; top 54% has no rank slide', () => {
    const t = templates.app!
    const keys = buildSlides(t, payload(t, { first_name: 'Kai', active_days: 19, longest_streak_days: 2, items_created: 49, top_feature: 'Water tracker' })).map(s => s.key)
    expect(keys).toEqual(['cover', 'active_days', 'items', 'top_feature', 'share'])
  })

  test('visit: label-style copy, custom cover, staff note with the visit month', () => {
    const t = templates.visit!
    const slides = buildSlides(t, payload(t, { first_name: 'Arta', visit_date: '2026-07-14', days: 2, activities_done: 14, highlight: 'Feeding the baby goats', badge: 'Junior farmer', personal_note: 'You were so brave!' }, { items_label: 'animals fed' }))
    expect(slides.map(s => s.key)).toEqual(['cover', 'days', 'activities', 'highlight', 'badge', 'note', 'share'])
    expect(slides[0]!.title).toBe('Arta, your days at Green Valley Farm')
    expect(slides[1]).toMatchObject({ before: 'Days at Green Valley Farm:', value: 2 })
    expect(slides[2]).toMatchObject({ before: 'Animals fed:', value: 14 })
    expect(slides[4]).toMatchObject({ before: 'You earned:', text: 'Junior farmer' })
    expect(slides[5]).toMatchObject({ note: 'You were so brave!', small: 'Your visit: July 2026' })
  })

  test('shop: currency sticks to the number', () => {
    const t = templates.shop!
    const saved = buildSlides(t, payload(t, { first_name: 'Ana', orders: 14, amount_saved: 42 })).find(s => s.key === 'saved')
    expect(saved).toMatchObject({ before: 'You saved', prefix: '€', value: 42, after: 'with us.' })
  })

  test('custom copy and share stats', () => {
    const t = templates.visit!
    const p = payload(t, { first_name: 'Dren', days: 1, activities_done: 6, badge: 'Egg collector' }, { items_label: 'animals fed', copy: { cover: 'Hello {first_name}!' } })
    expect(buildSlides(t, p)[0]!.title).toBe('Hello Dren!')
    expect(shareStats(t, p)).toEqual([
      { value: '1', label: 'days' },
      { value: '6', label: 'animals fed' },
      { value: 'Egg collector', label: 'badge earned' },
    ])
  })
})
