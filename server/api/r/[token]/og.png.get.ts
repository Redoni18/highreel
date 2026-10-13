// Link-preview image for a recap (SPEC M2g). Same rules as the payload: 404
// unless published; only first name and stats. Drawing one costs about a
// third of a second of CPU (SPEC M2.14 P0) and every chat app fetches it, so
// each is drawn once and kept in the campaign's folder in R2 (P2), named by a
// hash of what it shows: a change to the brand, wording or numbers draws a
// new one (and deletes the old), and deleting the campaign deletes them all.

import type { RecapPayload } from '#shared/types/recap'

/** Bump when the image's design changes, so stored previews are drawn again. */
const DESIGN = 1

async function hashOf(recap: RecapPayload, logoPath: string | null): Promise<string> {
  // Signed URLs change by the hour; the image only depends on what they point at.
  const stable = {
    ...recap,
    business: { ...recap.business, logo_url: null },
    settings: { ...recap.settings, photos: recap.settings.photos.map(p => ({ ...p, url: '' })) },
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([DESIGN, stable, logoPath])))
  return [...new Uint8Array(digest)].slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') ?? ''
  const { recap, logoPath, folder } = await loadRecapPayload(event, token)
  setResponseHeaders(event, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=3600',
    'X-Robots-Tag': 'noindex',
  })

  const key = `${folder}/og/${token}-${await hashOf(recap, logoPath)}.png`
  const stored = await getMedia(event, key)
  if (stored)
    return stored.data

  let logo: { data: Uint8Array, type: string } | null = null
  if (logoPath) {
    const file = await getMedia(event, logoPath)
    // resvg draws PNG and JPEG only; anything else falls back to the initial.
    if (file && /^image\/(png|jpeg)$/.test(file.type))
      logo = file
  }
  const png = await renderOgImage(recap, logo)
  const older = (await listMedia(event, `${folder}/og/${token}-`)).filter(k => k !== key)
  await Promise.all([putMedia(event, key, png, 'image/png'), older.length ? deleteMedia(event, older) : null])
  return png
})
