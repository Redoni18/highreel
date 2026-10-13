// The admin overview (SPEC M2.15): accounts, what they made, sent and paid.
import type { AdminOverview } from '#shared/types/admin'

export default defineEventHandler(async (event): Promise<AdminOverview> => {
  const admin = await requireAdmin(event)
  return adminOverview(admin)
})
