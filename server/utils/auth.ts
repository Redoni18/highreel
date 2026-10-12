// Who may touch what (SPEC M2, hard rule). Workspace routes call
// requireUser() and query with the user's own session, so Postgres RLS
// refuses other businesses' rows even if a route forgets a check.
// tokenClient() uses the secret key and is only for routes addressed by an
// unguessable recap token.

import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serverSupabaseClient, serverSupabaseServiceRole } from '#supabase/server'

export interface UserContext {
  db: SupabaseClient
  userId: string
  anonymous: boolean
  /** the account's address (none for a demo session) */
  email: string | null
}

/**
 * Asks Supabase Auth, not just the cookie: a session can outlive its user
 * (deleted account, cleaned-up demo session, local `supabase db reset`), and
 * its JWT still verifies. getUser() checks the user exists and isn't signed out.
 */
export async function requireUser(event: H3Event): Promise<UserContext> {
  const db = await serverSupabaseClient(event)
  const { data, error } = await db.auth.getUser()
  if (error || !data.user)
    throw sessionEnded()
  return { db, userId: data.user.id, anonymous: data.user.is_anonymous === true, email: data.user.email || null }
}

/** 401 that tells the browser to drop its session and sign in again. */
export function sessionEnded() {
  return createError({ statusCode: 401, message: 'Your session has ended. Sign in again.' })
}

/** Secret-key client. Only for token-addressed recap routes: never for workspace data. */
export function tokenClient(event: H3Event): SupabaseClient {
  return serverSupabaseServiceRole(event)
}

/** Throw a 500 with the database message. */
export function dbError(error: { message: string } | null, context: string): never {
  throw createError({ statusCode: 500, message: `${context}: ${error?.message ?? 'unknown error'}` })
}
