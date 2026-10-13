// What the privacy policy promises to delete, and when (SPEC M2.14 P4). The
// scheduled jobs in server/tasks call these on the Worker's Cron Triggers
// (server/schedule.ts), with its bindings and no request, so nothing here is a
// signed-in business's view: every statement goes by a user (a demo past its
// 30 days, an address the owner was asked to delete) and reaches businesses
// through their owner (tests/isolation.test.ts). Files go before the user, so
// a failed delete leaves the user for the next run instead of a folder nobody
// can find any more. Results are counts: logs carry no addresses.

import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { removeFolderIn } from './media'

export interface CleanupBindings {
  DB: D1Database
  MEDIA: R2Bucket
}

const DAY = 24 * 60 * 60_000
/** A demo nobody kept goes this long after it started (the policy's "The demo"). */
const DEMO_DAYS = 30
/**
 * Demos per query, and per run. Each costs about three subrequests (its files
 * listed and deleted, then the user), so a run stays far inside a Worker's
 * 10,000; a backlog carries over to the next day.
 */
const DEMO_PAGE = 50
const DEMO_RUN = 1000
/** A done deletion request (the address and dates) is kept this long, to confirm it to whoever asked. */
const DELETION_RECORD_DAYS = 30
/**
 * Rate-limit counts idle this long go. Better Auth's longest window is a
 * minute; hourly runs keep the policy's "within a day" with room to spare.
 */
const RATE_LIMIT_IDLE = 60 * 60_000

interface Owner { id: string, business_id: string | null }

/** Demo sessions (Better Auth's anonymous users) started more than 30 days ago, with their businesses and files. */
export async function cleanupDemos({ DB, MEDIA }: CleanupBindings, now = new Date()) {
  const before = new Date(now.getTime() - DEMO_DAYS * DAY).toISOString()
  const failed: string[] = []
  let deleted = 0
  while (deleted + failed.length < DEMO_RUN) {
    const { results } = await DB.prepare(`select "user".id, businesses.id as business_id from "user"
      left join businesses on businesses.owner_id = "user".id
      where "user"."isAnonymous" = 1 and "user"."createdAt" < ?
        and "user".id not in (select value from json_each(?))
      order by "user"."createdAt" limit ?`)
      .bind(before, JSON.stringify(failed), Math.min(DEMO_PAGE, DEMO_RUN - deleted - failed.length))
      .all<Owner>()
    if (!results.length)
      break
    for (const demo of results) {
      if (await removeFiles(MEDIA, demo) && await deleteDemo(DB, demo.id, before))
        deleted++
      else
        failed.push(demo.id)
    }
  }
  // Still there for the next run: failures, and a backlog beyond one run's share.
  const left = await DB.prepare(`select count(*) as n from "user" where "isAnonymous" = 1 and "createdAt" < ?`)
    .bind(before)
    .first<{ n: number }>()
  return { deleted, failed: failed.length, left: left?.n ?? 0 }
}

/** The demo's user, checked again as it goes: only an anonymous user past its days is ever deleted here. */
async function deleteDemo(d1: D1Database, userId: string, before: string): Promise<boolean> {
  const { meta } = await d1.prepare(`delete from "user" where id = ? and "isAnonymous" = 1 and "createdAt" < ?`)
    .bind(userId, before)
    .run()
  return meta.changes > 0
}

/** A business's folder in R2 ({business_id}/…: logo, photos, link previews). false: try again next run. */
async function removeFiles(media: R2Bucket, owner: Owner): Promise<boolean> {
  if (!owner.business_id)
    return true
  try {
    await removeFolderIn(media, owner.business_id)
    return true
  }
  catch (e) {
    console.error('[cleanup] removing a business\'s files failed', e)
    return false
  }
}

/**
 * Accounts the owner was asked to delete (rows they add to
 * account_deletions, migrations/0003_cleanup.sql): the account's files, then
 * its user (sessions, business and everything in it cascade). The request is
 * marked done, or "no account" when no account has that address; a failure
 * leaves it for the next run. Done requests go after 30 days.
 */
export async function deleteRequestedAccounts({ DB, MEDIA }: CleanupBindings, now = new Date()) {
  const { results: requests } = await DB.prepare('select id, email from account_deletions where done_at is null order by id limit 100')
    .all<{ id: number, email: string }>()
  const counts = { deleted: 0, noAccount: 0, failed: 0, removed: 0 }
  for (const request of requests) {
    const { results: users } = await DB.prepare(`select "user".id, businesses.id as business_id from "user"
      left join businesses on businesses.owner_id = "user".id
      where lower("user".email) = lower(?) and coalesce("user"."isAnonymous", 0) = 0`)
      .bind(request.email.trim())
      .all<Owner>()
    let ok = true
    for (const user of users) {
      if (await removeFiles(MEDIA, user))
        await DB.prepare('delete from "user" where id = ?').bind(user.id).run()
      else
        ok = false
    }
    if (!ok) {
      counts.failed++
      continue
    }
    await DB.prepare('update account_deletions set done_at = ?, result = ? where id = ?')
      .bind(now.toISOString(), users.length ? 'deleted' : 'no account', request.id)
      .run()
    counts[users.length ? 'deleted' : 'noAccount']++
  }
  const { meta } = await DB.prepare('delete from account_deletions where done_at < ?')
    .bind(new Date(now.getTime() - DELETION_RECORD_DAYS * DAY).toISOString())
    .run()
  counts.removed = meta.changes
  return counts
}

/**
 * Sign-in records past their use: expired sessions (signing out deletes one
 * at once), expired verification rows (sign-in links, "Keep my work"'s
 * keep-demo: rows, Google's state) and rate-limit counts idle for an hour.
 */
export async function cleanupAuth({ DB }: Pick<CleanupBindings, 'DB'>, now = new Date()) {
  const at = now.toISOString()
  const [sessions, verifications, rateLimits] = await DB.batch([
    DB.prepare('delete from session where "expiresAt" < ?').bind(at),
    DB.prepare('delete from verification where "expiresAt" < ?').bind(at),
    DB.prepare('delete from "rateLimit" where "lastRequest" < ?').bind(now.getTime() - RATE_LIMIT_IDLE),
  ])
  return { sessions: sessions!.meta.changes, verifications: verifications!.meta.changes, rateLimits: rateLimits!.meta.changes }
}
