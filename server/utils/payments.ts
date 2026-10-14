// Payments (SPEC §10, the table in migrations/0004_admin.sql), written on
// Whop's word only, never a browser's: the signed webhook, or the confirm
// route after it reads the payment back from Whop's API. A payment names its
// business and campaign in the metadata our server put on its checkout; it's
// recorded only for a campaign of that business (or, once the campaign is
// gone, the business alone), and only once per Whop payment. The workspace
// reads what a campaign has paid for through the data layer (paidTiers in db.ts).

import type { H3Event } from 'h3'
import { isTier } from '#shared/utils/pricing'
import { amountOf, checkoutEnvironment, type Whop, type WhopPayment } from './whop'

export interface PaymentRef {
  businessId: string
  campaignId: string
  tier: string
}

/** The campaign a payment is for, from its metadata; null for one our checkout didn't make. */
export function paymentRef(w: Whop, p: WhopPayment): PaymentRef | null {
  const m = p.metadata ?? {}
  if (p.product?.id && p.product.id !== w.product)
    return null
  const { business_id: businessId, campaign_id: campaignId, tier } = m
  if (typeof businessId !== 'string' || typeof campaignId !== 'string' || !isTier(tier))
    return null
  return { businessId, campaignId, tier }
}

/** Whop has given back all of what it was for (tax aside). */
export function isRefunded(p: WhopPayment): boolean {
  const refunded = amountOf(p.refunded_amount) ?? 0
  return refunded > 0 && refunded >= (amountOf(p.total) ?? 0) - (amountOf(p.tax_amount) ?? 0) - 0.01
}

/**
 * Collected and not given back. A payment.succeeded delivered (or retried)
 * after a refund still says `paid`, with substatus `refunded` (Whop's sandbox, 2026-10-14).
 */
export const isPaid = (p: WhopPayment) => (p.status === 'paid' || p.substatus === 'succeeded') && !isRefunded(p)

/** An amount in a currency's minor units: 99 usd → 9900, 1500 jpy → 1500. */
export function minorUnits(amount: number, currency: string): number {
  let digits = 2
  try {
    digits = new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).resolvedOptions().maximumFractionDigits ?? 2
  }
  catch {}
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 10 ** digits)) : 0
}

/**
 * Record a paid payment. Answers whether this call added it (false: Whop sent
 * it before, it isn't paid, or it isn't for a business of ours).
 */
export async function recordPayment(event: H3Event, ref: PaymentRef, p: WhopPayment): Promise<boolean> {
  if (!isPaid(p))
    return false
  const d1 = bindings(event).DB
  const currency = (p.currency || 'usd').toLowerCase()
  // What the business paid before tax.
  const amount = minorUnits((amountOf(p.total) ?? amountOf(p.subtotal) ?? 0) - (amountOf(p.tax_amount) ?? 0), currency)
  const paidAt = p.paid_at ? new Date(p.paid_at).toISOString() : new Date().toISOString()
  const values = [crypto.randomUUID(), p.id, ref.tier, amount, currency, paidAt]
  const { meta } = await d1.prepare(`insert into payments (id, business_id, campaign_id, provider, provider_id, tier, amount, currency, status, paid_at)
    select ?, c.business_id, c.id, 'whop', ?, ?, ?, ?, 'paid', ? from campaigns c where c.id = ? and c.business_id = ?
    on conflict (provider, provider_id) do nothing`).bind(...values, ref.campaignId, ref.businessId).run()
  if (meta.changes)
    return true
  // The campaign was deleted while its checkout was open: the payment still belongs to the business.
  const { meta: kept } = await d1.prepare(`insert into payments (id, business_id, campaign_id, provider, provider_id, tier, amount, currency, status, paid_at)
    select ?, b.id, null, 'whop', ?, ?, ?, ?, 'paid', ? from businesses b where b.id = ?
    on conflict (provider, provider_id) do nothing`).bind(...values, ref.businessId).run()
  return kept.changes > 0
}

/**
 * Mark a payment refunded once Whop has given back what it was for (a
 * partial refund leaves it paid). Answers whether it changed.
 */
export async function recordRefund(event: H3Event, p: WhopPayment): Promise<boolean> {
  if (!isRefunded(p))
    return false
  const { meta } = await bindings(event).DB.prepare(`update payments set status = 'refunded', refunded_at = ?
    where provider = 'whop' and provider_id = ? and status = 'paid'`).bind(new Date().toISOString(), p.id).run()
  return meta.changes > 0
}

/**
 * Whether publishing a campaign takes a payment: checkout is on, it's an
 * account (demos publish free, owner 2026-10-14: the FAQ promises it, and
 * their links go with the demo after 30 days), and it's a list of customers
 * (a business's own Highreel, one page about itself, is free).
 */
export function paysToPublish(event: H3Event, anonymous: boolean, campaign: { kind: string }): boolean {
  return !!checkoutEnvironment(event) && !anonymous && campaign.kind === 'customers'
}
