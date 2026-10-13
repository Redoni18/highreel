// Every payment on the admin pages (SPEC M2.15), newest first.
import type { AdminPayment } from '#shared/types/admin'

export default defineEventHandler(async (event): Promise<{ payments: AdminPayment[], more: boolean }> => {
  const admin = await requireAdmin(event)
  return adminPayments(admin)
})
