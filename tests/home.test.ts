// The home's cards and lines (SPEC M2.5 P3, cards since M2.16).

import { describe, expect, test } from 'vitest'
import type { HomeCampaign } from '../shared/types/recap'
import { activityText, attention, nextName, timeAgo, yearCards } from '../shared/utils/home'
import type { HomeCard, Phrase } from '../shared/utils/home'

const text = (p: Phrase) => p.map(x => (typeof x === 'string' ? x : x.n)).join('')

function campaign(over: Partial<HomeCampaign>): HomeCampaign {
  return {
    id: 'c', name: '2026 recap', year: 2026, template_key: 'app', kind: 'customers', status: 'published',
    published_at: null, created_at: '2026-10-01T00:00:00Z', row_count: 0, need_fixing: 0, published: 0,
    opened: 0, views: 0, saved: 0, shared: 0, clicked: 0, updated_at: '2026-10-01T00:00:00Z', ...over,
  }
}

describe('yearCards', () => {
  // A card as "label value (detail)", to compare in one go.
  const line = (c: HomeCard) => `${c.label} ${c.value}${c.detail ? ` (${c.detail})` : ''}`

  test('the year in four cards: sent, opened, shared, tapped', () => {
    const cards = yearCards(2026, [
      campaign({ id: 'a', published: 120, opened: 80, saved: 30, shared: 10, clicked: 5 }),
      campaign({ id: 'b', published: 75, opened: 52, saved: 11, shared: 8, clicked: 4 }),
    ])
    expect(cards.map(line)).toEqual([
      'Sent 195 (in 2 campaigns)',
      'Opened 132 (68% of those sent)',
      'Shared 18 (41 saved the image)',
      'Tapped your button 9 (7% of those who opened)',
    ])
  })

  test('big numbers with commas; singulars; nothing sent yet', () => {
    expect(yearCards(2026, [campaign({ published: 1200 })])[0]).toMatchObject({ value: '1,200', detail: 'in 1 campaign' })
    expect(yearCards(2026, [campaign({ status: 'draft', row_count: 20 })]).map(line)).toEqual([
      'Sent 0 (Nothing sent in 2026 yet)',
      'Opened 0',
      'Shared 0',
      'Tapped your button 0',
    ])
    expect(yearCards(2026, [])).toEqual([])
  })

  test('a business recap gets its own card, outside the customer counts', () => {
    expect(yearCards(2026, [campaign({ kind: 'business', name: 'Our 2026', published: 1, views: 38 })]).map(line)).toEqual(['Views of “Our 2026” 38 (your business Highreel)'])
    // Not published yet: no card.
    expect(yearCards(2026, [campaign({ kind: 'business', status: 'draft', published: 0 })])).toEqual([])
  })
})

describe('attention', () => {
  test('one line per draft', () => {
    const lines = attention([
      campaign({ id: '1', name: 'Summer farm days', status: 'draft', row_count: 120, need_fixing: 3 }),
      campaign({ id: '2', name: 'Spring', status: 'draft' }),
      campaign({ id: '3', name: 'Autumn', status: 'draft', row_count: 40 }),
      campaign({ id: '4', name: 'Our 2026', status: 'draft', kind: 'business' }),
      campaign({ id: '5', name: 'Sent', status: 'published', row_count: 10 }),
    ])
    expect(lines.map(l => `${l.name}: ${text(l.text)}`)).toEqual([
      'Summer farm days: 3 rows need fixing · not published',
      'Spring: no sheet yet · not published',
      'Autumn: 40 rows ready · not published',
      'Our 2026: not filled in yet · not published',
    ])
  })
})

test('activity lines never guess a pronoun', () => {
  expect(activityText({ campaign_id: 'c', first_name: 'Ana', event: 'view', at: '' })).toEqual({ who: 'Ana', verb: 'opened' })
  expect(activityText({ campaign_id: 'c', first_name: null, event: 'share', at: '' })).toEqual({ who: 'Someone', verb: 'shared' })
})

test('timeAgo', () => {
  const now = Date.parse('2026-10-11T12:00:00Z')
  expect(timeAgo('2026-10-11T11:59:30Z', now)).toBe('just now')
  expect(timeAgo('2026-10-11T11:20:00Z', now)).toBe('40 min ago')
  expect(timeAgo('2026-10-11T10:00:00Z', now)).toBe('2 h ago')
  expect(timeAgo('2026-10-08T12:00:00Z', now)).toBe('3 d ago')
  expect(timeAgo('2026-09-01T12:00:00Z', now)).toBe('1 Sep')
  expect(timeAgo('2025-09-01T12:00:00Z', now)).toBe('1 Sep 2025')
})

test('nextName for Duplicate', () => {
  expect(nextName('2026 recap', 2026, 2027)).toBe('2027 recap')
  expect(nextName('Our 2026', 2026, 2027)).toBe('Our 2027')
  expect(nextName('Summer camp', 2026, 2027)).toBe('Summer camp (copy)')
  expect(nextName('2026 recap', 2026, 2026)).toBe('2026 recap (copy)')
})

describe('business recap suggestions (SPEC M2.5 P4)', () => {
  test('who got a recap and the template totals, labelled for followers', async () => {
    const { suggestions } = await import('../shared/utils/suggest')
    expect(suggestions([
      { template_key: 'app', items_label: 'habits checked off', published: 195, sums: { items_created: 236000.4, active_days: 41200, sessions: 0 } },
      { template_key: 'visit', items_label: 'animals fed', published: 120, sums: { activities_done: 1690, days: 300 } },
      { template_key: 'app', items_label: 'habits checked off', published: 5, sums: { items_created: 100 } },
    ])).toEqual([
      { value: 200, label: 'customers got a Highreel' },
      { value: 120, label: 'visitors got a Highreel' },
      { value: 236100, label: 'habits checked off' },
      { value: 41200, label: 'active days' },
      { value: 1690, label: 'animals fed' },
      { value: 300, label: 'days of visits' },
    ])
  })
})
