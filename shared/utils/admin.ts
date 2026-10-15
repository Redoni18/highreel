// The admin pages' numbers (SPEC M2.15, laid out again in M2.16): money per
// currency, the cards each page opens with (owner, 2026-10-15) and the short
// lists of figures under them (2026-10-13: easy to read, no sentences). Pure,
// so they're unit-tested.

import type { AdminOverview, AdminPayment, AdminUser, AdminUserHighreel, Money, Reach } from '../types/admin'

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
  /** the list behind the whole group */
  to?: string
}

const count = (x: number, one: string, many: string) => `${fmt(x)} ${plural(x, one, many)}`

/** A total for a card: "$0" rather than a dash when nothing came in (prices are in dollars). */
export function formatTotal(money: Money): string {
  const shown = formatMoney(money)
  return shown === '–' ? formatAmount(0, Object.keys(money)[0] ?? 'usd') : shown
}

/** What customers did with a set of Highreels, each with its share of those who got one. */
function reachFigures(r: Reach): Figure[] {
  const of = (x: number) => (r.live ? percent(x, r.live) : undefined)
  return [
    { label: 'Got a Highreel', value: fmt(r.live) },
    { label: 'Opened', value: fmt(r.opened), detail: of(r.opened) },
    { label: 'Saved the image', value: fmt(r.saved), detail: of(r.saved) },
    { label: 'Shared', value: fmt(r.shared), detail: of(r.shared) },
    { label: 'Tapped the button', value: fmt(r.clicked), detail: of(r.clicked) },
  ]
}

// --- The overview (SPEC M2.16) ------------------------------------------------------

/** The four numbers the overview opens with. */
export function overviewCards(o: AdminOverview): Figure[] {
  return [
    { label: 'Accounts', value: fmt(o.accounts), detail: `${fmt(o.joined_week)} new this week`, to: '/app/admin/users' },
    { label: 'Published Highreels', value: fmt(o.published), detail: o.highreels ? `of ${fmt(o.highreels)} made` : 'none made yet', to: '/app/admin/highreels?show=published' },
    { label: 'Customers reached', value: fmt(o.reach.live), detail: o.reach.live ? `${percent(o.reach.opened, o.reach.live)} opened theirs` : 'none yet' },
    o.unknown_net
      ? { label: 'Taken home', value: formatTotal(o.net), detail: `${count(o.unknown_net, 'payment', 'payments')} not counted yet`, to: '/app/admin/payments', flag: true }
      : { label: 'Taken home', value: formatTotal(o.net), detail: `of ${formatTotal(o.revenue)} paid`, to: '/app/admin/payments' },
  ]
}

/** What needs a look, if anything: published customer Highreels nobody paid for. */
export function overviewAlerts(o: AdminOverview): Figure[] {
  return o.unpaid
    ? [{ label: `${count(o.unpaid, 'Highreel', 'Highreels')} published without a payment`, value: fmt(o.unpaid), to: '/app/admin/highreels?show=unpaid', flag: true }]
    : []
}

/** The overview's panels: the way from sign-up to paid, what customers did, people, money. */
export function overviewPanels(o: AdminOverview): FigureGroup[] {
  const of = (x: number) => (o.accounts ? percent(x, o.accounts) : undefined)
  return [
    {
      title: 'From sign-up to paid',
      figures: [
        { label: 'Signed up', value: fmt(o.accounts), to: '/app/admin/users' },
        { label: 'Made a Highreel', value: fmt(o.makers), detail: of(o.makers) },
        { label: 'Published one', value: fmt(o.publishers), detail: of(o.publishers), to: '/app/admin/highreels?show=published' },
        { label: 'Paid', value: fmt(o.payers), detail: of(o.payers), to: '/app/admin/payments' },
      ],
    },
    { title: 'What their customers did', figures: reachFigures(o.reach) },
    {
      title: 'People',
      figures: [
        { label: 'New this week', value: fmt(o.joined_week) },
        { label: 'Signed in this week', value: fmt(o.active_week) },
        { label: 'Demos running', value: fmt(o.demos), to: '/app/admin/users?kind=demos' },
        { label: 'Blocked', value: fmt(o.blocked), to: '/app/admin/users?kind=blocked' },
      ],
    },
    {
      title: 'Money',
      to: '/app/admin/payments',
      figures: [
        { label: 'Paid', value: formatTotal(o.revenue), detail: count(o.payments, 'payment', 'payments') },
        { label: 'Whop\'s fees', value: formatTotal(feesOf(o.revenue_known, o.net)), detail: o.unknown_net ? `on ${fmt(o.payments - o.unknown_net)} of ${count(o.payments, 'payment', 'payments')}` : moneySize(o.revenue_known) ? percent(moneySize(feesOf(o.revenue_known, o.net)), moneySize(o.revenue_known)) : undefined },
        { label: 'Taken home', value: formatTotal(o.net) },
        { label: 'Refunded', value: formatTotal(o.refunds), detail: count(o.refunded, 'payment', 'payments') },
      ],
    },
  ]
}

// --- Users ------------------------------------------------------------------------------

/** Where an account has got to: the Stage column on Users. */
export type Stage = 'new' | 'draft' | 'published' | 'paying'
export const STAGES: Record<Stage, { label: string, hint: string }> = {
  new: { label: 'New', hint: 'No Highreel yet' },
  draft: { label: 'Draft', hint: 'Made a Highreel, published none' },
  published: { label: 'Published', hint: 'Published, never paid' },
  paying: { label: 'Paying', hint: 'Paid for at least one Highreel' },
}
export function userStage(u: Pick<AdminUser, 'highreels' | 'published' | 'payments'>): Stage {
  return u.payments ? 'paying' : u.published ? 'published' : u.highreels ? 'draft' : 'new'
}

/** The four numbers a user's page opens with. */
export function userCards(u: AdminUser): Figure[] {
  return [
    { label: 'Highreels', value: fmt(u.highreels), detail: u.unpaid ? `${fmt(u.published)} published, ${fmt(u.unpaid)} not paid for` : `${fmt(u.published)} published`, flag: u.unpaid > 0 },
    { label: 'Customers reached', value: fmt(u.live), detail: u.live ? `${percent(u.opened, u.live)} opened theirs` : 'none yet' },
    { label: 'Emails sent', value: fmt(u.emails), detail: 'from their own account' },
    { label: 'Spent', value: formatTotal(u.spent), detail: count(u.payments, 'payment', 'payments') },
  ]
}

/** One Highreel's numbers, for its panel on its owner's page. */
export function highreelFigures(h: AdminUserHighreel): FigureGroup[] {
  if (h.kind === 'business')
    return [{ title: 'Its visitors', figures: [{ label: 'Views', value: fmt(h.views) }] }]
  return [
    { title: 'The sheet', figures: [{ label: 'Rows', value: fmt(h.rows) }, { label: 'With a link', value: fmt(h.live) }] },
    { title: 'Sent', figures: [{ label: 'By email', value: fmt(h.emailed) }, { label: 'On WhatsApp', value: fmt(h.whatsapp) }] },
    { title: 'Their customers', figures: [...reachFigures(h), { label: 'Views, all told', value: fmt(h.views) }] },
  ]
}

// --- Payments ---------------------------------------------------------------------------

/** Whop's fee on the payments it has said it for: paid minus paid out, per currency. */
export function feesOf(paid: Money, net: Money): Money {
  return Object.fromEntries(Object.entries(paid).map(([c, v]) => [c, Math.max(0, v - (net[c] ?? 0))]))
}

export interface PaymentTotals {
  /** paid payments, before tax */
  paid: Money
  /** of them, those with Whop's figure */
  known: Money
  net: Money
  fees: Money
  refunded: Money
  payments: number
  refunds: number
  /** paid payments without Whop's figure yet */
  unknown: number
}

export function paymentTotals(list: AdminPayment[]): PaymentTotals {
  const t: PaymentTotals = { paid: {}, known: {}, net: {}, fees: {}, refunded: {}, payments: 0, refunds: 0, unknown: 0 }
  const add = (m: Money, c: string, v: number) => { m[c] = (m[c] ?? 0) + v }
  for (const p of list) {
    if (p.status === 'refunded') {
      t.refunds++
      add(t.refunded, p.currency, p.amount)
      continue
    }
    t.payments++
    add(t.paid, p.currency, p.amount)
    if (p.net == null) {
      t.unknown++
      continue
    }
    add(t.known, p.currency, p.amount)
    add(t.net, p.currency, p.net)
  }
  t.fees = feesOf(t.known, t.net)
  return t
}

/** The four cards on Payments: paid, Whop's fees, taken home, refunded. */
export function paymentCards(t: PaymentTotals): Figure[] {
  const share = moneySize(t.known) ? `${percent(moneySize(t.fees), moneySize(t.known))} of what was paid` : undefined
  const unknown = t.unknown ? `${count(t.unknown, 'payment', 'payments')} without Whop's figure yet` : undefined
  return [
    { label: 'Paid', value: formatTotal(t.paid), detail: `${count(t.payments, 'payment', 'payments')}, before tax` },
    { label: 'Whop\'s fees', value: formatTotal(t.fees), detail: unknown ?? share ?? 'none yet', flag: !!unknown },
    { label: 'Taken home', value: formatTotal(t.net), detail: 'what Whop pays out' },
    { label: 'Refunded', value: formatTotal(t.refunded), detail: count(t.refunds, 'payment', 'payments') },
  ]
}

/** Whop's fee on one payment; null until Whop says. */
export const feeOf = (p: Pick<AdminPayment, 'amount' | 'net'>) => (p.net == null ? null : Math.max(0, p.amount - p.net))
