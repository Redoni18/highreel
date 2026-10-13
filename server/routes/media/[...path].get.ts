// A logo or photo from R2, for a signed link (SPEC M2.14 P2; signing in
// server/utils/media.ts). Workspace links last an hour and recap links a day;
// the browser may keep the file until the link expires.

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'path') ?? ''
  const q = getQuery(event)
  if (!await mediaLinkOk(event, key, Number(q.exp), String(q.sig ?? '')))
    throw createError({ statusCode: 404, message: 'Not found' })
  const file = await getMedia(event, key)
  if (!file)
    throw createError({ statusCode: 404, message: 'Not found' })
  setResponseHeaders(event, {
    'Content-Type': file.type,
    'Cache-Control': `private, max-age=${Math.max(0, Number(q.exp) - Math.floor(Date.now() / 1000))}`,
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex',
  })
  return file.data
})
