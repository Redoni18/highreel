// The public side of a recap, addressed by its unguessable token. Uses the
// unscoped database (tokenDb, SPEC M2 rule), so it checks everything itself:
// the token's shape, that the campaign is published, that the row has no
// errors and that the business's account isn't blocked (SPEC M2.15). Rows are
// looked up by token only, never by an id from the request.

import type { H3Event } from 'h3'
import type { RecapEventType, RecapPayload } from '#shared/types/recap'
import { templateFor } from '#shared/templates'
import { normalizeSettings, toRecapRecipient } from '#shared/utils/recap'
import { hasErrors } from '#shared/utils/validate'

export const isToken = (token: string) => /^[\w-]{12}$/.test(token)

export async function loadRecapPayload(event: H3Event, token: string): Promise<{ recap: RecapPayload, logoPath: string | null, folder: string }> {
  if (!isToken(token))
    throw createError({ statusCode: 404, message: 'Highreel not found' })

  const row = await tokenDb(event).prepare(`select r.data, r.errors, c.id as campaign_id, c.year, c.status, c.settings, c.template_key,
      b.id as business_id, b.name, b.accent_color, b.logo_path, b.logo_shape, b.website_url,
      exists (select 1 from "user" u join blocked_emails x on x.email = lower(u.email) where u.id = b.owner_id) as blocked
    from recipients r join campaigns c on c.id = r.campaign_id join businesses b on b.id = c.business_id
    where r.token = ?`).bind(token).first<Record<string, any>>()
  if (!row || row.status !== 'published' || row.blocked || hasErrors(JSON.parse(row.errors)))
    throw createError({ statusCode: 404, message: 'Highreel not found' })

  // Photos and logo get 24 h links; storage paths stay on the server.
  const logoShape = row.logo_shape === 'square' ? 'square' : 'circle'
  const business = { id: row.business_id, name: row.name, accent_color: row.accent_color, logo_path: row.logo_path ?? null, logo_shape: logoShape, logo_url: null, website_url: row.website_url ?? null } as const
  const signed = await signMedia(event, business, normalizeSettings(JSON.parse(row.settings)), 60 * 60 * 24)
  return {
    logoPath: business.logo_path,
    // The campaign's folder in R2 (its link previews go in og/).
    folder: `${row.business_id}/${row.campaign_id}`,
    recap: {
      template_key: row.template_key,
      year: row.year,
      business: { name: business.name, accent_color: business.accent_color, logo_url: signed.business.logo_url, logo_shape: logoShape, website_url: business.website_url },
      // The business's own bookkeeping stays out of the public payload.
      settings: { ...signed.settings, photos: signed.settings.photos.map(p => ({ ...p, path: '' })), photos_consent_at: null, email: undefined, email_consent_at: null, whatsapp: undefined },
      recipient: toRecapRecipient(templateFor(row.template_key, signed.settings), JSON.parse(row.data), undefined, { copy: signed.settings.copy }),
    },
  }
}

/**
 * First-party counters for a recap (SPEC §7.5): one statement per event, so
 * concurrent views don't lose increments. False if no row has the token.
 */
export async function recordRecapEvent(event: H3Event, token: string, type: RecapEventType): Promise<boolean> {
  const at = new Date().toISOString()
  const { meta } = await tokenDb(event).prepare(`update recipients set
      view_count = view_count + (case when ?1 = 'view' then 1 else 0 end),
      first_viewed_at = case when ?1 = 'view' then coalesce(first_viewed_at, ?2) else first_viewed_at end,
      saved_at = case when ?1 = 'save' then coalesce(saved_at, ?2) else saved_at end,
      shared_at = case when ?1 = 'share' then coalesce(shared_at, ?2) else shared_at end,
      cta_clicked_at = case when ?1 = 'cta' then coalesce(cta_clicked_at, ?2) else cta_clicked_at end
    where token = ?3`).bind(type, at, token).run()
  return meta.changes > 0
}
