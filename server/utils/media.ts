// Signed URLs for the private `media` bucket (SPEC M2c). The workspace signs
// with the user's session (storage RLS applies); recap pages sign with the
// secret key after the token check.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Business, CampaignSettings } from '#shared/types/recap'

export const MEDIA_BUCKET = 'media'

/** Fill in logo_url and photo urls. Missing objects are dropped quietly. */
export async function signMedia(db: SupabaseClient, business: Business, settings: CampaignSettings, expiresIn: number) {
  const paths = [business.logo_path, ...settings.photos.map(p => p.path)].filter((p): p is string => !!p)
  if (!paths.length)
    return { business, settings }
  const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUrls(paths, expiresIn)
  if (error)
    return { business, settings }
  const urls = new Map<string, string>()
  for (const d of data) {
    if (d.path && d.signedUrl && !d.error)
      urls.set(d.path, d.signedUrl)
  }
  return {
    business: { ...business, logo_url: business.logo_path ? urls.get(business.logo_path) ?? null : null } as Business,
    settings: {
      ...settings,
      photos: settings.photos.filter(p => urls.has(p.path)).map(p => ({ ...p, url: urls.get(p.path)! })),
    } as CampaignSettings,
  }
}

/** Remove every object under a folder (a campaign's photos). */
export async function removeFolder(db: SupabaseClient, folder: string) {
  const { data } = await db.storage.from(MEDIA_BUCKET).list(folder, { limit: 1000 })
  if (data?.length)
    await db.storage.from(MEDIA_BUCKET).remove(data.map(f => `${folder}/${f.name}`))
}
