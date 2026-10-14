// Paying for a campaign (SPEC §10), against Whop's sandbox. Needs the dev
// server with NUXT_PUBLIC_CHECKOUT=sandbox, the sandbox business's API key and
// its webhook's secret in .env (NUXT_WHOP_API_KEY, NUXT_WHOP_WEBHOOK_SECRET),
// Mailpit, and the internet (Whop's checkout loads from cdn.whop.com).
//
// A demo publishes free. Kept as an account, the same campaign shows its price
// and can't publish unpaid; Publish opens Whop's checkout in the dialog, the
// test card 4242… pays, and the campaign publishes. The payment is in D1 once,
// for that campaign and size. The webhook takes only Whop's signature, records
// a payment once, only for a campaign of the business it names, and a full
// refund marks it refunded.
import { createHmac } from 'node:crypto'
import { BASE, campaignId, demoSession, env, expect, finish, keepWork, launch, sheetCounts, sql, tab } from './lib.mjs'

if (env.NUXT_PUBLIC_CHECKOUT !== 'sandbox' || !env.NUXT_WHOP_API_KEY) {
  console.log('skipped: checkout.mjs needs NUXT_PUBLIC_CHECKOUT=sandbox and the sandbox\'s NUXT_WHOP_API_KEY in .env')
  process.exit(0)
}
const SANDBOX_API = 'https://sandbox-api.whop.com/api/v1'
const SANDBOX_PRODUCT = 'prod_3MvBKnHJ02teB'

const browser = await launch()
const errors = []
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
// Whop's frames log their own noise (fraud checks, captchas): only our pages' errors count.
page.on('pageerror', e => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error' && (m.location().url ?? '').startsWith(BASE) && !/status of (402|403|409)/.test(m.text()))
    errors.push(m.text())
})
const call = (path, body) => page.evaluate(async ([p, b]) => {
  const r = await fetch(p, { method: b === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) })
  return { status: r.status, body: await r.json().catch(() => null) }
}, [path, body])

// --- A demo publishes free (owner, 2026-10-14) ----------------------------------
await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
const demoCampaign = campaignId(page)
await tab(page, 'Share')
expect(!(await page.locator('[data-testid="price-hint"]').count()), 'a demo sees no price')
const demoCheckout = await call(`/api/campaigns/${demoCampaign}/checkout`, {})
expect(demoCheckout.status === 403, 'and can\'t open a checkout', demoCheckout.status)

// --- Kept as an account: the price, and no publishing unpaid --------------------
const owner = `payer-${Date.now()}@example.com`
await keepWork(page, owner, `${BASE}/app/c/${demoCampaign}/share`)
const id = demoCampaign
await page.waitForSelector('[data-testid="price-hint"]', { timeout: 20000 })
const hint = await page.locator('[data-testid="price-hint"]').innerText()
expect(hint.includes('$99 for up to 1,000 customers') && hint.includes('usually $199'), 'an account sees the founding price for its size', hint)
const unpaid = await call(`/api/campaigns/${id}/publish`, {})
expect(unpaid.status === 402 && unpaid.body?.message === 'Pay for this campaign to publish it.', 'publishing unpaid is refused', unpaid)

// --- Whop's checkout in the publish dialog, the test card -----------------------
await page.locator('[data-testid="share-publish"]').getByRole('button', { name: /^Publish \d/ }).click()
const dialog = page.getByRole('dialog')
await dialog.getByText('Pay once, then publish').waitFor()
expect((await dialog.innerText()).includes('$99, the founding price (usually $199)'), 'the dialog names the size and price')
expect(await dialog.getByText('Test mode.').waitFor({ timeout: 15000 }).then(() => true, () => false), 'and says it\'s the sandbox')

// Whop takes the tab to its return page once the checkout completes, and from
// there to the checkout's redirect_url with the payment (seen on Whop's
// sandbox, 2026-10-14). It takes https addresses only, so on this http dev
// server the checkout has none: stand in for that hop, as Whop makes it.
let paymentSeen = null
page.on('request', (r) => {
  if (r.url().endsWith(`/api/campaigns/${id}/checkout/confirm`))
    paymentSeen ??= JSON.parse(r.postData() ?? '{}').payment ?? null
})
let returned = false
await page.route('https://sandbox.whop.com/checkout/return**', async (route) => {
  for (let i = 0; i < 40 && !paymentSeen; i++)
    await new Promise(r => setTimeout(r, 250))
  returned = true
  const back = `${BASE}/app/c/${id}/share?checkout=return&receipt_id=${paymentSeen}&payment_id=${paymentSeen}&checkout_status=success&status=success`
  await route.fulfill({ status: 302, headers: { location: back } })
})
const checkout = page.frameLocator('iframe[src*="/checkout/checkout/"]')
await checkout.locator('input[name="email"]').waitFor({ timeout: 30000 })
const prefilled = await checkout.locator('input[name="email"]').inputValue()
expect(prefilled === owner, 'the account\'s email is filled in for Whop\'s receipt', prefilled)
await checkout.locator('input[name="email"]').fill(owner)
const frame = part => page.frames().find(f => f.url().includes(part))
for (let i = 0; i < 60 && !frame('card-number-element'); i++)
  await page.waitForTimeout(500)
await frame('card-number-element').locator('#cardNumber').pressSequentially('4242424242424242', { delay: 15 })
await frame('card-expiration-date-element').locator('#expirationDate').pressSequentially('1234', { delay: 15 })
await frame('card-verification-code-element').locator('#cvc').pressSequentially('123', { delay: 15 })
await checkout.locator('input[name="name"]').first().fill('Test Payer')
await checkout.getByRole('button', { name: 'Enter address manually' }).first().click()
await checkout.locator('input[name="line1"]').first().fill('Rruga Nëna Terezë 1')
await checkout.locator('input[name="city"]').first().fill('Prishtina')
await checkout.locator('input[name="postal_code"]').first().fill('10000')
await page.screenshot({ path: 'tests/e2e/.out/checkout-filled.png' })
await checkout.getByRole('button', { name: 'Purchase' }).click()

// Paid: the server reads it back from Whop, and the campaign publishes.
try {
  await page.waitForSelector('text=Highreels published', { timeout: 90000 })
}
catch (e) {
  await page.screenshot({ path: 'tests/e2e/.out/checkout-stuck.png' })
  console.log('stuck at', page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 500))
  throw e
}
expect(returned && /^pay_\w+$/.test(paymentSeen ?? ''), 'the checkout confirmed its payment before Whop took the tab', { returned, paymentSeen })
expect(new URL(page.url()).pathname === `/app/c/${id}/share` && !new URL(page.url()).search, 'and back on Share, the return address is tidied away', page.url())
const counts = await sheetCounts(page).catch(() => null)
const published = sql(`select count(*) as n from recipients where campaign_id = '${id}' and token is not null`)[0].n
expect(published === 195, 'paying publishes the campaign', { published, counts })
const rows = sql(`select tier, amount, currency, status, provider_id, business_id from payments where campaign_id = '${id}'`)
expect(rows.length === 1 && rows[0].tier === 'founding' && rows[0].status === 'paid' && rows[0].currency === 'usd' && rows[0].amount === 9900, 'one payment, founding size, $99 before tax', rows)
const paymentId = rows[0]?.provider_id
const businessId = rows[0]?.business_id
const confirmAgain = await call(`/api/campaigns/${id}/checkout/confirm`, { payment: paymentId })
expect(confirmAgain.status === 200 && confirmAgain.body.paid.join() === 'founding', 'confirming again changes nothing', confirmAgain.body)
expect(sql(`select count(*) as n from payments where provider_id = '${paymentId}'`)[0].n === 1, 'still one row for the payment')
const paidCheckout = await call(`/api/campaigns/${id}/checkout`, {})
expect(paidCheckout.status === 409, 'a paid campaign gets no second checkout', paidCheckout.status)
await page.reload()
await page.waitForSelector('[data-testid="share-publish"]')
expect(!(await page.locator('[data-testid="price-hint"]').count()), 'and shows no price after a reload')

// --- The webhook: Whop's signature only, once per payment -----------------------
const secret = env.NUXT_WHOP_WEBHOOK_SECRET
if (secret) {
  const account = 'biz_w3rq0pqF0Sj6YJ'
  const other = await call('/api/campaigns', { name: 'Webhook test', year: 2026, template_key: 'app' })
  const otherId = other.body.id
  const hook = async (type, data, { sign = secret, age = 0 } = {}) => {
    const body = JSON.stringify({ id: `msg_${Math.random().toString(36).slice(2)}`, type, api_version: 'v1', api_version_date: '2026-10-13', account_id: account, timestamp: new Date().toISOString(), data })
    const msgId = `msg_${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const ts = String(Math.floor(Date.now() / 1000) - age)
    const signature = `v1,${createHmac('sha256', sign).update(`${msgId}.${ts}.${body}`).digest('base64')}`
    const res = await fetch(`${BASE}/api/whop/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'webhook-id': msgId, 'webhook-timestamp': ts, 'webhook-signature': signature }, body })
    await res.arrayBuffer()
    return res.status
  }
  // Shaped like Whop's own deliveries (seen in the sandbox's delivery log): amounts as objects.
  const money = amount => ({ amount, currency: 'eur', decimals: 2, display_decimals: 2 })
  const fakePayment = (over = {}) => ({ id: `pay_test${Date.now()}`, status: 'paid', substatus: 'succeeded', currency: 'eur', total: money('380.00'), subtotal: money('380.00'), tax_amount: money('0.00'), refunded_amount: money('0.00'), paid_at: new Date().toISOString(), product: { id: SANDBOX_PRODUCT }, metadata: { business_id: businessId, campaign_id: otherId, tier: '10k' }, ...over })
  const p1 = fakePayment()
  expect(await hook('payment.succeeded', p1, { sign: `${secret}x` }) === 401, 'a wrong signature is refused')
  expect(await hook('payment.succeeded', p1, { age: 600 }) === 401, 'an old delivery is refused')
  expect(sql(`select count(*) as n from payments where provider_id = '${p1.id}'`)[0].n === 0, 'and neither records anything')
  expect(await hook('payment.succeeded', p1) === 200 && await hook('payment.succeeded', p1) === 200, 'Whop\'s signature is taken, twice')
  const got = sql(`select campaign_id, tier, amount, currency from payments where provider_id = '${p1.id}'`)
  expect(got.length === 1 && got[0].campaign_id === otherId && got[0].tier === '10k' && got[0].amount === 38000 && got[0].currency === 'eur', 'one row for the campaign it names', got)
  const ws = await call(`/api/campaigns/${otherId}`)
  expect(ws.body?.campaign?.paid?.join() === '10k', 'the workspace sees the size paid for', ws.body?.campaign?.paid)
  const p2 = fakePayment({ id: `pay_stranger${Date.now()}`, metadata: { business_id: crypto.randomUUID(), campaign_id: otherId, tier: '50k' } })
  await hook('payment.succeeded', p2)
  expect(sql(`select count(*) as n from payments where provider_id = '${p2.id}'`)[0].n === 0, 'a payment naming another business doesn\'t land on this campaign')
  const p3 = fakePayment({ id: `pay_other${Date.now()}`, product: { id: 'prod_somethingelse' } })
  await hook('payment.succeeded', p3)
  expect(sql(`select count(*) as n from payments where provider_id = '${p3.id}'`)[0].n === 0, 'nor one for another product')
  const p4 = fakePayment({ id: `pay_late${Date.now()}`, substatus: 'refunded', refunded_amount: money('380.00') })
  await hook('payment.succeeded', p4)
  expect(sql(`select count(*) as n from payments where provider_id = '${p4.id}'`)[0].n === 0, 'nor a payment.succeeded that arrives after a full refund')

  // A full refund in Whop's sandbox, then its webhook: the payment turns refunded.
  const refund = await fetch(`${SANDBOX_API}/payments/${paymentId}/refund`, { method: 'POST', headers: { 'Authorization': `Bearer ${env.NUXT_WHOP_API_KEY}`, 'content-type': 'application/json' }, body: '{}' })
  if (refund.ok) {
    expect(await hook('refund.created', { id: 'rf_test', status: 'succeeded', amount: 99, currency: 'usd', payment: { id: paymentId } }) === 200, 'the refund webhook is taken')
    const after = sql(`select status, refunded_at from payments where provider_id = '${paymentId}'`)[0]
    expect(after?.status === 'refunded' && after.refunded_at, 'a full refund marks the payment refunded', after)
    const back = await call(`/api/campaigns/${id}`)
    expect(back.body?.campaign?.paid?.length === 0, 'and the campaign is no longer paid for', back.body?.campaign?.paid)
  }
  else {
    expect(false, 'Whop\'s sandbox refunded the test payment', `${refund.status} ${(await refund.text()).slice(0, 200)}`)
  }
  // The made-up payments go again, so the admin pages' totals hold only real (sandbox) ones.
  sql(`delete from payments where provider_id in ('${p1.id}', '${p2.id}', '${p3.id}', '${p4.id}')`)
}
else {
  console.log('     (no NUXT_WHOP_WEBHOOK_SECRET: webhook checks skipped)')
}

await browser.close()
finish(errors)
