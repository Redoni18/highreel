// The business home (SPEC M2.5 P3): the user's business, the year's
// campaigns with their counts, and the latest recap activity. Counts come
// from campaignStats / recentActivity (server/utils/db.ts), which read only
// the recipients_home index.

import type { HomeCampaign, HomeData } from '#shared/types/recap'
import { normalizeSettings } from '#shared/utils/recap'

export default defineEventHandler(async (event): Promise<HomeData> => {
  const { db, business, anonymous } = await requireUser(event)
  const now = new Date().getFullYear()
  const asked = Number(getQuery(event).year)
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= 2100 ? asked : now

  const [all, stats, activity, signed] = await Promise.all([
    campaignsForHome(db),
    campaignStats(db, year),
    recentActivity(db, year, 15),
    signMedia(event, business, normalizeSettings({}), 3600),
  ])

  const byId = new Map(stats.map(s => [s.campaign_id, s]))
  const campaigns: HomeCampaign[] = all
    .filter(c => c.year === year)
    .map((c) => {
      const s = byId.get(c.id)
      return {
        ...c,
        row_count: s?.row_count ?? 0,
        need_fixing: s?.need_fixing ?? 0,
        published: s?.published ?? 0,
        opened: s?.opened ?? 0,
        views: s?.views ?? 0,
        saved: s?.saved ?? 0,
        shared: s?.shared ?? 0,
        clicked: s?.clicked ?? 0,
        updated_at: s?.last_change ?? c.created_at,
      }
    })

  const years = [...new Set([now, ...all.map(c => c.year)])].sort((a, b) => b - a)
  return {
    business: signed.business,
    anonymous,
    year,
    years,
    total: all.length,
    campaigns,
    activity,
  }
})
