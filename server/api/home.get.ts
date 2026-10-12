// The business home (SPEC M2.5 P3): the user's business, the year's
// campaigns with their counts, and the latest recap activity. Counts come
// from campaign_stats / recent_activity, which run as the user (RLS).

import type { HomeActivity, HomeCampaign, HomeData } from '#shared/types/recap'
import { normalizeSettings } from '#shared/utils/recap'

export default defineEventHandler(async (event): Promise<HomeData> => {
  const { db, userId, anonymous } = await requireUser(event)
  const now = new Date().getFullYear()
  const asked = Number(getQuery(event).year)
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= 2100 ? asked : now

  const business = await ensureBusiness(db, userId)
  const [all, stats, activity, signed] = await Promise.all([
    db.from('campaigns').select('id, name, year, template_key, kind, status, published_at, created_at').order('created_at', { ascending: false }),
    db.rpc('campaign_stats', { p_year: year }),
    db.rpc('recent_activity', { p_year: year, p_limit: 15 }),
    signMedia(db, business, normalizeSettings({}), 3600),
  ])
  if (all.error)
    dbError(all.error, 'Loading campaigns')
  if (stats.error)
    dbError(stats.error, 'Counting highlight reels')
  if (activity.error)
    dbError(activity.error, 'Loading activity')

  const byId = new Map((stats.data as Array<Record<string, any>>).map(s => [s.campaign_id as string, s]))
  const campaigns: HomeCampaign[] = all.data
    .filter(c => c.year === year)
    .map((c) => {
      const s = byId.get(c.id) ?? {}
      return {
        id: c.id,
        name: c.name,
        year: c.year,
        template_key: c.template_key,
        kind: c.kind,
        status: c.status,
        published_at: c.published_at,
        created_at: c.created_at,
        row_count: s.row_count ?? 0,
        need_fixing: s.need_fixing ?? 0,
        published: s.published ?? 0,
        opened: s.opened ?? 0,
        views: s.views ?? 0,
        saved: s.saved ?? 0,
        shared: s.shared ?? 0,
        clicked: s.clicked ?? 0,
        updated_at: s.last_change ?? c.created_at,
      }
    })

  const years = [...new Set([now, ...all.data.map(c => c.year as number)])].sort((a, b) => b - a)
  return {
    business: signed.business,
    anonymous,
    year,
    years,
    total: all.data.length,
    campaigns,
    activity: activity.data as HomeActivity[],
  }
})
