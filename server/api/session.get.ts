// Who's signed in, for the workspace's guard and /login (SPEC M2.14 P3), when
// the page's own HTML no longer says (after signing in or out, a demo
// started): server/utils/session.ts.
export default defineEventHandler(event => sessionAnswer(event))
