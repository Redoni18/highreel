// Who's signed in, for the workspace's guard and /login (SPEC M2.14 P3).
// `ended`: this browser still had a session cookie, but the session or its
// user is gone (expired, signed out elsewhere, a deleted account or a
// cleaned-up demo), so /login can say why you're there.
export default defineEventHandler(async (event) => {
  const { user, ended } = await currentSession(event)
  return {
    user: user ? { id: user.id, email: user.email, isAnonymous: Boolean(user.isAnonymous) } : null,
    ended,
  }
})
