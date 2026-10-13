// Better Auth's endpoints (SPEC M2.14 P3): email links, demo sessions, Google,
// the session, sign-out. The setup is in server/utils/auth.ts.
export default defineEventHandler(async event => authFor(event).handler(await authRequest(event)))
