// Every Highreel on the admin pages (SPEC M2.15); ?demos=1 adds demo sessions'.
import type { AdminHighreels } from '#shared/types/admin'

export default defineEventHandler(async (event): Promise<AdminHighreels> => {
  const admin = await requireAdmin(event)
  return adminHighreels(admin, getQuery(event).demos === '1')
})
