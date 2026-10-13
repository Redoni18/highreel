// Delete logos or photos the business no longer uses (SPEC M2.14 P2): a
// replaced logo, a removed photo, or uploads whose save failed. Only keys in
// the user's own business folder.

export default defineEventHandler(async (event) => {
  const { business } = await requireUser(event)
  const body = await readBody<{ paths?: unknown }>(event)
  const paths = body?.paths
  if (!Array.isArray(paths) || !paths.length || paths.length > 50 || paths.some(p => typeof p !== 'string' || !MEDIA_KEY.test(p)))
    throw createError({ statusCode: 400, message: 'Expected { paths: [...] } (up to 50)' })
  if (paths.some(p => !p.startsWith(`${business.id}/`)))
    throw createError({ statusCode: 403, message: 'Outside your folder' })
  await deleteMedia(event, paths as string[])
  setResponseStatus(event, 204)
  return null
})
