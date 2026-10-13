// What the signed-in pages last loaded in this visit (SPEC §7.7), so going
// back to one shows it at once while it asks the server again underneath
// (the page marks itself aria-busy until the fresh answer is in): the home per
// year, Your brand and its email account, and a Highreel just created, which
// opens without asking at all. Kept per user: a sign-out, a demo started or
// another account starts it empty. Nothing here outlives the page.

import type { Business, Campaign, HomeData } from '#shared/types/recap'
import type { EmailConnection } from '#shared/utils/smtp'

export interface MailState { connection: EmailConnection | null, anonymous: boolean, dev: boolean }

interface AppCache {
  owner: string | null
  home: Partial<Record<number, HomeData>>
  brand: { business: Business, anonymous: boolean } | null
  mail: MailState | null
  /** From New Highreel: the campaign and its business, for the workspace to open with. */
  created: { campaign: Campaign, business: Business, anonymous: boolean } | null
}

const empty = (owner: string | null): AppCache => ({ owner, home: {}, brand: null, mail: null, created: null })

export function useAppCache() {
  const { user } = useAuth()
  const state = useState<AppCache>('app-cache', () => empty(null))
  const owner = user.value?.id ?? null
  if (state.value.owner !== owner)
    state.value = empty(owner)
  const cache = state.value

  /** The business changed (Your brand, a workspace, the home): every cached copy follows. */
  function setBusiness(business: Business, anonymous?: boolean) {
    cache.brand = { business, anonymous: anonymous ?? cache.brand?.anonymous ?? false }
    for (const data of Object.values(cache.home)) {
      if (data)
        data.business = business
    }
  }

  /** A deleted campaign leaves the cached home at once (its counts refresh with the next load). */
  function forgetCampaign(id: string) {
    for (const data of Object.values(cache.home)) {
      if (data?.campaigns.some(c => c.id === id)) {
        data.campaigns = data.campaigns.filter(c => c.id !== id)
        data.total = Math.max(0, data.total - 1)
      }
    }
  }

  /** The workspace takes a just-created campaign once, if it's the one it opens. */
  function takeCreated(id: string) {
    const created = cache.created?.campaign.id === id ? cache.created : null
    cache.created = null
    return created
  }

  return { cache, setBusiness, forgetCampaign, takeCreated }
}
