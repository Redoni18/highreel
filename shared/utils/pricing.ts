// What a campaign costs (SPEC §10): one payment per campaign, by the size of
// its list. The server picks the size from the sheet, Whop's checkout charges
// it (a variant per size, server/utils/whop.ts), and publishing checks it.
// Prices are list prices in US dollars; Whop shows buyers their own currency.

export type TierKey = 'founding' | '1k' | '10k' | '50k'

export interface Tier {
  key: TierKey
  /** customers on the list, at most */
  max: number
  /** USD cents */
  price: number
  /** the usual price, for a founding price */
  was?: number
}

export const TIERS: Record<TierKey, Tier> = {
  'founding': { key: 'founding', max: 1_000, price: 9_900, was: 19_900 },
  '1k': { key: '1k', max: 1_000, price: 19_900 },
  '10k': { key: '10k', max: 10_000, price: 39_900 },
  '50k': { key: '50k', max: 50_000, price: 79_900 },
}

/** On sale now, smallest first: the founding price stands in for the 1,000 size while it lasts. */
export const ON_SALE: TierKey[] = ['founding', '10k', '50k']

export const isTier = (key: unknown): key is TierKey => typeof key === 'string' && Object.hasOwn(TIERS, key)

/** The smallest size on sale that fits `count` customers; null above the biggest. */
export function tierFor(count: number): Tier | null {
  const key = ON_SALE.find(k => TIERS[k].max >= count)
  return key ? TIERS[key] : null
}

/** The biggest of the sizes paid for, or null. */
export function bestTier(paid: readonly string[]): Tier | null {
  let best: Tier | null = null
  for (const key of paid) {
    if (isTier(key) && (!best || TIERS[key].max > best.max || (TIERS[key].max === best.max && TIERS[key].price > best.price)))
      best = TIERS[key]
  }
  return best
}

export interface Charge {
  tier: Tier
  /** USD cents */
  price: number
  /** paying the difference from a smaller size bought before */
  upgrade: boolean
}

/**
 * What publishing `count` customers costs on top of what's paid: nothing
 * (null) when the paid size covers them, the size that fits otherwise, or
 * the difference to it from the size paid for. Undefined: more than any size.
 */
export function chargeFor(count: number, paid: readonly string[]): Charge | null | undefined {
  const have = bestTier(paid)
  if (have && have.max >= count)
    return null
  const tier = tierFor(count)
  if (!tier)
    return undefined
  return have ? { tier, price: Math.max(tier.price - have.price, 100), upgrade: true } : { tier, price: tier.price, upgrade: false }
}

/** "$99", "$1,250.50". */
export const dollars = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`
