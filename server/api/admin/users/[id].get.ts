// One user on the admin pages (SPEC M2.15): the account, its business, its
// Highreels with how they went out, and its payments.
import type { AdminUserDetail } from '#shared/types/admin'

export default defineEventHandler(async (event): Promise<AdminUserDetail> => {
  const admin = await requireAdmin(event)
  const user = await adminUser(admin, adminUserId(event))
  if (!user)
    throw createError({ statusCode: 404, message: 'No such user' })
  return user
})
