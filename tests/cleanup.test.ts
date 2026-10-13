// The scheduled jobs (SPEC M2.14 P4) on our migrations in SQLite (D1 is
// SQLite), with a stand-in R2 bucket: what the privacy policy promises to
// delete goes, with its files, and nothing else does.
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import { beforeEach, describe, expect, test } from 'vitest'
import { cleanupAuth, cleanupDemos, deleteRequestedAccounts } from '../server/utils/cleanup'

const migrations = new URL('../migrations/', import.meta.url)
const NOW = new Date('2026-11-20T03:00:00.000Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

/** D1's statement API over node:sqlite: enough for the cleanup functions. */
function d1(db: DatabaseSync): D1Database {
  const prepare = (sql: string) => {
    let args: SQLInputValue[] = []
    const statement = {
      bind(...values: SQLInputValue[]) {
        args = values
        return statement
      },
      all: async () => ({ results: db.prepare(sql).all(...args), success: true, meta: {} }),
      first: async () => db.prepare(sql).get(...args) ?? null,
      run: async () => ({ results: [], success: true, meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
    }
    return statement
  }
  const batch = async (statements: ReturnType<typeof prepare>[]) => {
    db.exec('begin')
    try {
      const out = []
      for (const s of statements)
        out.push(await s.run())
      db.exec('commit')
      return out
    }
    catch (e) {
      db.exec('rollback')
      throw e
    }
  }
  return { prepare, batch } as unknown as D1Database
}

/** R2's list and delete over a Set of keys; `broken` folders fail to list. */
function bucket(keys: Set<string>, broken = new Set<string>()): R2Bucket {
  return {
    async list({ prefix = '' }: { prefix?: string } = {}) {
      if ([...broken].some(f => prefix.startsWith(f)))
        throw new Error('R2 is down')
      return { objects: [...keys].filter(k => k.startsWith(prefix)).map(key => ({ key })), truncated: false }
    },
    async delete(list: string[]) {
      for (const k of list)
        keys.delete(k)
    },
  } as unknown as R2Bucket
}

let db: DatabaseSync
let files: Set<string>
const count = (sql: string, ...args: SQLInputValue[]) => Number((db.prepare(`select count(*) as n from ${sql}`).get(...args) as { n: number }).n)

/** A user with a business holding a Highreel, a row, a send and two files. */
function seed(id: string, { anonymous = true, created = daysAgo(31), email = `${id}@demo.highreel.app`, business = true } = {}) {
  db.prepare(`insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "isAnonymous") values (?, '', ?, 0, ?, ?, ?)`)
    .run(id, email, created, created, anonymous ? 1 : 0)
  db.prepare(`insert into session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") values (?, ?, ?, ?, ?, ?)`)
    .run(`s-${id}`, daysAgo(-10), `t-${id}`, created, created, id)
  if (!business)
    return
  db.prepare('insert into businesses (id, owner_id, name) values (?, ?, ?)').run(`b-${id}`, id, id)
  db.prepare('insert into campaigns (id, business_id, name, year) values (?, ?, ?, 2026)').run(`c-${id}`, `b-${id}`, id)
  db.prepare('insert into recipients (id, campaign_id, row_index, customer_id) values (?, ?, 0, \'1\')').run(`r-${id}`, `c-${id}`)
  db.prepare('insert into email_sends (id, business_id, campaign_id, recipient_id, kind, ok) values (?, ?, ?, ?, \'test\', 1)').run(`e-${id}`, `b-${id}`, `c-${id}`, `r-${id}`)
  files.add(`b-${id}/logo/1.png`)
  files.add(`b-${id}/c-${id}/2.jpg`)
}

/** Everything of a user's that should go together. */
function remains(id: string) {
  return {
    user: count('"user" where id = ?', id),
    sessions: count('session where "userId" = ?', id),
    business: count('businesses where owner_id = ?', id),
    campaigns: count('campaigns where id = ?', `c-${id}`),
    rows: count('recipients where id = ?', `r-${id}`),
    sends: count('email_sends where id = ?', `e-${id}`),
    files: [...files].filter(k => k.startsWith(`b-${id}/`)).length,
  }
}
const gone = { user: 0, sessions: 0, business: 0, campaigns: 0, rows: 0, sends: 0, files: 0 }
const whole = { user: 1, sessions: 1, business: 1, campaigns: 1, rows: 1, sends: 1, files: 2 }

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  // D1 enforces foreign keys, cascades included.
  db.exec('pragma foreign_keys = on')
  for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort())
    db.exec(readFileSync(new URL(file, migrations), 'utf8'))
  files = new Set()
})

describe('cleanup:demo', () => {
  test('a demo past 30 days goes with everything in it; a newer demo and an account stay', async () => {
    seed('old')
    seed('empty', { business: false })
    seed('new', { created: daysAgo(29) })
    seed('account', { anonymous: false, created: daysAgo(400), email: 'ana@example.com' })
    const result = await cleanupDemos({ DB: d1(db), MEDIA: bucket(files) }, NOW)
    expect(result).toEqual({ deleted: 2, failed: 0, left: 0 })
    expect(remains('old')).toEqual(gone)
    expect(remains('empty').user).toBe(0)
    expect(remains('new')).toEqual(whole)
    expect(remains('account')).toEqual(whole)
  })

  test('when its files can\'t be deleted, the demo stays for the next run', async () => {
    seed('old')
    seed('older', { created: daysAgo(40) })
    const result = await cleanupDemos({ DB: d1(db), MEDIA: bucket(files, new Set(['b-old/'])) }, NOW)
    expect(result).toEqual({ deleted: 1, failed: 1, left: 1 })
    expect(remains('old')).toEqual(whole)
    expect(remains('older')).toEqual(gone)
    expect(await cleanupDemos({ DB: d1(db), MEDIA: bucket(files) }, NOW)).toEqual({ deleted: 1, failed: 0, left: 0 })
    expect(remains('old')).toEqual(gone)
  })

  test('a run takes at most 1,000 demos and says how many are left', async () => {
    for (let i = 0; i < 1003; i++)
      seed(`d${i}`, { business: false })
    expect(await cleanupDemos({ DB: d1(db), MEDIA: bucket(files) }, NOW)).toEqual({ deleted: 1000, failed: 0, left: 3 })
  })
})

describe('accounts:delete', () => {
  const request = (email: string, done?: string) =>
    db.prepare('insert into account_deletions (email, done_at, result) values (?, ?, ?)').run(email, done ?? null, done ? 'deleted' : null)
  const requests = () => db.prepare('select email, done_at, result from account_deletions order by id').all()

  test('deletes the account at the address, files and all, and marks the request done', async () => {
    seed('ana', { anonymous: false, email: 'ana@example.com' })
    seed('ben', { anonymous: false, email: 'ben@example.com' })
    seed('demo', { created: daysAgo(1), email: 'demo@demo.highreel.app' })
    request(' Ana@Example.com')
    request('nobody@example.com')
    request('demo@demo.highreel.app')
    const result = await deleteRequestedAccounts({ DB: d1(db), MEDIA: bucket(files) }, NOW)
    expect(result).toEqual({ deleted: 1, noAccount: 2, failed: 0, removed: 0 })
    expect(remains('ana')).toEqual(gone)
    expect(remains('ben')).toEqual(whole)
    // A demo has no account to delete: the cleanup takes it after its 30 days.
    expect(remains('demo')).toEqual(whole)
    expect(requests()).toEqual([
      { email: ' Ana@Example.com', done_at: NOW.toISOString(), result: 'deleted' },
      { email: 'nobody@example.com', done_at: NOW.toISOString(), result: 'no account' },
      { email: 'demo@demo.highreel.app', done_at: NOW.toISOString(), result: 'no account' },
    ])
  })

  test('a failure leaves the request for the next run; done requests go after 30 days', async () => {
    seed('ana', { anonymous: false, email: 'ana@example.com' })
    request('ana@example.com')
    request('old@example.com', daysAgo(31))
    request('recent@example.com', daysAgo(29))
    const broken = await deleteRequestedAccounts({ DB: d1(db), MEDIA: bucket(files, new Set(['b-ana/'])) }, NOW)
    expect(broken).toEqual({ deleted: 0, noAccount: 0, failed: 1, removed: 1 })
    expect(remains('ana')).toEqual(whole)
    expect(requests()).toEqual([
      { email: 'ana@example.com', done_at: null, result: null },
      { email: 'recent@example.com', done_at: daysAgo(29), result: 'deleted' },
    ])
    expect(await deleteRequestedAccounts({ DB: d1(db), MEDIA: bucket(files) }, NOW)).toEqual({ deleted: 1, noAccount: 0, failed: 0, removed: 0 })
    expect(remains('ana')).toEqual(gone)
  })

  test('a done request needs its result, and an address', () => {
    expect(() => db.prepare('insert into account_deletions (email, done_at) values (\'a@b.co\', \'2026-11-01\')').run()).toThrow(/CHECK/)
    expect(() => request('not an address')).toThrow(/CHECK/)
  })
})

describe('cleanup:auth', () => {
  test('expired sessions and verifications, and counts idle for an hour, go; the rest stay', async () => {
    seed('ana', { anonymous: false, email: 'ana@example.com', business: false })
    db.prepare(`insert into session (id, "expiresAt", token, "createdAt", "updatedAt", "userId") values ('ended', ?, 'x', ?, ?, 'ana')`)
      .run(daysAgo(0.01), daysAgo(30), daysAgo(1))
    for (const [id, expires] of [['link-used-up', daysAgo(0.01)], ['keep-demo', daysAgo(0.5)], ['link', daysAgo(-0.02)]] as const) {
      db.prepare(`insert into verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") values (?, ?, '{}', ?, ?, ?)`)
        .run(id, `magic-link:${id}`, expires, daysAgo(1), daysAgo(1))
    }
    for (const [key, minutes] of [['idle', 61], ['recent', 1]] as const)
      db.prepare('insert into "rateLimit" (id, key, count, "lastRequest") values (?, ?, 1, ?)').run(key, key, NOW.getTime() - minutes * 60_000)

    expect(await cleanupAuth({ DB: d1(db) }, NOW)).toEqual({ sessions: 1, verifications: 2, rateLimits: 1 })
    expect(db.prepare('select id from session').all()).toEqual([{ id: 's-ana' }])
    expect(db.prepare('select id from verification').all()).toEqual([{ id: 'link' }])
    expect(db.prepare('select key from "rateLimit"').all()).toEqual([{ key: 'recent' }])
  })
})
