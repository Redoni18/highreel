// The business's email account for recap emails (SPEC M2.9), without its
// password; whether this is a demo session (which can't connect one); and
// whether the local test inbox is offered (development only).

import type { EmailConnection } from '#shared/utils/smtp'

export default defineEventHandler(async (event): Promise<{ connection: EmailConnection | null, anonymous: boolean, accountEmail: string | null, dev: boolean }> => {
  const { db, userId, anonymous, email } = await requireUser(event)
  const business = await ensureBusiness(db, userId)
  const c = await loadConnection(db, business.id)
  return { connection: c ? publicConnection(c) : null, anonymous, accountEmail: email, dev: import.meta.dev }
})
