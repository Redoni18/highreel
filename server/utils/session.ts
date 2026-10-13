// Who's signed in, as the browser gets it (SPEC M2.14 P3, §7.7): from
// /api/session, and written into the HTML of the pages that ask on load (the
// workspace and /login, server/plugins/session-in-page.ts), so a page load
// doesn't wait for /api/session before it can ask for its data. `ended`: this
// browser still had a session cookie, but the session or its user is gone
// (expired, signed out elsewhere, a deleted account or a cleaned-up demo), so
// /login can say why you're there. `role` (M2.15) only decides whether the
// page offers the admin pages; their routes check it again.

import type { H3Event } from 'h3'

export interface SessionAnswer {
  user: { id: string, email: string, isAnonymous: boolean, role: 'client' | 'admin' } | null
  ended: boolean
}

export async function sessionAnswer(event: H3Event): Promise<SessionAnswer> {
  const { user, ended } = await currentSession(event)
  return {
    user: user ? { id: user.id, email: user.email, isAnonymous: Boolean(user.isAnonymous), role: isAdmin(user) ? 'admin' : 'client' } : null,
    ended,
  }
}
