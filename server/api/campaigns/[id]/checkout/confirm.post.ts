// After the checkout says it's done (SPEC §10): read the payment back from
// Whop's API and record it, so publishing opens at once instead of waiting
// for the webhook (which records it too; whichever comes first counts once).
// The browser only passes the payment's id: what was paid, and for which
// campaign, comes from Whop.

import type { CheckoutConfirmation } from '#shared/types/recap'

export default defineEventHandler(async (event): Promise<CheckoutConfirmation> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const w = useWhop(event)
  const body = await readBody<{ payment?: unknown }>(event)
  if (!isPaymentId(body?.payment))
    throw createError({ statusCode: 400, message: 'Invalid payment' })
  await loadWorkspace(db, id) // 404 unless it's yours
  const payment = await getPayment(w, body.payment)
  const ref = paymentRef(w, payment)
  if (!ref || ref.businessId !== db.businessId || ref.campaignId !== id)
    throw createError({ statusCode: 404, message: 'No such payment for this campaign' })
  if (isPaid(payment))
    await recordPayment(event, ref, payment)
  const status = isPaid(payment) ? 'paid' : payment.status === 'void' ? 'failed' : 'pending'
  return { status, paid: await paidTiers(db, id) }
})
