// A Whop checkout for this campaign (SPEC §10): the size that fits its rows
// without errors, or the difference to it from a smaller size paid before.
// The server picks the price; the browser only shows Whop's checkout for it
// (embedded, or Whop's own page). The payment is recorded from Whop's word
// (the webhook, or the confirm route), never from this answer.

import type { CheckoutSession } from '#shared/types/recap'
import { chargeFor } from '#shared/utils/pricing'

export default defineEventHandler(async (event): Promise<CheckoutSession> => {
  const { db, anonymous } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const w = useWhop(event)
  const { campaign } = await loadWorkspace(db, id) // 404 unless it's yours
  if (anonymous)
    throw createError({ statusCode: 403, message: 'Keep your work in an account first: payments belong to an account.' })
  if (!paysToPublish(event, anonymous, campaign))
    throw createError({ statusCode: 400, message: 'This Highreel is free to publish' })
  const counts = await rowCounts(db, id)
  const ready = counts.total - counts.errors
  if (!ready)
    throw createError({ statusCode: 400, message: 'Nothing to publish yet' })
  const charge = chargeFor(ready, campaign.paid)
  if (charge === null)
    throw createError({ statusCode: 409, message: 'This campaign is already paid for' })
  if (!charge)
    throw createError({ statusCode: 400, message: `More than ${(50_000).toLocaleString('en-US')} customers: write to hello@highreel.app` })
  // Whop sends the buyer back here after paying (`payment_id`, `status=success`); without it Whop keeps them on its own account-setup page.
  const redirect = new URL(`/app/c/${id}/share?checkout=return`, getRequestURL(event).origin).toString()
  const session = await createCheckout(w, charge, { business_id: db.businessId, campaign_id: id, tier: charge.tier.key }, redirect)
  return {
    id: session.id,
    purchase_url: session.purchase_url,
    environment: w.environment,
    tier: charge.tier.key,
    max: charge.tier.max,
    price: charge.price,
    upgrade: charge.upgrade,
  }
})
