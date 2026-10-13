// What the admin pages change (SPEC M2.15): blocking an account's address,
// lifting a block, and removing an account. Like admin.ts, every function
// takes the AdminDb that only requireAdmin() hands out, and only the routes in
// server/api/admin/ call them. An admin can't be blocked or removed here (the
// owner makes them a client by hand first), so no admin can lock out another.
// What a block does is in migrations/0005_blocks.sql. Logs say what happened,
// never to which address.

import type { R2Bucket } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import type { AdminDb } from './admin'
import { removeFolderIn } from './media'

/** The longest note an admin can leave on a block (the column's check). */
export const BLOCK_REASON_MAX = 300

/** The user an admin route is about (its [id]); 404 for anything that can't be one. */
export function adminUserId(event: H3Event): string {
  const id = getRouterParam(event, 'id') ?? ''
  // Better Auth's ids are 32 letters and digits; demos' too.
  if (!/^[\w-]{1,64}$/.test(id))
    throw createError({ statusCode: 404, message: 'No such user' })
  return id
}

/** An admin's note on a block: trimmed, null when empty. */
export function blockReason(value: unknown): string | null {
  const reason = typeof value === 'string' ? value.trim() : ''
  if (reason.length > BLOCK_REASON_MAX)
    throw createError({ statusCode: 400, message: `Keep the note under ${BLOCK_REASON_MAX} characters.` })
  return reason || null
}

interface Target { id: string, email: string, role: string, demo: number, business_id: string | null }

/** The user an action is for: 404 if there's none, 409 for an admin. */
async function target(admin: AdminDb, userId: string): Promise<Target> {
  const user = await admin.d1.prepare(`select u.id, lower(u.email) as email, u.role, coalesce(u."isAnonymous", 0) as demo, b.id as business_id
    from "user" u left join businesses b on b.owner_id = u.id where u.id = ?`).bind(userId).first<Target>()
  if (!user)
    throw createError({ statusCode: 404, message: 'No such user' })
  if (user.role === 'admin')
    throw createError({ statusCode: 409, message: 'An admin can\'t be blocked or removed. Make them a client first.' })
  return user
}

/** Puts an address on the block list (again: a new note replaces the old one). */
function blockStatement(admin: AdminDb, email: string, reason: string | null) {
  return admin.d1.prepare(`insert into blocked_emails (email, reason, blocked_by) values (?, ?, ?)
    on conflict (email) do update set reason = coalesce(excluded.reason, blocked_emails.reason)`).bind(email, reason, admin.adminId)
}

/** Block an account: its address goes on the block list and its sessions end. */
export async function blockUser(admin: AdminDb, userId: string, reason: string | null): Promise<void> {
  const user = await target(admin, userId)
  if (user.demo)
    throw createError({ statusCode: 409, message: 'A demo has no address to block. Remove it instead.' })
  await admin.d1.batch([
    blockStatement(admin, user.email, reason),
    admin.d1.prepare('delete from session where "userId" = ?').bind(user.id),
  ])
  console.log('[admin] blocked an account')
}

/** Lift a block: the address can sign in again, and its account's Highreels open again. False if it wasn't blocked. */
export async function unblockEmail(admin: AdminDb, email: string): Promise<boolean> {
  const { meta } = await admin.d1.prepare('delete from blocked_emails where email = lower(?)').bind(email).run()
  if (meta.changes)
    console.log('[admin] unblocked an address')
  return meta.changes > 0
}

/**
 * Remove an account or a demo now, the way the deletion job does
 * (cleanup.ts): its files first, then its user (sessions, business and
 * everything in it cascade). `block`: its address goes on the block list
 * before anything is deleted, so it can't sign back in meanwhile.
 */
export async function removeUser(admin: AdminDb, media: R2Bucket, userId: string, { block, reason }: { block: boolean, reason: string | null }): Promise<void> {
  const user = await target(admin, userId)
  const blocking = block && !user.demo
  if (blocking)
    await blockStatement(admin, user.email, reason).run()
  if (user.business_id)
    await removeFolderIn(media, user.business_id)
  await admin.d1.prepare(`delete from "user" where id = ? and role <> 'admin'`).bind(user.id).run()
  console.log(`[admin] removed ${user.demo ? 'a demo' : 'an account'}${blocking ? ' and blocked its address' : ''}`)
}
