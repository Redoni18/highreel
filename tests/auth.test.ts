// Sign-in on Better Auth (SPEC M2.14 P3): its tables match what our setup
// needs, the sign-in email, and where a link may send you afterwards.
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import type { D1Database } from '@cloudflare/workers-types'
import { getMigrations } from 'better-auth/db/migration'
import { describe, expect, test } from 'vitest'
import { authOptions } from '../server/utils/auth'
import { SIGN_IN_LINK_MINUTES, signInEmail } from '../server/utils/signin'
import { safeNext } from '../shared/utils/next'

const migrations = new URL('../migrations/', import.meta.url)

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
