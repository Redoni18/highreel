// The admin pages' figures and money (SPEC M2.15).

import { describe, expect, test } from 'vitest'
import type { AdminOverview, AdminUser } from '../shared/types/admin'
import { type FigureGroup, formatAmount, formatMoney, moneySize, overviewFigures, percent, userFigures } from '../shared/utils/admin'

const reach = { live: 0, opened: 0, saved: 0, shared: 0, clicked: 0 }

function overview(over: Partial<AdminOverview>): AdminOverview {
  return {
    accounts: 0, demos: 0, admins: 0, blocked: 0, joined_week: 0, active_week: 0, makers: 0, highreels: 0, publishers: 0,
    published: 0, unpaid: 0, reach, payers: 0, payments: 0, refunded: 0, revenue: {},
    newest: [], latest_published: [], latest_payments: [], ...over,
  }
}

function user(over: Partial<AdminUser>): AdminUser {
  return {
    id: 'u', email: 'ana@example.com', demo: false, role: 'client', blocked: false, created_at: '2026-10-01T00:00:00Z', last_seen: null,
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

// A group's figures as "label value (detail)" lines, to compare in one go.
const lines = (g: FigureGroup) => g.figures.map(f => `${f.label} ${f.value}${f.detail ? ` (${f.detail})` : ''}`)

describe('overviewFigures', () => {
  test('people, Highreels, their customers, money: one number a row', () => {
    const groups = overviewFigures(overview({
      accounts: 142, demos: 9, blocked: 2, joined_week: 12, active_week: 40, makers: 37, highreels: 58, publishers: 14, published: 20, unpaid: 3,
      reach: { live: 4120, opened: 1830, saved: 300, shared: 212, clicked: 50 }, payers: 3, payments: 4, refunded: 1, revenue: { usd: 29700 },
    }))
    expect(groups.map(g => g.title)).toEqual(['People', 'Highreels', 'Their customers', 'Money'])
    expect(groups.map(lines)).toEqual([
      ['Accounts 142', 'New this week 12', 'Signed in this week 40', 'Demos running 9', 'Blocked 2'],
      ['Made 58 (by 37 accounts)', 'Published 20 (by 14 accounts)', 'Not paid for 3'],
      ['Got a Highreel 4,120', 'Opened 1,830 (44%)', 'Saved the image 300', 'Shared 212', 'Tapped the button 50'],
      ['Taken $297', 'Payments 4', 'Paying accounts 3', 'Refunded 1'],
    ])
  })

  test('unpaid Highreels are flagged and lead to their list', () => {
    const unpaid = (o: Partial<AdminOverview>) => overviewFigures(overview(o))[1]!.figures.find(f => f.label === 'Not paid for')!
    expect(unpaid({ unpaid: 3 })).toMatchObject({ flag: true, to: '/app/admin/highreels?show=unpaid' })
    expect(unpaid({}).flag).toBe(false)
  })

  test('a quiet start: zeros, no percentages of nothing, no money', () => {
    expect(overviewFigures(overview({ accounts: 1, demos: 1, active_week: 1 })).map(lines)).toEqual([
      ['Accounts 1', 'New this week 0', 'Signed in this week 1', 'Demos running 1', 'Blocked 0'],
      ['Made 0', 'Published 0', 'Not paid for 0'],
      ['Got a Highreel 0', 'Opened 0', 'Saved the image 0', 'Shared 0', 'Tapped the button 0'],
      ['Taken –', 'Payments 0', 'Paying accounts 0', 'Refunded 0'],
    ])
  })
})

describe('userFigures', () => {
  test('made and sent, what customers did, what they paid', () => {
    expect(userFigures(user({ highreels: 4, published: 2, unpaid: 1, live: 390, opened: 120, shared: 9, emails: 380, payments: 1, spent: { usd: 9900 } })).map(lines)).toEqual([
      ['Made 4', 'Published 2', 'Not paid for 1', 'Emails sent 380'],
      ['Got a Highreel 390', 'Opened 120 (31%)', 'Saved the image 0', 'Shared 9', 'Tapped the button 0'],
      ['Spent $99', 'Payments 1'],
    ])
  })
})
