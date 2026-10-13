// Where to go after signing in (SPEC M2.14 P3): /login's ?next=, carried
// through the email link to /confirm. Only a path on this site, never another
// site's address (no `//host`, backslashes or control characters, which
// browsers turn into one); the home by default.
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?!\/)/.test(next) && !/[\\\x00-\x1F]/.test(next) ? next : '/app'
}
