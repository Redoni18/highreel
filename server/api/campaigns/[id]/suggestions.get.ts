// Numbers a business recap can use (SPEC M2.5 P4): totals from the same
// year's customer campaigns, computed as the user (campaign_sums, RLS).

import type { Suggestion } from '#shared/utils/suggest'
import { normalizeSettings } from '#shared/utils/recap'
import { suggestions } from '#shared/utils/suggest'

export default defineEventHandler(async (event): Promise<Suggestion[]> => {
  const { db } = await requireUser(event)
  const id = requireUuid(getRouterParam(event, 'id'))
  const { campaign } = await loadWorkspace(db, id) // 404 unless it's yours
  const [list, sums] = await Promise.all([
    db.from('campaigns').select('id, template_key, settings').eq('year', campaign.year).eq('kind', 'customers').order('created_at'),
    db.rpc('campaign_sums', { p_year: campaign.year }),
  ])
  if (list.error)
    dbError(list.error, 'Loading campaigns')
  if (sums.error)
    dbError(sums.error, 'Adding up highlight reels')
  const byId = new Map((sums.data as Array<{ campaign_id: string, published: number, sums: Record<string, number> }>).map(s => [s.campaign_id, s]))
  return suggestions(list.data.filter(c => byId.has(c.id)).map(c => ({
    template_key: c.template_key,
    items_label: normalizeSettings(c.settings).items_label,
    published: byId.get(c.id)!.published,
    sums: byId.get(c.id)!.sums,
  })))
})
