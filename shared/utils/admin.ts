// The admin pages' numbers (SPEC M2.15): money per currency, and the
// overview and a user's page as short lists of figures (owner, 2026-10-13:
// easy to read; no sentences, no stat tiles). Pure, so they're unit-tested.

import type { AdminOverview, AdminUser, Money, Reach } from '../types/admin'

const fmt = (x: number) => x.toLocaleString('en-US')
const plural = (x: number, one: string, many: string) => (x === 1 ? one : many)

/** Minor units per major unit of a currency (100 for usd, 1 for jpy). */
function scale(currency: string): number {
  try {
    return 10 ** (new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2)
  }
  catch {
    return 100
  }
}

/** One amount in minor units: 9900 usd → "$99", 12345 eur → "€123.45". */
export function formatAmount(amount: number, currency: string): string {
  const value = amount / scale(currency)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: Number.isInteger(value) ? 0 : undefined,
    }).format(value)
  }
  catch {
    return `${fmt(value)} ${currency.toUpperCase()}`
  }
}

/** Amounts in several currencies, biggest first: "$198 + €92"; "–" for none. */
export function formatMoney(money: Money): string {
  const parts = Object.entries(money).filter(([, v]) => v > 0).sort((a, b) => b[1] / scale(b[0]) - a[1] / scale(a[0]))
  return parts.length ? parts.map(([c, v]) => formatAmount(v, c)).join(' + ') : '–'
}

/** For sorting by spend across currencies: the sum of the major amounts (close enough to order by). */
export const moneySize = (money: Money) => Object.entries(money).reduce((s, [c, v]) => s + v / scale(c), 0)

/** "44%" of a whole; "–" when there's nothing to take it of. */
export const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '–')

/** One number on the admin pages: a label, its value, and where it leads. */
export interface Figure {
  label: string
  value: string
  /** quieter, after the value: "by 8 accounts", "49%" */
  detail?: string
  /** the list behind it */
  to?: string
  /** worth a look (Highreels published but not paid for) */
  flag?: boolean
}

export interface FigureGroup {
  title: string
  figures: Figure[]
}

const by = (x: number) => `by ${fmt(x)} ${plural(x, 'account', 'accounts')}`

/** What customers did with a set of Highreels. */
function reachFigures(r: Reach): Figure[] {
  return [
    { label: 'Got a Highreel', value: fmt(r.live) },
    { label: 'Opened', value: fmt(r.opened), detail: r.live ? percent(r.opened, r.live) : undefined },
    { label: 'Saved the image', value: fmt(r.saved) },
    { label: 'Shared', value: fmt(r.shared) },
    { label: 'Tapped the button', value: fmt(r.clicked) },
  ]
}

/** The service at a glance, in four short lists (no sentences, no tiles). */
export function overviewFigures(o: AdminOverview): FigureGroup[] {
  return [
    {
      title: 'People',
      figures: [
        { label: 'Accounts', value: fmt(o.accounts), to: '/app/admin/users' },
        { label: 'New this week', value: fmt(o.joined_week) },
        { label: 'Signed in this week', value: fmt(o.active_week) },
        { label: 'Demos running', value: fmt(o.demos), to: '/app/admin/users?kind=demos' },
        { label: 'Blocked', value: fmt(o.blocked), to: '/app/admin/users?kind=blocked' },
      ],
    },
    {
      title: 'Highreels',
      figures: [
        { label: 'Made', value: fmt(o.highreels), detail: o.highreels ? by(o.makers) : undefined, to: '/app/admin/highreels' },
        { label: 'Published', value: fmt(o.published), detail: o.published ? by(o.publishers) : undefined, to: '/app/admin/highreels?show=published' },
        { label: 'Not paid for', value: fmt(o.unpaid), to: '/app/admin/highreels?show=unpaid', flag: o.unpaid > 0 },
      ],
    },
    { title: 'Their customers', figures: reachFigures(o.reach) },
    {
      title: 'Money',
      figures: [
        { label: 'Taken', value: formatMoney(o.revenue), to: '/app/admin/payments' },
        { label: 'Payments', value: fmt(o.payments) },
        { label: 'Paying accounts', value: fmt(o.payers) },
        { label: 'Refunded', value: fmt(o.refunded) },
      ],
    },
  ]
}

/** A user's page: what they made, how it went out, what they paid. */
export function userFigures(u: AdminUser): FigureGroup[] {
  return [
    {
      title: 'Highreels',
      figures: [
        { label: 'Made', value: fmt(u.highreels) },
        { label: 'Published', value: fmt(u.published) },
        { label: 'Not paid for', value: fmt(u.unpaid), flag: u.unpaid > 0 },
        { label: 'Emails sent', value: fmt(u.emails) },
      ],
    },
    { title: 'Their customers', figures: reachFigures(u) },
    {
      title: 'Money',
      figures: [
        { label: 'Spent', value: formatMoney(u.spent) },
        { label: 'Payments', value: fmt(u.payments) },
      ],
    },
  ]
}
