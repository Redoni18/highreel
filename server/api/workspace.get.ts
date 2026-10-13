// The signed-in user's business and campaigns (for the campaign switcher).
// A first visit creates the business (SPEC M2a.4); campaigns start from the
// home since M2.5 P3.

import type { WorkspaceIndex } from '#shared/types/recap'

export default defineEventHandler(async (event): Promise<WorkspaceIndex> => {
  const { db, business, anonymous } = await requireUser(event)
  return { business, campaigns: await listCampaigns(db), anonymous }
})
