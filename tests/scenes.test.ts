// Recap scenes (SPEC M2.5 P1): every template uses at least four scenes,
// durations and entrances follow the scene, Guess first, and the layout
// maths the scenes rely on.

import { describe, expect, test } from 'vitest'
import { templates, templateFor } from '../shared/templates'
import type { Template } from '../shared/templates/types'
import type { RecapPayload } from '../shared/types/recap'
import { normalizeSettings, toRecapRecipient } from '../shared/utils/recap'
import { GUESS_LIMIT, guessChoices, sceneOf, stepTimes, tokenPlan, visitPages, yearCalendar } from '../shared/utils/scenes'
import { buildSlides } from '../shared/utils/slides'

// A row that fills every slide of each template.
const FULL: Record<string, Record<string, string | number>> = {
  app: { first_name: 'Ana', member_since: '2024-03-02', active_days: 212, longest_streak_days: 41, sessions: 900, items_created: 1180, top_feature: 'Morning routine', top_percent: 5, personal_note: 'Thanks for being here.' },
  newsletter: { first_name: 'Omar', subscribed_since: '2023-06-26', issues_opened: 48, links_clicked: 30, favorite_issue_title: 'Soup season', reading_streak_weeks: 12, referrals: 3, top_percent: 8 },
  shop: { first_name: 'Felix', first_order_date: '2025-02-01', orders: 14, items_bought: 30, favorite_product: 'House Espresso', favorite_category: 'Filter coffee', amount_saved: 42, loyalty_points: 180, top_percent: 10 },
  visit: { first_name: 'Arta', visit_date: '2026-07-14', days: 3, activities_done: 14, highlight: 'Feeding the baby goats', badge: 'Junior farmer', personal_note: 'You were so brave!' },
  business: { stat_1: 1240, stat_1_label: 'kids visited', stat_2: 52, stat_2_label: 'baby goats born', highlight: 'The first summer camp', milestone_1: 'March: opened the new barn', milestone_2: 'July: 300 kids at camp' },
  custom: { first_name: 'Lea', gifts_made: 6, favorite_occasion: 'Anniversary', maker_badge: 'Storyteller', first_gift: '2026-02-14' },
}

// "Your own sheet" (SPEC M2.7) plays the business's own columns: here a gift maker's.
const OWN = {
  columns: [
    { key: 'gifts_made', label: 'gifts_made', type: 'int' as const },
    { key: 'favorite_occasion', label: 'favorite_occasion', type: 'text' as const },
    { key: 'maker_badge', label: 'maker_badge', type: 'text' as const },
    { key: 'first_gift', label: 'first_gift', type: 'date' as const },
  ],
  slides: ['gifts_made', 'favorite_occasion', 'maker_badge', 'first_gift'].map(column => ({ key: `c_${column}`, column, show: 'value' as const })),
}
const effective = (t: Template) => (t.key === 'custom' ? templateFor('custom', OWN) : t)

function payload(t: Template, settings: Record<string, unknown> = {}): RecapPayload {
  return {
    template_key: t.key,
    year: 2026,
    business: { name: 'Green Valley Farm', logo_url: null, website_url: null },
    settings: normalizeSettings({ ...t.defaultSettings, items_label: t.defaultSettings.items_label || 'things', ...(t.key === 'custom' ? OWN : {}), ...settings }),
    recipient: toRecapRecipient(t, FULL[t.key]!, null),
  }
}

describe.each(Object.values(templates).map(effective))('template $key', (t) => {
  test('a full recap uses at least 4 different scenes', () => {
    const scenes = new Set(buildSlides(t, payload(t)).map(s => s.scene))
    expect(scenes.size).toBeGreaterThanOrEqual(4)
  })

  test('every stat slide declares a scene that suits its kind', () => {
    for (const def of t.slides) {
      const scene = sceneOf(def)
      if (def.kind === 'text')
        expect(def.list ? ['timeline'] : ['word', 'badge']).toContain(scene)
      else if (def.kind === 'date')
        expect(['date', 'word']).toContain(scene)
      else
        expect(['days', 'streak', 'count', 'rank']).toContain(scene)
    }
  })

  test('slides stay 5–7 s; the share slide waits', () => {
    for (const s of buildSlides(t, payload(t))) {
      if (s.scene === 'share')
        expect(s).toMatchObject({ autoAdvance: false, duration: 0 })
      else
        expect(s.duration).toBeGreaterThanOrEqual(5000)
      expect(s.duration).toBeLessThanOrEqual(7000)
    }
  })
})

describe('scenes per slide', () => {
  test('app: days (year), streak, count, word, rank, note', () => {
    const slides = buildSlides(templates.app!, payload(templates.app!))
    expect(slides.map(s => s.scene)).toEqual(['cover', 'days', 'streak', 'count', 'word', 'rank', 'note', 'share'])
    expect(slides[1]!.days).toEqual({ span: 'year', year: 2026, start: null })
  })

  test('visit: one tile per day from the visit date, and a badge', () => {
    const slides = buildSlides(templates.visit!, payload(templates.visit!, { items_label: 'animals fed' }))
    expect(slides.map(s => s.scene)).toEqual(['cover', 'days', 'count', 'word', 'badge', 'note', 'share'])
    expect(slides[1]!.days).toEqual({ span: 'visit', year: 2026, start: '2026-07-14' })
  })

  test('entrances vary; Paper only wipes', () => {
    const t = templates.app!
    expect(new Set(buildSlides(t, payload(t)).map(s => s.transition)).size).toBeGreaterThanOrEqual(4)
    const paper = buildSlides(t, payload(t, { look: { design: 'paper', colorway: 'teal' } }))
    expect(new Set(paper.filter(s => !['cover', 'share'].includes(s.scene)).map(s => s.transition))).toEqual(new Set(['wipe']))
  })

  test('custom copy without the value falls back to a plain line', () => {
    const t = templates.app!
    const s = buildSlides(t, payload(t, { copy: { streak: 'What a run!' } })).find(x => x.key === 'streak')
    expect(s).toMatchObject({ scene: 'line', before: 'What a run!' })
  })
})

describe('guess first', () => {
  test('off by default', () => {
    const t = templates.app!
    expect(buildSlides(t, payload(t)).some(s => s.guess)).toBe(false)
  })

  test(`asks on the first ${GUESS_LIMIT} number slides only`, () => {
    const t = templates.app!
    const slides = buildSlides(t, payload(t, { guess_first: true }))
    expect(slides.filter(s => s.guess).map(s => s.key)).toEqual(['active_days', 'streak'])
    for (const s of slides.filter(x => x.guess))
      expect(s.guess).toContain(s.value)
  })

  test('choices: the value plus two distinct decoys in range, stable per key', () => {
    for (const [value, min, max] of [[212, 0, 366], [1, 1, 366], [2, 1, 366], [366, 0, 366], [5, 1, 100], [1180, 0, Infinity], [0, 0, 1000]] as const) {
      for (const key of ['Ana|a', 'Kai|b', 'Lea|c']) {
        const c = guessChoices(value, key, min, max)
        expect(c).toHaveLength(3)
        expect(new Set(c).size).toBe(3)
        expect(c).toContain(value)
        expect(c.every(n => n >= min && n <= max && Number.isInteger(n))).toBe(true)
        expect(c).toEqual([...c].sort((a, b) => a - b))
        expect(guessChoices(value, key, min, max)).toEqual(c)
      }
    }
  })

  test('the real value is not always in the middle', () => {
    const positions = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(k => guessChoices(150, k, 0, 366).indexOf(150)))
    expect(positions.size).toBeGreaterThan(1)
  })
})

describe('layout maths', () => {
  test('stepTimes: steps land when the rounded counter shows them, ending by the duration', () => {
    const t = stepTimes(212, 2200, 500)
    expect(t).toHaveLength(212)
    expect(t.every((x, i) => i === 0 || x >= t[i - 1]!)).toBe(true)
    expect(t[0]).toBeGreaterThanOrEqual(500)
    expect(t.at(-1)).toBeLessThanOrEqual(2700)
  })

  test('yearCalendar: real weekdays, 365 or 366 days', () => {
    const y26 = yearCalendar(2026)
    expect(y26.total).toBe(365)
    expect(y26.months[0]).toMatchObject({ label: 'J', lead: 3, days: 31, first: 0 }) // 1 Jan 2026 is a Thursday
    expect(yearCalendar(2028).total).toBe(366)
    expect(yearCalendar(2028).months[1]!.days).toBe(29)
  })

  test('visitPages: dates from the visit date across a month end, else Day 1…', () => {
    expect(visitPages(3, '2026-07-30')).toEqual([{ top: 'Jul', day: '30' }, { top: 'Jul', day: '31' }, { top: 'Aug', day: '1' }])
    expect(visitPages(2, null)).toEqual([{ top: 'Day', day: '1' }, { top: 'Day', day: '2' }])
  })

  test('tokenPlan: one token each up to 60, then a round unit', () => {
    expect(tokenPlan(23)).toEqual({ count: 23, unit: 1 })
    expect(tokenPlan(60)).toEqual({ count: 60, unit: 1 })
    expect(tokenPlan(61)).toEqual({ count: 31, unit: 2 })
    expect(tokenPlan(1180)).toEqual({ count: 59, unit: 20 })
    expect(tokenPlan(250000).count).toBeLessThanOrEqual(60)
  })
})
