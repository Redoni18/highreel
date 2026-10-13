// Your brand (SPEC M2.6; the name alone since M2.5 P3): business name,
// colour, website and logo, shared by every recap.

import type { Business } from '#shared/types/recap'
import { type BrandInput, brandUpdate, signedBusiness } from '../utils/brand'

export default defineEventHandler(async (event): Promise<Business> => {
  const { db, business } = await requireUser(event)
  const body = (await readBody<BrandInput>(event)) ?? {}
  return signedBusiness(event, await updateBusiness(db, brandUpdate(body, business.id)))
})
