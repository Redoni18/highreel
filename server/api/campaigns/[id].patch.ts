// Update the campaign name, its settings (labels, copy, CTA, its own columns
// and slides) and the brand.

import type { CampaignPhoto, CampaignSettings, Workspace } from '#shared/types/recap'
import { getTemplate } from '#shared/templates'
import { cleanLook } from '#shared/templates/designs'
import { cleanColumns, cleanSlides, ownCopyKeys, ownKeyOk } from '#shared/templates/own'
import { BODY_MAX, SUBJECT_MAX } from '#shared/utils/email'
import { WHATSAPP_MAX } from '#shared/utils/whatsapp'
import { MAX_PHOTOS, storableSettings } from '#shared/utils/recap'
import { brandUpdate, checkText as text, checkUrl as url } from '../../utils/brand'
import type { CampaignUpdate } from '../../utils/db'

interface Body {
  name?: string
  settings?: Partial<Omit<CampaignSettings, 'photos_consent_at' | 'email_consent_at'>> & { photos_consent?: boolean, email_consent?: boolean }
  business?: { name?: string, website_url?: string | null, logo_path?: string | null }
}

/** Photos must live in this campaign's folder: {business_id}/{campaign_id}/… */
function photos(value: unknown, folder: string): CampaignPhoto[] {
  if (!Array.isArray(value) || value.length > MAX_PHOTOS)
    throw createError({ statusCode: 400, message: `Up to ${MAX_PHOTOS} photos` })
  return value.map((p: Record<string, unknown>) => {
    const path = typeof p?.path === 'string' ? p.path : ''
    if (!path.startsWith(`${folder}/`) || path.includes('..'))
      throw createError({ statusCode: 400, message: 'Photo is outside this campaign' })
    return {
      id: typeof p.id === 'string' ? p.id.slice(0, 64) : crypto.randomUUID(),
      path,
      caption: text(p.caption ?? '', 'Caption', 80),
      width: Math.max(1, Math.round(Number(p.width) || 1)),
      height: Math.max(1, Math.round(Number(p.height) || 1)),
    }
  })
}

export default defineEventHandler(async (event): Promise<Workspace> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = await readBody<Body>(event)
  const current = await loadWorkspace(db, id)

  const campaignUpdate: CampaignUpdate = {}
  if (body.name !== undefined)
    campaignUpdate.name = text(body.name, 'Campaign name', 80, true)

  if (body.settings) {
    const s = body.settings
    const next: CampaignSettings = { ...current.campaign.settings }
    if (s.items_label !== undefined)
      next.items_label = text(s.items_label, 'Items label', 40)
    if (s.founder_note !== undefined)
      next.founder_note = text(s.founder_note, 'Founder note', 280)
    if (s.cta_label !== undefined)
      next.cta_label = text(s.cta_label, 'Button label', 32)
    if (s.cta_url !== undefined)
      next.cta_url = url(s.cta_url, 'Button link')
    // The recap's own columns and slide list (M2.7). A column keeps the type it was added with.
    const base = getTemplate(current.campaign.template_key)
    if (s.columns !== undefined) {
      const had = new Map((next.columns ?? []).map(c => [c.key, c]))
      next.columns = cleanColumns(s.columns)
        .filter(c => ownKeyOk(c.key, base))
        .map(c => ({ ...c, type: had.get(c.key)?.type ?? c.type }))
    }
    if (s.slides !== undefined)
      next.slides = cleanSlides(s.slides)
    if (s.copy !== undefined) {
      const copy: CampaignSettings['copy'] = {}
      for (const key of ownCopyKeys(base, next)) {
        const v = s.copy[key]
        if (v !== undefined && v !== null) {
          const line = text(v, `Copy (${key})`, 120)
          if (line)
            copy[key] = line
        }
      }
      next.copy = copy
    }
    if (s.photos !== undefined) {
      if (s.photos.length && !next.photos_consent_at && !s.photos_consent)
        throw createError({ statusCode: 400, message: 'Confirm you may share these photos first' })
      next.photos = photos(s.photos, `${current.business.id}/${id}`)
    }
    if (s.photos_consent && !next.photos_consent_at)
      next.photos_consent_at = new Date().toISOString()
    if (s.photo_in_share_image !== undefined)
      next.photo_in_share_image = s.photo_in_share_image === true
    // A design and one of its colourways (SPEC M2.17); anything else falls back to the default.
    if (s.look !== undefined)
      next.look = cleanLook(s.look)
    if (s.guess_first !== undefined)
      next.guess_first = s.guess_first === true
    // The recap email (M2.8): its subject and message, and the business's word that these are its customers.
    if (s.email !== undefined) {
      next.email = {
        subject: text(s.email?.subject ?? '', 'Subject', SUBJECT_MAX),
        body: text(s.email?.body ?? '', 'Message', BODY_MAX),
      }
    }
    if (s.email_consent && !next.email_consent_at)
      next.email_consent_at = new Date().toISOString()
    // The WhatsApp message and the country code for numbers without one (M2.9).
    if (s.whatsapp !== undefined) {
      const country = text(s.whatsapp?.country ?? '', 'Country code', 6).replace(/[^\d+]/g, '')
      next.whatsapp = { body: text(s.whatsapp?.body ?? '', 'WhatsApp message', WHATSAPP_MAX), country }
    }
    campaignUpdate.settings = storableSettings(next)
  }

  if (Object.keys(campaignUpdate).length)
    await updateCampaign(db, id, campaignUpdate)
  if (body.business)
    await updateBusiness(db, brandUpdate(body.business, current.business.id))
  return loadSignedWorkspace(event, db, id)
})
