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
  const copy = await createCampaign(db, {
    name,
    year,
    template_key: campaign.template_key,
    kind: campaign.kind,
    // photos get their new paths below
    settings: storableSettings({ ...campaign.settings, photos: [] }),
  })

  // Copy each photo into the new campaign's folder (R2 has no copy: get, then put).
  const photos = []
  for (const p of campaign.settings.photos) {
    const file = await getMedia(event, p.path)
    if (!file)
      continue
    const to = `${business.id}/${copy.id}/${p.path.split('/').pop()}`
    await putMedia(event, to, file.data, file.type)
    photos.push({ ...p, path: to })
  }
  if (photos.length) {
    const settings = storableSettings({ ...copy.settings, photos })
    await updateCampaign(db, copy.id, { settings })
    copy.settings = settings
  }

  if (campaign.kind === 'business')
    await copyBusinessRow(db, id, copy.id)
  return copy
})
