// Numbers a business recap can use (SPEC M2.5 P4): totals from the same
// year's customer campaigns (campaignSums, server/utils/db.ts).

import type { Suggestion } from '#shared/utils/suggest'
import { suggestions } from '#shared/utils/suggest'

export default defineEventHandler(async (event): Promise<Suggestion[]> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { campaign } = await loadWorkspace(db, id) // 404 unless it's yours
  const [list, sums] = await Promise.all([customerCampaigns(db, campaign.year), campaignSums(db, campaign.year)])
  const byId = new Map(sums.map(s => [s.campaign_id, s]))
  return suggestions(list.filter(c => byId.has(c.id)).map(c => ({
    template_key: c.template_key,
    items_label: c.settings.items_label,
    published: byId.get(c.id)!.published,
    sums: byId.get(c.id)!.sums,
  })))
})
