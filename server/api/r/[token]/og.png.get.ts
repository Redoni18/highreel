// Link-preview image for a recap (SPEC M2g). Same rules as the payload: 404
// unless published; only first name and stats.

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const payload = await loadRecapPayload(event, token)
  const db = tokenClient(event)

  let logo: { data: Uint8Array, type: string } | null = null
  if (payload.logoPath) {
    const { data } = await db.storage.from(MEDIA_BUCKET).download(payload.logoPath)
    // resvg draws PNG and JPEG only; anything else falls back to the initial.
    if (data && /^image\/(png|jpeg)$/.test(data.type))
      logo = { data: new Uint8Array(await data.arrayBuffer()), type: data.type }
  }

  const png = await renderOgImage(payload.recap, logo)
  setResponseHeaders(event, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=3600',
    'X-Robots-Tag': 'noindex',
  })
  return png
})
