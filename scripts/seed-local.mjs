// Runs before `corepack pnpm dev` (and `corepack pnpm db:seed`): brings the
// local database up to date and makes sure the owner's own address is an
// account with the admin role, so the admin pages can be tried straight away
// (sign in with an email link: it lands in Mailpit, http://127.0.0.1:54424).
// The address comes from SEED_ADMIN_EMAIL in .env (gitignored: the repo is
// public). Local only: every command here passes --local. A failure never
// stops the dev server from starting.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname
const fromEnvFile = () => {
  if (!existsSync(`${root}.env`))
    return undefined
  const line = readFileSync(`${root}.env`, 'utf8').split('\n').find(l => /^\s*SEED_ADMIN_EMAIL\s*=/.test(l))
  return line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '')
}
const email = (process.env.SEED_ADMIN_EMAIL ?? fromEnvFile() ?? '').trim().toLowerCase()

// Through corepack like the rest of the project; CI=1 keeps wrangler from asking anything.
function wrangler(args) {
  return spawnSync('corepack', ['pnpm', 'exec', 'wrangler', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' } })
}

const migrated = wrangler(['d1', 'migrations', 'apply', 'highreel', '--local'])
if (migrated.status !== 0) {
  console.warn('[seed] couldn\'t apply the migrations to the local database:', (migrated.stderr || migrated.stdout).trim().split('\n').slice(-3).join(' '))
  process.exit(0)
}

if (!email) {
  console.log('[seed] no SEED_ADMIN_EMAIL in .env: no local admin made')
  process.exit(0)
}
// Goes into SQL below, so nothing but an ordinary address.
if (!/^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(email)) {
  console.warn(`[seed] SEED_ADMIN_EMAIL doesn't look like an address: ${email}`)
  process.exit(0)
}

const now = new Date().toISOString()
const id = [...crypto.getRandomValues(new Uint8Array(24))].map(b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join('')
// Better Auth's own columns (migrations/0002_auth.sql); an existing account
// keeps everything and only becomes an admin. Its business is made on its
// first request, as for anyone. A block from an earlier test run is lifted.
const sql = [
  `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "isAnonymous", role)
    values ('${id}', '', '${email}', 1, '${now}', '${now}', 0, 'admin')
    on conflict (email) do update set role = 'admin', "isAnonymous" = 0`,
  `delete from blocked_emails where email = '${email}'`,
].join('; ')
const seeded = wrangler(['d1', 'execute', 'highreel', '--local', '--command', sql])
if (seeded.status !== 0)
  console.warn('[seed] couldn\'t make the local admin:', (seeded.stderr || seeded.stdout).trim().split('\n').slice(-3).join(' '))
else
  console.log(`[seed] local admin: ${email} (sign in with an email link; it arrives in Mailpit, http://127.0.0.1:54424)`)
