// The admin pages' words and numbers (SPEC M2.15): money per currency, and
// the overview written in sentences like the home's (no stat tiles, SPEC §6).
// Pure, so they're unit-tested. Numbers come back as { n } parts for mono.

import type { AdminOverview, AdminUser, Money, Reach } from '../types/admin'
import type { Part, Phrase } from './home'

const fmt = (x: number) => x.toLocaleString('en-US')
const n = (x: number): Part => ({ n: fmt(x) })
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

/** What customers did, as a sentence: "Their customers got 3,705 Highreels: 1,830 opened (49%), 212 shared, and 40 tapped the button." */
export function reachSentence(r: Reach, lead: string): Phrase {
  if (!r.live)
    return [`${lead} no Highreels yet.`]
  const out: Phrase = [`${lead} `, n(r.live), ` ${plural(r.live, 'Highreel', 'Highreels')}`]
  if (!r.opened)
    return [...out, ', none opened yet.']
  const items: Phrase[] = [[n(r.opened), ' opened (', { n: percent(r.opened, r.live) }, ')']]
  for (const [k, verb] of [['saved', 'saved the image'], ['shared', 'shared'], ['clicked', 'tapped the button']] as const) {
    if (r[k])
      items.push([n(r[k]), ` ${verb}`])
  }
  out.push(': ')
  // "a, b, and c", like the home's sentences.
  items.forEach((item, i) => {
    if (i > 0)
      out.push(i === items.length - 1 ? (items.length > 2 ? ', and ' : ' and ') : ', ')
    out.push(...item)
  })
  out.push('.')
  return out
}

/** The service at a glance. */
export function overviewSummary(o: AdminOverview): Phrase[] {
  const lines: Phrase[] = []
  const people: Phrase = [n(o.accounts), ` ${plural(o.accounts, 'account', 'accounts')}`]
  if (o.joined_week)
    people.push(', ', n(o.joined_week), ' new this week')
  people.push('; ', n(o.active_week), ` signed in this week. `, n(o.demos), ` demo ${plural(o.demos, 'session', 'sessions')} running.`)
  lines.push(people)

  if (o.highreels) {
    lines.push([n(o.makers), ` ${plural(o.makers, 'account', 'accounts')} made `, n(o.highreels), ` ${plural(o.highreels, 'Highreel', 'Highreels')}; `,
      n(o.published), ` ${plural(o.published, 'is', 'are')} published, by `, n(o.publishers), ` ${plural(o.publishers, 'account', 'accounts')}.`])
    lines.push(reachSentence(o.reach, 'Their customers got'))
  }
  else if (o.accounts) {
    lines.push(['No account has made a Highreel yet.'])
  }

  if (o.payments) {
    const paid: Phrase = [n(o.payers), ` ${plural(o.payers, 'account', 'accounts')} paid `, { n: formatMoney(o.revenue) }, ' in ', n(o.payments), ` ${plural(o.payments, 'payment', 'payments')}`]
    if (o.refunded)
      paid.push(' (', n(o.refunded), ' refunded)')
    paid.push('.')
    lines.push(paid)
  }
  else {
    lines.push(['No payments yet.'])
  }
  return lines
}

/** A user's page, in sentences: what they made, how it went out, what they paid. */
export function userSummary(u: AdminUser): Phrase[] {
  const lines: Phrase[] = []
  if (!u.highreels)
    return [['No Highreels yet.'], u.payments ? paidLine(u) : ['No payments.']]
  const made: Phrase = ['Made ', n(u.highreels), ` ${plural(u.highreels, 'Highreel', 'Highreels')}, published `, n(u.published)]
  if (u.unpaid)
    made.push(' (', n(u.unpaid), ' not paid for)')
  made.push('.')
  lines.push(made)
  lines.push(reachSentence(u, 'Customers got'))
  if (u.emails)
    lines.push(['Sent ', n(u.emails), ` ${plural(u.emails, 'email', 'emails')} from their own account.`])
  lines.push(u.payments ? paidLine(u) : ['No payments.'])
  return lines
}

function paidLine(u: AdminUser): Phrase {
  return ['Paid ', { n: formatMoney(u.spent) }, ' in ', n(u.payments), ` ${plural(u.payments, 'payment', 'payments')}.`]
}
