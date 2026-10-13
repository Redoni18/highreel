// Your brand (SPEC M2.6): the user's business with a signed logo URL, and
// whether this is a demo session (for the keep-your-work banner).

import type { Business } from '#shared/types/recap'
import { signedBusiness } from '../utils/brand'

export default defineEventHandler(async (event): Promise<{ business: Business, anonymous: boolean }> => {
  const { business, anonymous } = await requireUser(event)
  return { business: await signedBusiness(event, business), anonymous }
})
