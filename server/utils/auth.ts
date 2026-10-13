// Who's signed in, and who may touch what (SPEC M2, hard rule; M2.14 P1, P3).
//
// Sign-in is Better Auth, running in this Worker with its tables in D1
// (migrations/0002_auth.sql) and its routes at /api/auth/*
// (server/api/auth/[...all].ts): email links, demo sessions (its anonymous
// users), Turnstile on both, Google once it's configured. A session lasts 30
// days from the last visit and is checked in D1 on every request (no cookie
// cache), so a deleted user or a cleaned-up demo gets a 401 at once.
//
// Workspace routes call requireUser() and pass its `db` to the data layer
// (server/utils/db.ts), whose every statement filters by that user's business.
// tokenDb() is the unscoped database, only for routes addressed by an
// unguessable recap token (recap.ts, unsubscribe.ts), which look rows up by
// token alone. The SQL in this file goes by owner, with user ids Better Auth
// hands us (never ids from a request): keeping a demo's work, and the checks
// on a sign-in link.

import type { D1Database, R2Bucket, SendEmail } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import type { Business } from '#shared/types/recap'
import { betterAuth, type BetterAuthOptions } from 'better-auth'
import { APIError, getSessionFromCtx } from 'better-auth/api'
import { anonymous, captcha, magicLink } from 'better-auth/plugins'
import { SIGN_IN_LINK_MINUTES, sendSignInEmail } from './signin'

export interface UserContext {
  /** The user's business's view of the database. */
  db: Db
  business: Business
  userId: string
  anonymous: boolean
  /** the account's address (none for a demo session) */
  email: string | null
}

const DAY = 24 * 60 * 60
/** Sign-in links to one address in an hour, on top of Better Auth's limits per IP address. */
const LINKS_PER_ADDRESS_HOUR = 5
/** Demo users get addresses here; nothing is ever sent to them. */
const DEMO_EMAIL_DOMAIN = 'demo.highreel.app'

export interface AuthSetup {
  /** D1: Better Auth's tables and ours. (tests/auth.test.ts passes SQLite to check the schema.) */
  database: D1Database
  media?: R2Bucket
  email?: SendEmail
  secret: string
  /** The site's origin: email links and the error page point here. */
  baseURL: string
  trustedOrigins: string[]
  turnstileSecret: string
  /** Better Auth's per-IP limits (stored in D1: a Worker's memory doesn't last). Off for local runs. */
  rateLimit: boolean
  google: { clientId: string, clientSecret: string } | null
}

export function authOptions(s: AuthSetup) {
  return {
    database: s.database,
    secret: s.secret,
    baseURL: s.baseURL,
    basePath: '/api/auth',
    trustedOrigins: s.trustedOrigins,
    telemetry: { enabled: false },
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    advanced: {
      cookiePrefix: 'highreel',
      // Cloudflare puts the visitor's address in cf-connecting-ip and doesn't
      // let the visitor set it. Without it, the rate limits would share one
      // bucket for everyone (a lesson from Clairwire, behind Cloudflare too).
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    rateLimit: { enabled: s.rateLimit, storage: 'database' },
    // A failed Google sign-in without a page of its own to go back to lands on
    // /login, which explains ?error=, not on Better Auth's bare error page.
    onAPIError: { errorURL: `${s.baseURL}/login` },
    // Registered only with both credentials: half a provider would put a
    // broken button on /login. People often hold several Google accounts, so
    // Google asks which one.
    socialProviders: s.google ? { google: { ...s.google, prompt: 'select_account' as const } } : undefined,
    plugins: [
      magicLink({
        expiresIn: SIGN_IN_LINK_MINUTES * 60,
        storeToken: 'hashed',
        async sendMagicLink({ email, url, token, metadata }, ctx) {
          if (await linksSentTo(s.database, email) > LINKS_PER_ADDRESS_HOUR)
            throw new APIError('TOO_MANY_REQUESTS', { message: 'We\'ve sent this address several links in the last hour. Use the newest one, or try again later.' })
          const keep = metadata?.keep === true
          if (keep) {
            if (await hasHighreels(s.database, email))
              throw new APIError('BAD_REQUEST', { message: 'That email already has a Highreel account with its own Highreels. Sign in with it instead; this demo\'s work won\'t move into it.' })
            // Remember which demo asked, for a link opened in another browser (claimDemo).
            const demo = ctx ? await getSessionFromCtx(ctx) : null
            if (demo?.user.isAnonymous && ctx) {
              await ctx.context.internalAdapter.createVerificationValue({
                identifier: await keepIdentifier(token),
                value: JSON.stringify({ demo: demo.user.id, email: email.toLowerCase() }),
                expiresAt: new Date(Date.now() + SIGN_IN_LINK_MINUTES * 60_000),
              })
            }
          }
          // The email opens our /confirm, which signs in from the page's script
          // (GET /api/auth/magic-link/verify). Link checkers and chat previews
          // fetch the link without running scripts, so they can't use up the
          // one-time token before the person does.
          const link = new URL('/confirm', s.baseURL)
          link.searchParams.set('token', token)
          link.searchParams.set('next', safeNext(new URL(url).searchParams.get('callbackURL')))
          if (keep)
            link.searchParams.set('keep', '1')
          await sendSignInEmail(s.email, email, link.toString(), keep)
        },
      }),
      anonymous({
        emailDomainName: DEMO_EMAIL_DOMAIN,
        // The demo's browser signed in to an account (its "Keep my work" link,
        // /login, or Google). Better Auth deletes the anonymous user next.
        async onLinkAccount({ anonymousUser, newUser }) {
          const kept = await keepDemo(s.database, s.media, anonymousUser.user.id, newUser.user.id)
          // The account kept its own Highreels: the demo's rows go with its user, its files here.
          if (kept && !kept.moved && s.media)
            await removeFolderIn(s.media, kept.demoBusiness).catch(e => console.error('Removing a demo\'s files failed', e))
        },
      }),
      captcha({
        provider: 'cloudflare-turnstile',
        secretKey: s.turnstileSecret,
        endpoints: ['/sign-in/anonymous', '/sign-in/magic-link'],
      }),
    ],
  } satisfies BetterAuthOptions
}

const makeAuth = (s: AuthSetup) => betterAuth(authOptions(s))
export type Auth = ReturnType<typeof makeAuth>

// One instance per isolate (and site address), built on first use: the
// bindings and settings don't change between requests.
const instances = new WeakMap<object, Map<string, Auth>>()

export function authFor(event: H3Event): Auth {
  const env = bindings(event)
  const config = useRuntimeConfig(event)
  const baseURL = String(config.public.siteUrl || getRequestURL(event).origin).replace(/\/+$/, '')
  let byUrl = instances.get(env.DB)
  if (!byUrl)
    instances.set(env.DB, byUrl = new Map())
  let auth = byUrl.get(baseURL)
  if (!auth) {
    const google = config.googleClientId && config.googleClientSecret
      ? { clientId: String(config.googleClientId), clientSecret: String(config.googleClientSecret) }
      : null
    auth = makeAuth({
      database: env.DB,
      media: env.MEDIA,
      email: env.EMAIL,
      secret: authSecret(event),
      baseURL,
      trustedOrigins: [...new Set([baseURL, String(config.public.siteOrigin)])],
      turnstileSecret: String(config.turnstileSecret || ''),
      rateLimit: config.authRateLimit !== false,
      google,
    })
    byUrl.set(baseURL, auth)
  }
  return auth
}

/** NUXT_AUTH_SECRET (signs session cookies), or a development stand-in. */
function authSecret(event: H3Event): string {
  const configured = String(useRuntimeConfig(event).authSecret || '')
  if (configured)
    return configured
  if (!import.meta.dev)
    throw createError({ statusCode: 500, message: 'NUXT_AUTH_SECRET isn\'t set on the server' })
  return `auth:${secretMaterial(event)}`
}

const SIGNS_IN = /^\/api\/auth\/(?:sign-in\/|magic-link\/verify|callback\/)/

/**
 * The request for Better Auth's handler. A sign-in from a browser that still
 * holds a dead session cookie (its user deleted, a demo cleaned up) would
 * lose the new session in Better Auth 1.7.7: the anonymous plugin's after
 * hook reads the dead session and expires its cookie, which also strips the
 * fresh Set-Cookie. So a dead session's cookies don't reach the sign-in
 * endpoints (the new cookie replaces them in the browser).
 */
export async function authRequest(event: H3Event): Promise<Request> {
  const request = toWebRequest(event)
  if (!SIGNS_IN.test(getRequestURL(event).pathname))
    return request
  const auth = authFor(event)
  const { authCookies } = await auth.$context
  const cookies = parseCookies(event)
  if (cookies[authCookies.sessionToken.name] === undefined || await auth.api.getSession({ headers: event.headers }))
    return request
  const dead = new Set([authCookies.sessionToken.name, authCookies.sessionData.name, authCookies.dontRememberToken.name])
  const headers = new Headers(request.headers)
  headers.set('cookie', Object.entries(cookies).filter(([name]) => !dead.has(name)).map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; '))
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()
  return new Request(request.url, { method: request.method, headers, body })
}

/**
 * Who's signed in. Asks D1 every time, not just the cookie: a session can
 * outlive its user (a deleted account, a cleaned-up demo). `ended`: the
 * browser still sent a session cookie, but it no longer works. `clear`: also
 * clear such a cookie (only /api/session does, after telling the browser).
 */
export async function currentSession(event: H3Event, { clear = true } = {}) {
  const auth = authFor(event)
  const { headers, response } = await auth.api.getSession({ headers: event.headers, returnHeaders: true })
  // A session older than a day is extended on use (and a dead one's cookie
  // cleared): the new cookie comes back here and has to reach the browser, or
  // a session would still run out 30 days after signing in.
  if (response || clear) {
    for (const cookie of headers.getSetCookie())
      appendResponseHeader(event, 'set-cookie', cookie)
  }
  if (response)
    return { user: response.user, ended: false }
  // The name Better Auth gives it (prefix, and __Secure- on https), not a guess.
  const { authCookies } = await auth.$context
  return { user: null, ended: getCookie(event, authCookies.sessionToken.name) !== undefined }
}

/** The signed-in user and their business, created on the first visit. */
export async function requireUser(event: H3Event): Promise<UserContext> {
  // A dead session's cookie stays: the 401 sends the browser to sign in, and
  // /api/session (the next page's guard) can still say the session ended.
  const { user } = await currentSession(event, { clear: false })
  if (!user)
    throw sessionEnded()
  const d1 = bindings(event).DB
  const business = await businessOf(d1, user.id)
  const anonymous = Boolean(user.isAnonymous)
  return {
    db: { d1, businessId: business.id },
    business,
    userId: user.id,
    anonymous,
    email: anonymous ? null : user.email,
  }
}

/** 401 that tells the browser to drop its session and sign in again. */
function sessionEnded() {
  return createError({ statusCode: 401, message: 'Your session has ended. Sign in again.' })
}

/** The unscoped database. Only for token-addressed recap routes: never for workspace data. */
export function tokenDb(event: H3Event): D1Database {
  return bindings(event).DB
}

async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Where a "Keep my work" link remembers its demo (Better Auth's verification table, by the link's token). */
const keepIdentifier = async (token: string) => `keep-demo:${await sha256(token)}`

/** Sign-in links sent to an address in the last hour that haven't been used. */
async function linksSentTo(d1: D1Database, email: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60_000).toISOString()
  const row = await d1.prepare(`select count(*) as n from verification
    where identifier like 'magic-link:%' and "createdAt" > ?
      and lower(case when json_valid(value) then json_extract(value, '$.email') end) = lower(?)`)
    .bind(since, email)
    .first<{ n: number }>()
  return row?.n ?? 0
}

/** An account (not a demo) at this address that already has Highreels. */
async function hasHighreels(d1: D1Database, email: string): Promise<boolean> {
  const row = await d1.prepare(`select 1 from "user" join businesses on businesses.owner_id = "user".id
    where lower("user".email) = lower(?) and coalesce("user"."isAnonymous", 0) = 0
      and exists (select 1 from campaigns where campaigns.business_id = businesses.id)`)
    .bind(email)
    .first()
  return row !== null
}

/**
 * "Keep my work" (SPEC M2.14 P3): the demo's business moves to the account,
 * files and all (their keys go by business, which keeps its id). An account
 * whose business has no Highreels yet (made by opening the workspace on
 * another device first) gives way to the demo's. An account with Highreels of
 * its own keeps them: `moved: false`, and the demo goes with its user.
 */
async function keepDemo(d1: D1Database, media: R2Bucket | undefined, demoUserId: string, userId: string): Promise<{ moved: boolean, demoBusiness: string } | null> {
  const demo = await d1.prepare('select id from businesses where owner_id = ?').bind(demoUserId).first<{ id: string }>()
  if (!demo)
    return null
  const own = await d1.prepare(`select id, exists (select 1 from campaigns where campaigns.business_id = businesses.id) as work
    from businesses where owner_id = ?`).bind(userId).first<{ id: string, work: number }>()
  if (own?.work)
    return { moved: false, demoBusiness: demo.id }
  await d1.batch([
    d1.prepare('delete from businesses where owner_id = ?').bind(userId),
    d1.prepare('update businesses set owner_id = ? where owner_id = ?').bind(userId, demoUserId),
  ])
  if (own && media)
    await removeFolderIn(media, own.id).catch(e => console.error('Removing an empty business\'s files failed', e))
  return { moved: true, demoBusiness: demo.id }
}

/**
 * "Keep my work" opened in another browser or on another device: the demo's
 * cookie isn't there, so Better Auth couldn't link it. /confirm asks here
 * with the link's token once it has signed in. The demo that asked for that
 * link, for this address, moves to the account and its user goes (its
 * sessions end). In the demo's own browser Better Auth already did it, and
 * this finds nothing.
 */
export async function claimDemo(event: H3Event, user: UserContext, token: string): Promise<boolean> {
  if (user.anonymous || !user.email)
    return false
  const { internalAdapter } = await authFor(event).$context
  const pending = await internalAdapter.consumeVerificationValue(await keepIdentifier(token))
  if (!pending)
    return false
  const { demo, email } = JSON.parse(pending.value) as { demo: string, email: string }
  if (email !== user.email.toLowerCase())
    return false
  const demoUser = await internalAdapter.findUserById(demo) as { isAnonymous?: boolean | null } | null
  if (!demoUser?.isAnonymous)
    return false
  const kept = await keepDemo(user.db.d1, bindings(event).MEDIA, demo, user.userId)
  if (!kept?.moved)
    return false
  await internalAdapter.deleteUser(demo)
  return true
}
