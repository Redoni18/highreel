// The admin pages' figures and money (SPEC M2.15, cards and panels since M2.16).

import { describe, expect, test } from 'vitest'
import type { AdminOverview, AdminPayment, AdminUser } from '../shared/types/admin'
import { type Figure, type FigureGroup, feeOf, formatAmount, formatMoney, formatTotal, highreelFigures, moneySize, overviewAlerts, overviewCards, overviewPanels, paymentCards, paymentTotals, percent, userCards, userStage } from '../shared/utils/admin'

const reach = { live: 0, opened: 0, saved: 0, shared: 0, clicked: 0 }

function overview(over: Partial<AdminOverview>): AdminOverview {
  return {
    accounts: 0, demos: 0, admins: 0, blocked: 0, joined_week: 0, active_week: 0, makers: 0, highreels: 0, publishers: 0,
    published: 0, unpaid: 0, reach, payers: 0, payments: 0, refunded: 0, revenue: {}, revenue_known: {}, net: {}, refunds: {}, unknown_net: 0,
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

// A figure as "label value (detail)", to compare in one go.
const line = (f: Figure) => `${f.label} ${f.value}${f.detail ? ` (${f.detail})` : ''}`
const lines = (g: FigureGroup) => g.figures.map(line)

const busy = {
  accounts: 142, demos: 9, blocked: 2, joined_week: 12, active_week: 40, makers: 37, highreels: 58, publishers: 14, published: 20, unpaid: 3,
  reach: { live: 4120, opened: 1830, saved: 300, shared: 212, clicked: 50 }, payers: 3, payments: 4, refunded: 1,
  revenue: { usd: 39600 }, revenue_known: { usd: 29700 }, net: { usd: 28100 }, refunds: { usd: 9900 }, unknown_net: 1,
}

describe('the overview (SPEC M2.16)', () => {
  test('opens with four cards: accounts, published, customers reached, taken home', () => {
    expect(overviewCards(overview(busy)).map(line)).toEqual([
      'Accounts 142 (12 new this week)',
      'Published Highreels 20 (of 58 made)',
      'Customers reached 4,120 (44% opened theirs)',
      'Taken home $281 (1 payment not counted yet)',
    ])
    expect(overviewCards(overview({ ...busy, unknown_net: 0, revenue_known: busy.revenue }))[3]).toMatchObject({ detail: 'of $396 paid' })
    expect(overviewCards(overview(busy)).map(c => c.to)).toEqual(['/app/admin/users', '/app/admin/highreels?show=published', undefined, '/app/admin/payments'])
  })

  test('then the way from sign-up to paid, what customers did, people and money', () => {
    const panels = overviewPanels(overview(busy))
    expect(panels.map(g => g.title)).toEqual(['From sign-up to paid', 'What their customers did', 'People', 'Money'])
    expect(panels.map(lines)).toEqual([
      ['Signed up 142', 'Made a Highreel 37 (26%)', 'Published one 14 (10%)', 'Paid 3 (2%)'],
      ['Got a Highreel 4,120', 'Opened 1,830 (44%)', 'Saved the image 300 (7%)', 'Shared 212 (5%)', 'Tapped the button 50 (1%)'],
      ['New this week 12', 'Signed in this week 40', 'Demos running 9', 'Blocked 2'],
      ['Paid $396 (4 payments)', 'Whop\'s fees $16 (on 3 of 4 payments)', 'Taken home $281', 'Refunded $99 (1 payment)'],
    ])
  })

  test('published Highreels nobody paid for need a look, and lead to their list', () => {
    expect(overviewAlerts(overview({ unpaid: 3 }))).toEqual([{ label: '3 Highreels published without a payment', value: '3', to: '/app/admin/highreels?show=unpaid', flag: true }])
    expect(overviewAlerts(overview({ unpaid: 1 }))[0]!.label).toBe('1 Highreel published without a payment')
    expect(overviewAlerts(overview({}))).toEqual([])
  })

  test('a quiet start: zeros, no percentages of nothing, $0 rather than a dash', () => {
    expect(overviewCards(overview({ accounts: 1, demos: 1, active_week: 1 })).map(line)).toEqual([
      'Accounts 1 (0 new this week)',
      'Published Highreels 0 (none made yet)',
      'Customers reached 0 (none yet)',
      'Taken home $0 (of $0 paid)',
    ])
    expect(overviewPanels(overview({ accounts: 1 }))[0]!.figures.map(line)).toEqual(['Signed up 1', 'Made a Highreel 0 (0%)', 'Published one 0 (0%)', 'Paid 0 (0%)'])
    expect(overviewPanels(overview({}))[1]!.figures.map(line)).toEqual(['Got a Highreel 0', 'Opened 0', 'Saved the image 0', 'Shared 0', 'Tapped the button 0'])
  })
})

describe('a user', () => {
  test('stage: new, draft, published, paying', () => {
    expect(userStage(user({}))).toBe('new')
    expect(userStage(user({ highreels: 2 }))).toBe('draft')
    expect(userStage(user({ highreels: 2, published: 1 }))).toBe('published')
    expect(userStage(user({ highreels: 2, published: 1, payments: 1 }))).toBe('paying')
  })

  test('their page opens with what they made, reached, sent and spent', () => {
    const cards = userCards(user({ highreels: 4, published: 2, unpaid: 1, live: 390, opened: 120, shared: 9, emails: 380, payments: 1, spent: { usd: 9900 } }))
    expect(cards.map(line)).toEqual([
      'Highreels 4 (2 published, 1 not paid for)',
      'Customers reached 390 (31% opened theirs)',
      'Emails sent 380 (from their own account)',
      'Spent $99 (1 payment)',
    ])
    expect(cards[0]!.flag).toBe(true)
    expect(userCards(user({}))[3]!.value).toBe('$0')
  })

  test('a Highreel\'s panel: its sheet, how it went out, what customers did', () => {
    const h = {
      id: 'h', name: '2026', year: 2026, template_key: 'app', kind: 'customers' as const, status: 'published' as const, created_at: '', published_at: null,
      business_id: 'b', business: 'Habitly', owner_id: 'u', owner_email: null, rows: 200, views: 140, payments: 1, paid: { usd: 9900 },
      live: 195, opened: 100, saved: 10, shared: 5, clicked: 2, emailed: 190, whatsapp: 4,
    }
    expect(highreelFigures(h).map(g => [g.title, ...lines(g)])).toEqual([
      ['The sheet', 'Rows 200', 'With a link 195'],
      ['Sent', 'By email 190', 'On WhatsApp 4'],
      ['Their customers', 'Got a Highreel 195', 'Opened 100 (51%)', 'Saved the image 10 (5%)', 'Shared 5 (3%)', 'Tapped the button 2 (1%)', 'Views, all told 140'],
    ])
    expect(highreelFigures({ ...h, kind: 'business' }).map(lines)).toEqual([['Views 140']])
  })
})

describe('payments (SPEC M2.16)', () => {
  const pay = (over: Partial<AdminPayment>): AdminPayment => ({
    id: 'p', business_id: 'b', business: 'Habitly', owner_id: 'u', owner_email: 'ana@example.com', campaign_id: 'c', campaign: '2026',
    tier: 'founding', amount: 9900, net: 9368, currency: 'usd', status: 'paid', paid_at: '2026-10-14T12:00:00Z', refunded_at: null, ...over,
  })

  test('paid, Whop\'s fees, taken home and refunded, from Whop\'s own figures', () => {
    const t = paymentTotals([pay({ id: 'a' }), pay({ id: 'b', amount: 39900, net: 37900, tier: '10k' }), pay({ id: 'c', status: 'refunded', refunded_at: '2026-10-15T00:00:00Z' })])
    expect(t).toMatchObject({ paid: { usd: 49800 }, net: { usd: 47268 }, fees: { usd: 2532 }, refunded: { usd: 9900 }, payments: 2, refunds: 1, unknown: 0 })
    expect(paymentCards(t).map(line)).toEqual([
      'Paid $498 (2 payments, before tax)',
      'Whop\'s fees $25.32 (5% of what was paid)',
      'Taken home $472.68 (what Whop pays out)',
      'Refunded $99 (1 payment)',
    ])
  })

  test('a payment Whop hasn\'t given its figure for counts apart', () => {
    const t = paymentTotals([pay({ id: 'a' }), pay({ id: 'b', net: null })])
    expect(t).toMatchObject({ paid: { usd: 19800 }, known: { usd: 9900 }, fees: { usd: 532 }, unknown: 1 })
    expect(paymentCards(t)[1]).toMatchObject({ value: '$5.32', detail: '1 payment without Whop\'s figure yet', flag: true })
    expect(feeOf(pay({ net: null }))).toBeNull()
    expect(feeOf(pay({}))).toBe(532)
  })

  test('nothing yet: $0 everywhere', () => {
    expect(paymentCards(paymentTotals([])).map(line)).toEqual([
      'Paid $0 (0 payments, before tax)',
      'Whop\'s fees $0 (none yet)',
      'Taken home $0 (what Whop pays out)',
      'Refunded $0 (0 payments)',
    ])
    expect(formatTotal({})).toBe('$0')
    expect(formatTotal({ usd: 0 })).toBe('$0')
  })
})
