// Whop, the checkout (SPEC §10): which Whop this server talks to (the
// sandbox takes test cards, production takes money), the Highreel product
// and its variant per size there, the two API calls the app makes, and the
// webhook's signature check. Switching to real payments is
// NUXT_PUBLIC_CHECKOUT=production with the live account's API key and
// webhook secret; nothing else here changes.

import type { H3Event } from 'h3'
import type { CheckoutEnvironment } from '#shared/types/recap'
import type { Charge, TierKey } from '#shared/utils/pricing'

interface WhopAccount {
  api: string
  /** the Highreel business on Whop, `biz_…` */
  account: string
  product: string
  /** a hidden one-time variant per size, its metadata `{ tier, max_recipients }` */
  plans: Record<TierKey, string>
}

/** Made 2026-10-14: production through Whop's MCP, the sandbox through its API (SPEC §10). */
const ACCOUNTS: Record<CheckoutEnvironment, WhopAccount> = {
  production: {
    api: 'https://api.whop.com/api/v1',
    account: 'biz_zcNRGohTpYJHH0',
    product: 'prod_rGEZtncBW6k1k',
    plans: { 'founding': 'plan_AU122fZXSaZZE', '1k': 'plan_YtEbCO7W5hxdm', '10k': 'plan_zfRJvojiVxATt', '50k': 'plan_ZOeLmPBJDxjHJ' },
  },
  sandbox: {
    api: 'https://sandbox-api.whop.com/api/v1',
    account: 'biz_w3rq0pqF0Sj6YJ',
    product: 'prod_3MvBKnHJ02teB',
    plans: { 'founding': 'plan_Y4VS2gurX4r19', '1k': 'plan_EM8i4Vr2SGoOt', '10k': 'plan_ZjIUrPm710E4b', '50k': 'plan_39rh6EJ5F5A6M' },
  },
}

export interface Whop extends WhopAccount {
  environment: CheckoutEnvironment
  apiKey: string
  webhookSecret: string
}

type Config = ReturnType<typeof useRuntimeConfig>

const environmentOf = (config: Config): CheckoutEnvironment | null => {
  const env = config.public.checkout
  return env === 'sandbox' || env === 'production' ? env : null
}

/** The checkout's environment, or null while publishing is free (NUXT_PUBLIC_CHECKOUT unset). */
export function checkoutEnvironment(event: H3Event): CheckoutEnvironment | null {
  return environmentOf(useRuntimeConfig(event))
}

/** Whop and its keys from the server's config; null while checkout is off or has no key. */
export function whopFrom(config: Config): Whop | null {
  const environment = environmentOf(config)
  const apiKey = String(config.whopApiKey || '')
  return environment && apiKey ? { environment, ...ACCOUNTS[environment], apiKey, webhookSecret: String(config.whopWebhookSecret || '') } : null
}

/** Whop and its keys, for the checkout routes and the webhook; a 404 while checkout is off. */
export function useWhop(event: H3Event): Whop {
  if (!checkoutEnvironment(event))
    throw createError({ statusCode: 404, message: 'Not found' })
  const w = whopFrom(useRuntimeConfig(event))
  if (!w)
    throw createError({ statusCode: 500, message: 'Checkout isn\'t set up: NUXT_WHOP_API_KEY is missing' })
  return w
}

/**
 * An amount as Whop gives it: the current API (2026-10-13) sends
 * `{ currency, amount: "99.00", decimals }`; its reference and older webhook
 * pins show a plain number.
 */
export type WhopMoney = number | { amount: string | number, decimals?: number, currency?: string } | null | undefined

/** The amount in major units (99 for $99), or null. */
export function amountOf(m: WhopMoney): number | null {
  const n = typeof m === 'number' ? m : m && typeof m === 'object' ? Number(m.amount) : Number.NaN
  return Number.isFinite(n) ? n : null
}

/** A payment as Whop's API and webhooks describe it: the fields the app reads. */
export interface WhopPayment {
  id: string
  /** `paid` once collected; `open` or `draft` before; `void` when it failed */
  status: string | null
  substatus?: string | null
  currency: string
  total: WhopMoney
  subtotal: WhopMoney
  tax_amount: WhopMoney
  refunded_amount: WhopMoney
  /** what Whop pays out after its fees (none of the tax); may come later than the payment */
  amount_after_fees?: WhopMoney
  paid_at: string | null
  metadata: Record<string, unknown> | null
  product?: { id: string } | null
}

async function call<T>(w: Whop, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(w.api + path, {
    method,
    headers: { 'Authorization': `Bearer ${w.apiKey}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    // Whop's answer names the field it refused; it carries no customer data.
    console.error('whop:', method, path.replace(/\?.*/, ''), res.status, (await res.text().catch(() => '')).slice(0, 300))
    throw createError({ statusCode: 502, message: 'The checkout didn\'t answer. Try again in a moment.' })
  }
  return await res.json() as T
}

/**
 * A checkout for one campaign: its size's variant, or for an upgrade a
 * one-off variant priced at the difference. The metadata comes back on the
 * payment and on every webhook about it.
 */
export async function createCheckout(w: Whop, charge: Charge, metadata: Record<string, string>, redirectUrl: string) {
  const { tier, price, upgrade } = charge
  const size = tier.max.toLocaleString('en-US')
  return await call<{ id: string, purchase_url: string }>(w, 'POST', '/checkout_configurations', {
    account_id: w.account,
    metadata,
    // Whop takes https only: on the dev server (http://localhost) Whop's own page doesn't come back, the embedded checkout does.
    ...(redirectUrl.startsWith('https://') ? { redirect_url: redirectUrl } : {}),
    ...(upgrade
      ? {
          plan: {
            product_id: w.product,
            plan_type: 'one_time',
            release_method: 'buy_now',
            currency: 'usd',
            initial_price: price / 100,
            title: `Upgrade to ${size} customers`,
            description: `The difference to a campaign of up to ${size} customers.`,
            visibility: 'hidden',
            unlimited_stock: true,
            metadata: { tier: tier.key, max_recipients: String(tier.max), upgrade: 'true' },
          },
        }
      : { plan_id: w.plans[tier.key] }),
  })
}

export async function getPayment(w: Whop, id: string): Promise<WhopPayment> {
  return await call<WhopPayment>(w, 'GET', `/payments/${encodeURIComponent(id)}`)
}

/** Whop payment ids: `pay_` and letters and digits. */
export const isPaymentId = (id: unknown): id is string => typeof id === 'string' && /^pay_[A-Za-z0-9]{6,40}$/.test(id)

const WEBHOOK_TOLERANCE_S = 5 * 60

/**
 * Standard Webhooks, as Whop signs them: HMAC-SHA256 over
 * `{webhook-id}.{webhook-timestamp}.{raw body}`, keyed with the literal bytes
 * of the whole `ws_…` secret (prefix included; @whop/sdk's verifyWebhook says
 * so), base64 in `webhook-signature` as `v1,<sig>` (several, space-separated,
 * while a secret rotates). Older than five minutes is refused, against replays.
 */
export async function verifyWebhook(secret: string, headers: { id?: string | null, timestamp?: string | null, signature?: string | null }, body: string, now = Date.now()): Promise<boolean> {
  const { id, timestamp, signature } = headers
  if (!secret || !id || !timestamp || !signature || !/^\d+$/.test(timestamp))
    return false
  if (Math.abs(now / 1000 - Number(timestamp)) > WEBHOOK_TOLERANCE_S)
    return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const data = new TextEncoder().encode(`${id}.${timestamp}.${body}`)
  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',', 2)
    if (version !== 'v1' || !sig)
      continue
    let bytes: Uint8Array<ArrayBuffer>
    try {
      bytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
    }
    catch {
      continue
    }
    if (await crypto.subtle.verify('HMAC', key, bytes, data))
      return true
  }
  return false
}
