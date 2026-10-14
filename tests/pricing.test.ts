// What a campaign costs (SPEC §10, shared/utils/pricing.ts), and that the
// landing's price list says the same.
import { describe, expect, test } from 'vitest'
import { bestTier, chargeFor, dollars, ON_SALE, tierFor, TIERS } from '../shared/utils/pricing'
import { TIERS as LANDING_TIERS } from '../app/data/landing'

describe('tierFor', () => {
  test('the smallest size on sale that fits', () => {
    expect(tierFor(1)?.key).toBe('founding')
    expect(tierFor(1000)?.key).toBe('founding')
    expect(tierFor(1001)?.key).toBe('10k')
    expect(tierFor(10_000)?.key).toBe('10k')
    expect(tierFor(10_001)?.key).toBe('50k')
    expect(tierFor(50_000)?.key).toBe('50k')
    expect(tierFor(50_001)).toBeNull()
  })
})

describe('chargeFor', () => {
  test('nothing paid: the size that fits, at its price', () => {
    expect(chargeFor(195, [])).toEqual({ tier: TIERS.founding, price: 9900, upgrade: false })
    expect(chargeFor(4000, [])).toEqual({ tier: TIERS['10k'], price: 39_900, upgrade: false })
  })

  test('covered: nothing to pay', () => {
    expect(chargeFor(1000, ['founding'])).toBeNull()
    expect(chargeFor(1000, ['1k'])).toBeNull()
    expect(chargeFor(9000, ['founding', '10k'])).toBeNull()
  })

  test('outgrown: the difference to the size that fits', () => {
    expect(chargeFor(1500, ['founding'])).toEqual({ tier: TIERS['10k'], price: 30_000, upgrade: true })
    expect(chargeFor(1500, ['1k'])).toEqual({ tier: TIERS['10k'], price: 20_000, upgrade: true })
    expect(chargeFor(20_000, ['founding', '10k'])).toEqual({ tier: TIERS['50k'], price: 40_000, upgrade: true })
  })

  test('above the biggest size: undefined', () => {
    expect(chargeFor(60_000, [])).toBeUndefined()
  })

  test('unknown or refunded keys don\'t count', () => {
    expect(bestTier(['nope'])).toBeNull()
    expect(chargeFor(10, ['nope'])?.tier.key).toBe('founding')
  })
})

test('dollars', () => {
  expect(dollars(9900)).toBe('$99')
  expect(dollars(30_000)).toBe('$300')
  expect(dollars(125_050)).toBe('$1,250.50')
})

test('the landing shows the sizes on sale at these prices', () => {
  expect(LANDING_TIERS.map(t => t.size)).toEqual(ON_SALE.map(k => TIERS[k].max.toLocaleString('en-US')))
  expect(LANDING_TIERS.map(t => t.price)).toEqual(ON_SALE.map(k => dollars(TIERS[k].price)))
  expect(LANDING_TIERS.map(t => t.was ?? null)).toEqual(ON_SALE.map(k => (TIERS[k].was ? dollars(TIERS[k].was!) : null)))
})
