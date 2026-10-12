// The public side of a recap, addressed by its unguessable token. Uses the
// secret key (SPEC M2 rule), so it checks everything itself: the token's
// shape, that the campaign is published and that the row has no errors.

import type { H3Event } from 'h3'
import type { RecapPayload } from '#shared/types/recap'
import { templateFor } from '#shared/templates'
import { normalizeSettings, toRecapRecipient } from '#shared/utils/recap'
import { hasErrors } from '#shared/utils/validate'

export async function loadRecapPayload(event: H3Event, token: string): Promise<{ recap: RecapPayload, logoPath: string | null }> {
  if (!/^[\w-]{12}$/.test(token))
    throw createError({ statusCode: 404, message: 'Highlight reel not found' })

  const db = tokenClient(event)
  const { data, error } = await db
    .from('recipients')
    .select('data, errors, campaigns!inner(year, status, settings, template_key, businesses!inner(id, name, accent_color, logo_path, logo_shape, website_url))')
    .eq('token', token)
    .maybeSingle()
  if (error)
    dbError(error, 'Loading the highlight reel')

  const campaign = data?.campaigns as unknown as {
    year: number
    status: string
    settings: unknown
    template_key: string
    businesses: { id: string, name: string, accent_color: string, logo_path: string | null, logo_shape: string | null, website_url: string | null }
  } | undefined
  if (!data || !campaign || campaign.status !== 'published' || hasErrors(data.errors))
    throw createError({ statusCode: 404, message: 'Highlight reel not found' })

  // Photos and logo get 24 h links; storage paths stay on the server.
  const b = campaign.businesses
  const logoShape = b.logo_shape === 'square' ? 'square' : 'circle'
  const signed = await signMedia(db, { ...b, logo_shape: logoShape, logo_url: null }, normalizeSettings(campaign.settings), 60 * 60 * 24)
  return {
    logoPath: b.logo_path,
    recap: {
      template_key: campaign.template_key,
      year: campaign.year,
      business: { name: b.name, accent_color: b.accent_color, logo_url: signed.business.logo_url, logo_shape: logoShape, website_url: b.website_url },
      // The business's own bookkeeping stays out of the public payload.
      settings: { ...signed.settings, photos: signed.settings.photos.map(p => ({ ...p, path: '' })), photos_consent_at: null, email: undefined, email_consent_at: null, whatsapp: undefined },
      recipient: toRecapRecipient(templateFor(campaign.template_key, signed.settings), data.data, undefined, { copy: signed.settings.copy }),
    },
  }
}
