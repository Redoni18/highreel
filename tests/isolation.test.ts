// Every business sees only its own data (SPEC M2, M2.14 P1). With D1 there's
// no row-level security, so the data layer holds the line: these tests read
// its SQL and fail on a workspace statement that isn't tied to the signed-in
// user's business. `corepack pnpm check:isolation` tries the same through the API.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const root = new URL('../', import.meta.url).pathname

interface Statement { sql: string, bind: string, fn: string }

/** The end of a string literal starting at `i` (a quote or backtick), template `${}` included. */
function literalEnd(src: string, i: number): number {
  const quote = src[i]!
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === '\\')
      j++
    else if (quote === '`' && src.startsWith('${', j))
      j = balanced(src, j + 1, '{', '}')
    else if (src[j] === quote)
      return j
  }
  throw new Error(`unclosed literal at ${i}`)
}

/** The index of the bracket closing the one at `i`. */
function balanced(src: string, i: number, open: string, close: string): number {
  let depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === '\'' || src[j] === '"' || src[j] === '`')
      j = literalEnd(src, j)
    else if (src[j] === open)
      depth++
    else if (src[j] === close && --depth === 0)
      return j
  }
  throw new Error(`unbalanced ${open} at ${i}`)
}

/** Every `.prepare(sql)` in a file, with its `.bind(…)` arguments and the function it's in. */
function statements(file: string): Statement[] {
  const src = readFileSync(join(root, file), 'utf8')
  const out: Statement[] = []
  for (const m of src.matchAll(/\.prepare\(\s*/g)) {
    const start = m.index! + m[0].length
    const end = literalEnd(src, start)
    const sql = src.slice(start + 1, end).replace(/\s+/g, ' ').trim()
    const rest = src.slice(end)
    const b = rest.match(/^[`'"]\s*\)\s*\.bind\(/)
    const bind = b ? rest.slice(b[0].length - 1, balanced(rest, b[0].length - 1, '(', ')')) : ''
    const fn = [...src.slice(0, m.index).matchAll(/(?:^|\n)(?:export )?(?:async )?function (\w+)/g)].at(-1)?.[1] ?? ''
    out.push({ sql, bind, fn })
  }
  return out
}

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const path = join(dir, name)
    return statSync(join(root, path)).isDirectory() ? files(path) : [path]
  })
}

const OWNED = ['campaigns', 'recipients', 'email_optouts', 'email_sends', 'email_connections', 'email_bounces']
const mentions = (sql: string, table: string) => new RegExp(`\\b${table}\\b`).test(sql)

describe('the data layer (server/utils/db.ts)', () => {
  const all = statements('server/utils/db.ts')
  // Called by requireUser alone, with the signed-in user's id: finds or creates their business.
  const workspace = all.filter(s => s.fn !== 'businessOf')

  test('has statements to check', () => {
    expect(workspace.length).toBeGreaterThan(30)
  })

  test.each(workspace.map(s => [s.fn, s.sql.slice(0, 70), s] as const))('%s: %s… binds the business', (_fn, _sql, s) => {
    expect(s.bind, s.sql).toContain('db.businessId')
  })

  test.each(workspace.map(s => [s.fn, s.sql.slice(0, 70), s] as const))('%s: %s… filters by it', (_fn, _sql, s) => {
    const sql = s.sql.toLowerCase()
    if (mentions(sql, 'recipients'))
      expect(sql, 'recipients are reached through the business\'s campaigns').toMatch(/campaigns\b[^;]*business_id = \?|business_id = \?[^;]*\bcampaigns\b/)
    for (const table of OWNED.filter(t => mentions(sql, t)))
      expect(sql, `${table}: filtered by business_id, or inserted with it`).toMatch(/business_id = \?|insert into \w+ \([^)]*business_id/)
    if (mentions(sql, 'businesses'))
      expect(sql, 'businesses: the user\'s own').toMatch(/businesses (?:set [^;]*)?where id = \?/)
  })

  test('the only statements without the business are businessOf\'s, by owner', () => {
    for (const s of all.filter(s => s.fn === 'businessOf'))
      expect(s.sql).toMatch(/owner_id/)
  })
})

describe('sign-in (auth.ts)', () => {
  // Keeping a demo and the checks on a sign-in link: by owner, with user ids
  // Better Auth hands over (never ids from a request).
  const all = statements('server/utils/auth.ts')

  test('has statements to check', () => {
    expect(all.length).toBeGreaterThan(4)
  })

  test('reaches businesses through their owner', () => {
    for (const s of all.filter(s => mentions(s.sql, 'businesses') || OWNED.some(t => mentions(s.sql, t))))
      expect(s.sql, s.fn).toMatch(/owner_id = (?:\?|"user"\.id)/)
  })
})

describe('scheduled jobs (cleanup.ts)', () => {
  // No request and no signed-in business: they go by user (an old demo, an
  // address the owner was asked to delete), never by ids from outside.
  const all = statements('server/utils/cleanup.ts')

  test('has statements to check', () => {
    expect(all.length).toBeGreaterThan(5)
  })

  test('reach businesses through their owner', () => {
    for (const s of all.filter(s => mentions(s.sql, 'businesses') || OWNED.some(t => mentions(s.sql, t))))
      expect(s.sql, s.fn).toMatch(/owner_id = "user"\.id/)
  })

  test('delete users one by one, by id, and demos only while they\'re still old demos', () => {
    const deletes = all.filter(s => /delete from "user"/.test(s.sql))
    expect(deletes.length).toBe(2)
    for (const s of deletes)
      expect(s.sql, s.fn).toMatch(/^delete from "user" where id = \?/)
    expect(deletes.find(s => s.fn === 'deleteDemo')?.sql).toMatch(/"isAnonymous" = 1 and "createdAt" < \?/)
  })

  test('look demos up as anonymous users, and accounts to delete as not anonymous', () => {
    const lookups = all.filter(s => /^select "user"\.id/.test(s.sql))
    expect(lookups.map(s => s.fn).sort()).toEqual(['cleanupDemos', 'deleteRequestedAccounts'])
    expect(lookups.find(s => s.fn === 'cleanupDemos')!.sql).toMatch(/"user"\."isAnonymous" = 1/)
    expect(lookups.find(s => s.fn === 'deleteRequestedAccounts')!.sql).toMatch(/coalesce\("user"\."isAnonymous", 0\) = 0/)
  })
})

describe('token routes (recap.ts, unsubscribe.ts)', () => {
  const token = [...statements('server/utils/recap.ts'), ...statements('server/utils/unsubscribe.ts')]

  test('look recipients up by token only', () => {
    expect(token.length).toBeGreaterThan(2)
    for (const s of token.filter(s => mentions(s.sql, 'recipients')))
      expect(s.sql).toMatch(/token = \?/)
  })

  test('opt-outs go to the business of the row the token found', () => {
    for (const s of token.filter(s => mentions(s.sql, 'email_optouts')))
      expect(s.bind).toContain('row.business_id')
  })
})

test('routes never write SQL', () => {
  for (const file of [...files('server/api'), ...files('server/routes')]) {
    const src = readFileSync(join(root, file), 'utf8')
    expect(src, file).not.toMatch(/\.prepare\(|\.d1\b|tokenDb\(|bindings\([^)]*\)\.DB/)
  }
})

test('no other server file talks to the database', () => {
  const allowed = new Set(['server/utils/db.ts', 'server/utils/recap.ts', 'server/utils/unsubscribe.ts', 'server/utils/auth.ts', 'server/utils/cleanup.ts', 'server/utils/cloudflare.ts', 'server/utils/sheet.ts'])
  for (const file of files('server').filter(f => f.endsWith('.ts') && !allowed.has(f)))
    expect(readFileSync(join(root, file), 'utf8'), file).not.toMatch(/\.prepare\(|\.DB\b/)
})
