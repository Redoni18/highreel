// Whop's webhook (SPEC §10): payment.succeeded records the payment for the
// campaign its metadata names; refund.created and refund.updated mark it
// refunded once all of it is given back. Signed with the webhook's secret
// (server/utils/whop.ts); anything else is refused. Answers 200 to events it
// doesn't use, and within Whop's five seconds (it retries otherwise).

export default defineEventHandler(async (event) => {
  const w = useWhop(event)
  const body = await readRawBody(event, 'utf8') ?? ''
  const ok = await verifyWebhook(w.webhookSecret, {
    id: getHeader(event, 'webhook-id'),
    timestamp: getHeader(event, 'webhook-timestamp'),
    signature: getHeader(event, 'webhook-signature'),
  }, body)
  if (!ok)
    throw createError({ statusCode: 401, message: 'Bad signature' })

  const message = JSON.parse(body) as { type?: string, account_id?: string, company_id?: string, data?: Record<string, any> }
  const data = message.data ?? {}
  // Another Whop account's event (the secret is per webhook, but be sure).
  const account = message.account_id ?? message.company_id
  if (account && account !== w.account)
    return { ok: true }
  if (message.type === 'payment.succeeded') {
    const payment = data as WhopPayment
    const ref = paymentRef(w, payment)
    if (!ref) {
      console.warn('whop: a payment not from a Highreel checkout', payment.id)
      return { ok: true }
    }
    const added = await recordPayment(event, ref, payment)
    console.log('whop: payment', payment.id, added ? 'recorded' : 'not recorded (already there, or refunded)')
  }
  else if ((message.type === 'refund.created' || message.type === 'refund.updated') && data.status === 'succeeded' && isPaymentId(data.payment?.id)) {
    // How much of the payment is refunded in all: from Whop, not from this one refund.
    const changed = await recordRefund(event, await getPayment(w, data.payment.id))
    console.log('whop: refund for', data.payment.id, changed ? 'marked refunded' : 'partial or already marked')
  }
  return { ok: true }
})
