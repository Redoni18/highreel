// Whop's webhook signature and payments (SPEC §10, server/utils/whop.ts and
// payments.ts): the signature as @whop/sdk computes it (HMAC-SHA256 keyed
// with the whole `ws_` secret), and what a payment's metadata must say.
import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { amountOf, isPaymentId, verifyWebhook, type Whop, type WhopPayment } from '../server/utils/whop'
import { isPaid, minorUnits, netOf, paymentRef } from '../server/utils/payments'

const SECRET = 'ws_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const sign = (id: string, ts: string, body: string, secret = SECRET) => `v1,${createHmac('sha256', secret).update(`${id}.${ts}.${body}`).digest('base64')}`

describe('verifyWebhook', () => {
  const body = JSON.stringify({ type: 'payment.succeeded', data: { id: 'pay_abc123' } })
  const now = 1_792_000_000_000
  const ts = String(now / 1000)

  test('accepts Whop\'s signature', async () => {
    expect(await verifyWebhook(SECRET, { id: 'msg_1', timestamp: ts, signature: sign('msg_1', ts, body) }, body, now)).toBe(true)
  })

  test('accepts it among several (a secret being rotated)', async () => {
    const signature = `v1,AAAA ${sign('msg_1', ts, body)}`
    expect(await verifyWebhook(SECRET, { id: 'msg_1', timestamp: ts, signature }, body, now)).toBe(true)
  })

  test('refuses a changed body, another secret, another id, or a missing header', async () => {
    const signature = sign('msg_1', ts, body)
    expect(await verifyWebhook(SECRET, { id: 'msg_1', timestamp: ts, signature }, `${body} `, now)).toBe(false)
    expect(await verifyWebhook(`${SECRET}0`, { id: 'msg_1', timestamp: ts, signature }, body, now)).toBe(false)
    expect(await verifyWebhook(SECRET, { id: 'msg_2', timestamp: ts, signature }, body, now)).toBe(false)
    expect(await verifyWebhook(SECRET, { id: 'msg_1', timestamp: ts, signature: null }, body, now)).toBe(false)
    expect(await verifyWebhook('', { id: 'msg_1', timestamp: ts, signature }, body, now)).toBe(false)
  })

  test('refuses an old delivery (more than five minutes)', async () => {
    const old = String(now / 1000 - 6 * 60)
    expect(await verifyWebhook(SECRET, { id: 'msg_1', timestamp: old, signature: sign('msg_1', old, body) }, body, now)).toBe(false)
  })
})

describe('payments', () => {
  const w = { product: 'prod_ours' } as Whop
  const payment = (over: Partial<WhopPayment> = {}): WhopPayment => ({
    id: 'pay_abc123', status: 'paid', currency: 'usd', total: 118.8, subtotal: 99, tax_amount: 19.8, refunded_amount: 0, paid_at: '2026-10-14T12:00:00Z',
    metadata: { business_id: 'b1', campaign_id: 'c1', tier: 'founding' }, product: { id: 'prod_ours' }, ...over,
  })

  test('a payment from our checkout names its business, campaign and size', () => {
    expect(paymentRef(w, payment())).toEqual({ businessId: 'b1', campaignId: 'c1', tier: 'founding' })
  })

  test('anything else is not ours', () => {
    expect(paymentRef(w, payment({ product: { id: 'prod_other' } }))).toBeNull()
    expect(paymentRef(w, payment({ metadata: null }))).toBeNull()
    expect(paymentRef(w, payment({ metadata: { business_id: 'b1', campaign_id: 'c1', tier: 'huge' } }))).toBeNull()
  })

  test('paid means collected and not given back', () => {
    expect(isPaid(payment())).toBe(true)
    expect(isPaid(payment({ status: 'open' }))).toBe(false)
    // Whop's shape: money as objects; a payment.succeeded retried after a full refund.
    const money = (amount: string) => ({ currency: 'usd', amount, decimals: 2 })
    expect(isPaid(payment({ total: money('99.00'), tax_amount: money('0.00'), refunded_amount: money('99.00'), substatus: 'refunded' }))).toBe(false)
    expect(isPaid(payment({ total: money('99.00'), tax_amount: money('0.00'), refunded_amount: money('20.00') }))).toBe(true)
  })

  test('amounts in minor units', () => {
    expect(minorUnits(99, 'usd')).toBe(9900)
    expect(minorUnits(92.5, 'eur')).toBe(9250)
    expect(minorUnits(15000, 'jpy')).toBe(15000)
    expect(minorUnits(-1, 'usd')).toBe(0)
  })

  test('amounts as Whop sends them: objects now, numbers in its reference', () => {
    expect(amountOf({ currency: 'usd', amount: '99.00', decimals: 2 })).toBe(99)
    expect(amountOf(118.8)).toBe(118.8)
    expect(amountOf(null)).toBeNull()
    expect(amountOf({ amount: 'x' })).toBeNull()
    expect(minorUnits(Number.NaN, 'usd')).toBe(0)
  })

  test('what Whop pays out after its fees, from amount_after_fees (SPEC M2.16)', () => {
    const money = (amount: string, currency = 'usd') => ({ currency, amount, decimals: 2 })
    // The sandbox's $99 sale left $93.68.
    expect(netOf(payment({ amount_after_fees: money('93.68') }), 'usd', 9900)).toBe(9368)
    expect(netOf(payment({ amount_after_fees: money('0.00') }), 'usd', 0)).toBe(0)
    // Not said yet, said in another currency, or still the whole amount (right after paying, Whop hasn't worked out its fees).
    expect(netOf(payment(), 'usd', 9900)).toBeNull()
    expect(netOf(payment({ amount_after_fees: money('86.00', 'eur') }), 'usd', 9900)).toBeNull()
    expect(netOf(payment({ amount_after_fees: money('99.00') }), 'usd', 9900)).toBeNull()
    expect(netOf(payment({ amount_after_fees: money('118.80') }), 'usd', 9900)).toBeNull()
  })

  test('payment ids', () => {
    expect(isPaymentId('pay_abc123')).toBe(true)
    expect(isPaymentId('pay_../x')).toBe(false)
    expect(isPaymentId('ch_abc123')).toBe(false)
  })
})
