// Sign-in on Better Auth (SPEC M2.14 P3): its tables match what our setup
// needs, the sign-in email, and where a link may send you afterwards.
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { D1Database } from '@cloudflare/workers-types'
import { betterAuth } from 'better-auth'
import { getMigrations } from 'better-auth/db/migration'
import { describe, expect, test, vi } from 'vitest'
import { authOptions } from '../server/utils/auth'
import { SIGN_IN_LINK_MINUTES, sendSignInEmail, signInEmail } from '../server/utils/signin'
import { safeNext } from '../shared/utils/next'

const migrations = new URL('../migrations/', import.meta.url)

/**
 * Our migrations in an in-memory SQLite database (D1 is SQLite). Better Auth
 * talks SQLite to it; our own lookups in auth.ts use D1's prepare().bind()
 * .first(), which the statements get here.
 */
function migrated() {
  const db = new DatabaseSync(':memory:')
  for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort())
    db.exec(readFileSync(new URL(file, migrations), 'utf8'))
  const prepare = db.prepare.bind(db)
  db.prepare = ((sql: string) => {
    const statement = prepare(sql)
    return Object.assign(statement, { bind: (...args: string[]) => ({ first: async () => statement.get(...args) ?? null }) })
  }) as typeof db.prepare
  return db
}

const setup = (db: DatabaseSync) => authOptions({
  database: db as unknown as D1Database,
  secret: 'x'.repeat(40),
  baseURL: 'http://localhost:3040',
  trustedOrigins: [],
  turnstileSecret: 'test',
  rateLimit: false,
  google: null,
})

describe('Better Auth\'s tables', () => {
  test('the migrations hold everything our setup needs', async () => {
    // Our migrations, applied to an empty SQLite database (D1 is SQLite).
    const db = new DatabaseSync(':memory:')
    for (const file of readdirSync(migrations).filter(f => f.endsWith('.sql')).sort())
      db.exec(readFileSync(new URL(file, migrations), 'utf8'))
    // Better Auth compares its schema for these options with the database.
    const options = authOptions({
      database: db as unknown as D1Database,
      secret: 'x'.repeat(40),
      baseURL: 'http://localhost:3040',
      trustedOrigins: [],
      turnstileSecret: 'test',
      rateLimit: true,
      google: { clientId: 'id', clientSecret: 'secret' },
    })
    const { toBeCreated, toBeAdded, compileMigrations } = await getMigrations(options as never)
    const missing = [...toBeCreated, ...toBeAdded]
    // When this fails (a new plugin, an upgrade), put this SQL in a new migration.
    expect(missing.length ? await compileMigrations() : '', 'add to a new migration').toBe('')
  })

  test('a session and its user come back in one query (SPEC §7.7)', async () => {
    const db = migrated()
    const auth = betterAuth(setup(db))
    const { internalAdapter } = await auth.$context
    const user = await internalAdapter.createUser({ email: 'demo@demo.highreel.app', name: 'Demo', isAnonymous: true, emailVerified: false })
    const { token } = await internalAdapter.createSession(user.id)

    // Every signed-in request starts with this lookup: from Rio to Frankfurt, a query is ~180 ms.
    // (The first lookup can also carry Better Auth's one-time look at the tables, once per isolate.)
    await internalAdapter.findSession(token)
    const statements: string[] = []
    const prepare = db.prepare.bind(db)
    db.prepare = ((sql: string) => {
      statements.push(sql)
      return prepare(sql)
    }) as typeof db.prepare
    const found = await internalAdapter.findSession(token)
    db.prepare = prepare
    expect(statements).toHaveLength(1)
    expect(statements[0]).toMatch(/join/i)
    // The joined user is read like a user of its own: booleans, dates and our role field.
    expect(found?.user).toMatchObject({ id: user.id, email: 'demo@demo.highreel.app', isAnonymous: true, emailVerified: false, role: 'client' })
    expect(found?.user.createdAt).toBeInstanceOf(Date)
    expect(found?.session.expiresAt).toBeInstanceOf(Date)
    expect(await internalAdapter.findSession('not-a-token')).toBeNull()
  })

  test('a blocked address gets no session and no new user (SPEC M2.15)', async () => {
    const db = migrated()
    const { internalAdapter } = await betterAuth(setup(db)).$context
    const ana = await internalAdapter.createUser({ email: 'ana@example.com', name: 'Ana', emailVerified: true })
    expect((await internalAdapter.createSession(ana.id)).token).toBeTruthy()

    db.exec(`insert into blocked_emails (email) values ('ana@example.com'), ('leon@example.com')`)
    await expect(internalAdapter.createSession(ana.id)).rejects.toThrow(/can't sign in to Highreel/)
    await expect(internalAdapter.createUser({ email: 'Leon@Example.com', name: 'Leon', emailVerified: true })).rejects.toThrow(/can't sign in to Highreel/)
    // Anyone else, and demos, as before.
    const bo = await internalAdapter.createUser({ email: 'bo@example.com', name: 'Bo', emailVerified: true })
    expect((await internalAdapter.createSession(bo.id)).token).toBeTruthy()
    const demo = await internalAdapter.createUser({ email: 'x@demo.highreel.app', name: 'Demo', isAnonymous: true, emailVerified: false })
    expect((await internalAdapter.createSession(demo.id)).token).toBeTruthy()

    db.exec(`delete from blocked_emails where email = 'ana@example.com'`)
    expect((await internalAdapter.createSession(ana.id)).token).toBeTruthy()
  })
})

describe('the sign-in email', () => {
  const url = 'https://highreel.app/confirm?token=abc&next=%2Fapp'

  test('a button and a plain-text twin with the link, and how long it works', () => {
    const mail = signInEmail(url)
    expect(mail.subject).toBe('Your Highreel sign-in link')
    expect(mail.html).toContain(`href="${url.replaceAll('&', '&amp;')}"`)
    expect(mail.text).toContain(url)
    expect(SIGN_IN_LINK_MINUTES).toBe(60)
    for (const body of [mail.html, mail.text])
      expect(body).toContain('within the next hour')
  })

  test('"Keep my work" says what the link does', () => {
    const mail = signInEmail(url, true)
    expect(mail.subject).toBe('Keep your Highreel demo')
    expect(mail.text).toContain('keep the work from your demo session')
  })

  test('with a Resend key it goes through Resend, from noreply@ with replies to hello@', async () => {
    const calls: { url: string, init: RequestInit }[] = []
    vi.stubGlobal('fetch', async (u: string, init: RequestInit) => {
      calls.push({ url: u, init })
      return new Response(JSON.stringify({ id: 'email_1' }), { status: 200 })
    })
    const binding = { send: vi.fn() }
    try {
      await sendSignInEmail({ resendKey: 're_test', binding: binding as never }, 'ana@example.com', url)
    }
    finally { vi.unstubAllGlobals() }
    expect(binding.send).not.toHaveBeenCalled()
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://api.resend.com/emails')
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer re_test')
    const body = JSON.parse(String(calls[0]!.init.body))
    expect(body).toMatchObject({ from: 'Highreel <noreply@highreel.app>', to: ['ana@example.com'], reply_to: 'hello@highreel.app', subject: 'Your Highreel sign-in link' })
    expect(body.text).toContain(url)
  })

  test('Resend\'s refusal reaches the logs with its reason', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ statusCode: 403, name: 'validation_error', message: 'The highreel.app domain is not verified.' }), { status: 403 }))
    try {
      await expect(sendSignInEmail({ resendKey: 're_test' }, 'ana@example.com', url)).rejects.toThrow('Resend didn\'t take the email (403 validation_error): The highreel.app domain is not verified.')
    }
    finally { vi.unstubAllGlobals() }
  })

  test('without a Resend key, Email Sending\'s binding sends it from hello@', async () => {
    const binding = { send: vi.fn(async () => ({ messageId: 'x' })) }
    await sendSignInEmail({ binding: binding as never }, 'ana@example.com', url)
    expect(binding.send).toHaveBeenCalledWith(expect.objectContaining({ from: { name: 'Highreel', email: 'hello@highreel.app' }, to: 'ana@example.com' }))
    await expect(sendSignInEmail({}, 'ana@example.com', url)).rejects.toThrow('NUXT_RESEND_API_KEY')
  })
})

describe('safeNext: where a link goes after signing in', () => {
  test.each(['/app', '/app/c/123/design', '/app/brand?tab=email'])('%s stays', (next) => {
    expect(safeNext(next)).toBe(next)
  })
  test.each([
    'https://evil.test/app',
    '//evil.test',
    '/\\evil.test',
    '/\t/evil.test',
    'app',
    '',
    undefined,
    ['/app'],
  ])('%j goes home instead', (next) => {
    expect(safeNext(next)).toBe('/app')
  })
})
