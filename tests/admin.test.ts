// The admin pages' sentences and money (SPEC M2.15).

import { describe, expect, test } from 'vitest'
import type { AdminOverview, AdminUser } from '../shared/types/admin'
import { formatAmount, formatMoney, moneySize, overviewSummary, percent, reachSentence, userSummary } from '../shared/utils/admin'
import type { Phrase } from '../shared/utils/home'

const text = (p: Phrase) => p.map(x => (typeof x === 'string' ? x : x.n)).join('')
const reach = { live: 0, opened: 0, saved: 0, shared: 0, clicked: 0 }

function overview(over: Partial<AdminOverview>): AdminOverview {
  return {
    accounts: 0, demos: 0, admins: 0, joined_week: 0, active_week: 0, makers: 0, highreels: 0, publishers: 0,
    published: 0, unpaid: 0, reach, payers: 0, payments: 0, refunded: 0, revenue: {},
    newest: [], latest_published: [], latest_payments: [], ...over,
  }
}

function user(over: Partial<AdminUser>): AdminUser {
  return {
    id: 'u', email: 'ana@example.com', demo: false, role: 'client', created_at: '2026-10-01T00:00:00Z', last_seen: null,
    business_id: 'b', business: 'Habitly', highreels: 0, published: 0, unpaid: 0, emails: 0, payments: 0, spent: {},
    ...reach, ...over,
  }
}

describe('money', () => {
  test('minor units in the currency\'s own format, whole amounts without cents', () => {
    expect(formatAmount(9900, 'usd')).toBe('$99')
    expect(formatAmount(12345, 'eur')).toBe('€123.45')
    expect(formatAmount(19900, 'gbp')).toBe('£199')
    // No minor units in yen.
    expect(formatAmount(15000, 'jpy')).toBe('¥15,000')
  })

  test('several currencies, the biggest first; none is a dash', () => {
    expect(formatMoney({ eur: 9200, usd: 19800 })).toBe('$198 + €92')
    expect(formatMoney({})).toBe('–')
    expect(formatMoney({ usd: 0 })).toBe('–')
  })

  test('spend sorts across currencies by major amounts', () => {
    expect(moneySize({ usd: 9900, jpy: 1000 })).toBe(99 + 1000)
    expect(moneySize({})).toBe(0)
  })

  test('percent of nothing is a dash', () => {
    expect(percent(1, 3)).toBe('33%')
    expect(percent(0, 0)).toBe('–')
  })
})

describe('reachSentence', () => {
  test('opens, then whatever else happened, with a serial comma', () => {
    expect(text(reachSentence({ live: 3705, opened: 1830, saved: 0, shared: 212, clicked: 40 }, 'Their customers got')))
      .toBe('Their customers got 3,705 Highreels: 1,830 opened (49%), 212 shared, and 40 tapped the button.')
    expect(text(reachSentence({ ...reach, live: 10, opened: 4, shared: 1 }, 'Customers got'))).toBe('Customers got 10 Highreels: 4 opened (40%) and 1 shared.')
  })

  test('none opened, or nothing sent', () => {
    expect(text(reachSentence({ ...reach, live: 1 }, 'Customers got'))).toBe('Customers got 1 Highreel, none opened yet.')
    expect(text(reachSentence(reach, 'Customers got'))).toBe('Customers got no Highreels yet.')
  })
})

describe('overviewSummary', () => {
  test('accounts, what they made, what customers did, what came in', () => {
    const lines = overviewSummary(overview({
      accounts: 142, demos: 9, joined_week: 12, active_week: 40, makers: 37, highreels: 58, publishers: 14, published: 20,
      reach: { live: 4120, opened: 1830, saved: 300, shared: 212, clicked: 50 }, payers: 3, payments: 4, refunded: 1, revenue: { usd: 29700 },
    }))
    expect(lines.map(text)).toEqual([
      '142 accounts, 12 new this week; 40 signed in this week. 9 demo sessions running.',
      '37 accounts made 58 Highreels; 20 are published, by 14 accounts.',
      'Their customers got 4,120 Highreels: 1,830 opened (44%), 300 saved the image, 212 shared, and 50 tapped the button.',
      '3 accounts paid $297 in 4 payments (1 refunded).',
    ])
  })

  test('a quiet start', () => {
    expect(overviewSummary(overview({ accounts: 1, demos: 1, active_week: 1 })).map(text)).toEqual([
      '1 account; 1 signed in this week. 1 demo session running.',
      'No account has made a Highreel yet.',
      'No payments yet.',
    ])
  })

  test('numbers are separate parts (set in bold)', () => {
    expect(overviewSummary(overview({ accounts: 1200 }))[0]![0]).toEqual({ n: '1,200' })
  })
})

describe('userSummary', () => {
  test('made, published, unpaid, reach, emails, paid', () => {
    expect(userSummary(user({ highreels: 4, published: 2, unpaid: 1, live: 390, opened: 120, shared: 9, emails: 380, payments: 1, spent: { usd: 9900 } })).map(text)).toEqual([
      'Made 4 Highreels, published 2 (1 not paid for).',
      'Customers got 390 Highreels: 120 opened (31%) and 9 shared.',
      'Sent 380 emails from their own account.',
      'Paid $99 in 1 payment.',
    ])
  })

  test('nothing yet', () => {
    expect(userSummary(user({})).map(text)).toEqual(['No Highreels yet.', 'No payments.'])
  })
})
