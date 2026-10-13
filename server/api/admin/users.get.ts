// The admin's list of users (SPEC M2.15): ?kind=accounts (the default), demos,
// admins, or blocked (the blocked addresses).
import type { AdminUsers, UserKind } from '#shared/types/admin'

const KINDS: UserKind[] = ['accounts', 'demos', 'admins', 'blocked']

export default defineEventHandler(async (event): Promise<AdminUsers> => {
  const admin = await requireAdmin(event)
  const asked = getQuery(event).kind
  return adminUsers(admin, KINDS.find(k => k === asked) ?? 'accounts')
})
