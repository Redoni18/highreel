// Your brand (SPEC M2.6; the name alone since M2.5 P3): business name,
// colour, website and logo, shared by every recap. Runs as the user (RLS).

import type { Business } from '#shared/types/recap'
import { type BrandInput, brandUpdate, signedBusiness } from '../utils/brand'

export default defineEventHandler(async (event): Promise<Business> => {
  const { db, userId } = await requireUser(event)
  const body = (await readBody<BrandInput>(event)) ?? {}
  const business = await ensureBusiness(db, userId)
  const update = brandUpdate(body, business.id)
  if (!Object.keys(update).length)
    return signedBusiness(db, business)
  const { data, error } = await db.from('businesses').update(update).eq('id', business.id).select('*').single()
  if (error)
    dbError(error, 'Saving business')
  return signedBusiness(db, toBusiness(data))
})
