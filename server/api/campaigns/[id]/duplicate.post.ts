// Duplicate a campaign (SPEC M2.5 P3): same template, brand copy, settings
// and photos, as a new draft without rows ("run it again for 2027"). A
// business recap (P4) keeps its form so last year's numbers can be edited.

import type { Campaign } from '#shared/types/recap'
import { storableSettings } from '#shared/utils/recap'

export default defineEventHandler(async (event): Promise<Campaign> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const body = await readBody<{ name?: unknown, year?: unknown }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const year = Number(body?.year)
  if (!name || name.length > 80)
    throw createError({ statusCode: 400, message: 'Name: 1–80 characters' })
  if (!Number.isInteger(year) || year < 2000 || year > 2100)
    throw createError({ statusCode: 400, message: 'Year must be like 2026' })

  const { business, campaign } = await loadWorkspace(db, id) // 404 unless it's yours
  const { data, error } = await db
    .from('campaigns')
    .insert({
      business_id: business.id,
      name,
      year,
      template_key: campaign.template_key,
      kind: campaign.kind,
      // photos get their new paths below
      settings: storableSettings({ ...campaign.settings, photos: [] }),
    })
    .select('*')
    .single()
  if (error)
    dbError(error, 'Duplicating campaign')
  const copy = toCampaign(data)

  // Copy each photo into the new campaign's folder, as the user (Storage RLS).
  const photos = []
  for (const p of campaign.settings.photos) {
    const to = `${business.id}/${copy.id}/${p.path.split('/').pop()}`
    const { error: copyError } = await db.storage.from(MEDIA_BUCKET).copy(p.path, to)
    if (!copyError)
      photos.push({ ...p, path: to })
  }
  if (photos.length) {
    const settings = storableSettings({ ...copy.settings, photos })
    const { error: saveError } = await db.from('campaigns').update({ settings }).eq('id', copy.id)
    if (saveError)
      dbError(saveError, 'Copying photos')
    copy.settings = settings
  }

  if (campaign.kind === 'business') {
    const { data: row } = await db.from('recipients').select('customer_id, raw, data, errors').eq('campaign_id', id).maybeSingle()
    if (row) {
      const { error: rowError } = await db.from('recipients').insert({ campaign_id: copy.id, row_index: 0, ...row })
      if (rowError)
        dbError(rowError, 'Copying the highlight reel')
    }
  }
  return copy
})
