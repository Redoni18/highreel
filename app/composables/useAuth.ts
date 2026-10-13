// Signing in and out (SPEC M2.14 P3): Better Auth's endpoints under
// /api/auth, called with $fetch. No client library, so pages that never sign
// anyone in (the landing, recaps) load nothing for it. Who's signed in is
// read once per page load (the /app middleware, /login): from the page's
// HTML, or /api/session (SPEC §7.7); after that, a 401 from our API means the
// session ended (useApi).

declare global {
  interface Window {
    /** Who was signed in when the server wrote this page (server/plugins/session-in-page.ts). */
    __hrSession?: { user: SessionUser | null, ended: boolean }
  }
}

export interface SessionUser {
  id: string
  email: string
  /** a demo session */
  isAnonymous: boolean
  /** an admin also gets the admin pages (SPEC M2.15); their routes check it again */
  role: 'client' | 'admin'
}

// One question at a time: the guard can run more than once on a first load,
// and a second answer would undo the first's `ended` (the first clears the
// dead cookie).
let asking: Promise<SessionUser | null> | null = null

export function useAuth() {
  const user = useState<SessionUser | null>('auth:user', () => null)
  const loaded = useState('auth:loaded', () => false)
  /** This browser had a session that has since ended (so /login can say so). */
  const ended = useState('auth:ended', () => false)
  // The page's HTML says who was signed in when it was written (the workspace
  // and /login, server/plugins/session-in-page.ts): taken once, on first use,
  // so after a sign-in or sign-out this page asks /api/session instead.
  if (import.meta.client && window.__hrSession) {
    user.value = window.__hrSession.user
    ended.value = window.__hrSession.ended
    loaded.value = true
    window.__hrSession = undefined
  }

  /** Ask the server who's signed in. */
  function refresh(): Promise<SessionUser | null> {
    asking ??= $fetch<{ user: SessionUser | null, ended: boolean }>('/api/session')
      .then((s) => {
        user.value = s.user
        ended.value = s.ended
      }, () => {
        user.value = null
      })
      .then(() => {
        loaded.value = true
        return user.value
      })
      .finally(() => {
        asking = null
      })
    return asking
  }

  /** The session, read once per page load. */
  const ensure = () => (loaded.value ? Promise.resolve(user.value) : refresh())

  /** A demo session without an account. `captcha`: a Turnstile token (BotCheck). */
  async function startDemo(captcha: string) {
    await $fetch('/api/auth/sign-in/anonymous', { method: 'POST', body: {}, headers: { 'x-captcha-response': captcha } })
    loaded.value = false
  }

  /**
   * Email a sign-in link that comes back to `next`. `keep`: the demo banner's
   * "Keep my work", which refuses an address whose account already has
   * Highreels, and remembers this demo for a link opened elsewhere.
   */
  async function sendLink(email: string, next: string, captcha: string, keep = false) {
    await $fetch('/api/auth/sign-in/magic-link', {
      method: 'POST',
      body: { email, callbackURL: safeNext(next), ...(keep ? { metadata: { keep: true } } : {}) },
      headers: { 'x-captcha-response': captcha },
    })
  }

  /** Off to Google; it comes back to `next`, or to /login with ?error=. */
  async function google(next: string) {
    const { url } = await $fetch<{ url: string }>('/api/auth/sign-in/social', {
      method: 'POST',
      body: { provider: 'google', callbackURL: safeNext(next), errorCallbackURL: '/login' },
    })
    window.location.href = url
  }

  async function signOut() {
    await $fetch('/api/auth/sign-out', { method: 'POST', body: {} }).catch(() => {})
    forget()
  }

  /** Drop the session in this page without asking (signed out, or the server already said it's gone). */
  function forget() {
    user.value = null
    ended.value = false
    loaded.value = true
  }

  return { user, ended, ensure, refresh, startDemo, sendLink, google, signOut, forget }
}

/** A sign-in error in words for the page. */
export function authError(e: unknown, fallback: string): string {
  const err = e as { statusCode?: number, data?: { code?: string, message?: string } }
  const code = err?.data?.code
  if (code === 'VERIFICATION_FAILED' || code === 'MISSING_RESPONSE')
    return 'We couldn\'t check that you\'re a person. Reload the page and try again.'
  // Better Auth's own limit says "Too many requests"; ours on one address has its own words.
  if (err?.statusCode === 429 && (!err.data?.message || /too many requests/i.test(err.data.message)))
    return 'Too many tries. Wait a minute, then try again.'
  return err?.data?.message?.trim() || fallback
}
