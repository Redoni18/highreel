// Upload a logo or a group photo (SPEC M2.14 P2). The browser shrinks it first
// (logos to a 512 px PNG, photos to 2000 px WebP or JPEG) and sends the bytes;
// the server checks what they are by their first bytes, picks the key in the
// business's folder and returns it. The logo or photo list then saves it.
//   ?kind=logo
//   ?kind=photo&campaign=<id>   (a campaign of the user's business)

export default defineEventHandler(async (event): Promise<{ path: string }> => {
  const { db, business } = await requireUser(event)
  const q = getQuery(event)
  const kind = q.kind === 'logo' ? 'logo' : q.kind === 'photo' ? 'photo' : null
  if (!kind)
    throw createError({ statusCode: 400, message: 'kind: logo or photo' })
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > MEDIA_MAX_BYTES)
    throw createError({ statusCode: 413, message: 'Images up to 5 MB' })

  let folder = `${business.id}/logo`
  if (kind === 'photo') {
    const campaignId = requireUuid(String(q.campaign ?? ''), 'campaign')
    await loadWorkspace(db, campaignId) // 404 unless it's yours
    folder = `${business.id}/${campaignId}`
  }

  const body = await readRawBody(event, false)
  const bytes = body ? new Uint8Array(body) : new Uint8Array()
  if (!bytes.length)
    throw createError({ statusCode: 400, message: 'No image' })
  if (bytes.length > MEDIA_MAX_BYTES)
    throw createError({ statusCode: 413, message: 'Images up to 5 MB' })
  const ext = sniffImage(bytes)
  if (!ext)
    throw createError({ statusCode: 400, message: 'Use a PNG, JPEG or WebP image' })
  // The link-preview renderer draws PNG logos only (resvg can't decode WebP).
  if (kind === 'logo' && ext !== 'png')
    throw createError({ statusCode: 400, message: 'Logos are stored as PNG' })

  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  await putMedia(event, path, bytes)
  return { path }
})
