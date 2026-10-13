// "Keep my work" opened in another browser or on another device (SPEC M2.14
// P3): once the link has signed in, /confirm sends its token here and the demo
// that asked for the link moves into this account. { kept: false } when there
// was nothing to move (the demo's own browser: Better Auth already did it).
export default defineEventHandler(async (event): Promise<{ kept: boolean }> => {
  const user = await requireUser(event)
  const body = await readBody<{ token?: unknown }>(event)
  if (typeof body?.token !== 'string' || !body.token)
    throw createError({ statusCode: 400, message: 'token: the sign-in link\'s token' })
  return { kept: await claimDemo(event, user, body.token) }
})
