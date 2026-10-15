// The business home's words and numbers (SPEC M2.5 P3, cards since M2.16):
// the year's headline numbers, the drafts that need attention, and the
// activity lines. Pure, so they're unit-tested. A draft's numbers come back
// as { n } parts so the page can set them in mono.

import type { HomeActivity, HomeCampaign } from '../types/recap'

export type Part = string | { n: string }
export type Phrase = Part[]

const fmt = (x: number) => x.toLocaleString('en-US')
const n = (x: number): Part => ({ n: fmt(x) })
const plural = (x: number, one: string, many: string) => (x === 1 ? one : many)

/** A headline number on the home (SPEC M2.16): a StatCard. */
export interface HomeCard {
  key: 'sent' | 'opened' | 'shared' | 'clicked' | 'views'
  label: string
  value: string
  detail?: string
}

const pct = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`

/**
 * The year at a glance, as cards (owner, 2026-10-15; until then sentences):
 * the customer Highreels sent, opened, shared and tapped through, and the
 * views of the business's own Highreel once one is published.
 */
export function yearCards(year: number, campaigns: HomeCampaign[]): HomeCard[] {
  const cards: HomeCard[] = []
  if (campaigns.some(c => c.kind === 'customers')) {
    const out = campaigns.filter(c => c.kind === 'customers' && c.published > 0)
    const sum = (k: 'published' | 'opened' | 'saved' | 'shared' | 'clicked') => out.reduce((s, c) => s + c[k], 0)
    const sent = sum('published')
    const opened = sum('opened')
    const saved = sum('saved')
    cards.push(
      { key: 'sent', label: 'Sent', value: fmt(sent), detail: sent ? `in ${fmt(out.length)} ${plural(out.length, 'campaign', 'campaigns')}` : `Nothing sent in ${year} yet` },
      { key: 'opened', label: 'Opened', value: fmt(opened), detail: sent ? `${pct(opened, sent)} of those sent` : undefined },
      { key: 'shared', label: 'Shared', value: fmt(sum('shared')), detail: sent ? `${fmt(saved)} saved the image` : undefined },
      { key: 'clicked', label: 'Tapped your button', value: fmt(sum('clicked')), detail: opened ? `${pct(sum('clicked'), opened)} of those who opened` : undefined },
    )
  }
  const own = campaigns.filter(c => c.kind === 'business' && c.published > 0)
  if (own.length) {
    const views = own.reduce((s, c) => s + c.views, 0)
    cards.push({ key: 'views', label: own.length === 1 ? `Views of “${own[0]!.name}”` : 'Views of your own Highreels', value: fmt(views), detail: own.length === 1 ? 'your business Highreel' : `${own.length} business Highreels` })
  }
  return cards
}

/** One line per draft: what's left before it can go out. */
export function attention(campaigns: HomeCampaign[]): Array<{ id: string, name: string, text: Phrase }> {
  return campaigns.filter(c => c.status === 'draft').map((c) => {
    let what: Phrase
    if (c.kind === 'business')
      what = c.row_count ? (c.need_fixing ? ['needs a few fixes'] : ['ready']) : ['not filled in yet']
    else if (!c.row_count)
      what = ['no sheet yet']
    else if (c.need_fixing)
      what = [n(c.need_fixing), ` ${plural(c.need_fixing, 'row needs', 'rows need')} fixing`]
    else
      what = [n(c.row_count), ` ${plural(c.row_count, 'row', 'rows')} ready`]
    return { id: c.id, name: c.name, text: [...what, ' · not published'] }
  })
}

const VERBS: Record<HomeActivity['event'], string> = {
  view: 'opened',
  save: 'saved the image',
  share: 'shared',
  cta: 'tapped your button',
}

/** "Ana opened", or "Someone opened" for a business recap (no first name). */
export function activityText(a: HomeActivity): { who: string, verb: string } {
  return { who: a.first_name?.trim() || 'Someone', verb: VERBS[a.event] }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function timeAgo(iso: string, now = Date.now()): string {
  const t = new Date(iso).getTime()
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 60)
    return 'just now'
  if (s < 3600)
    return `${Math.floor(s / 60)} min ago`
  if (s < 86400)
    return `${Math.floor(s / 3600)} h ago`
  if (s < 86400 * 7)
    return `${Math.floor(s / 86400)} d ago`
  const d = new Date(t)
  const sameYear = d.getFullYear() === new Date(now).getFullYear()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ` ${d.getFullYear()}`}`
}

/** "2026 recap" → "2027 recap"; otherwise "<name> (copy)". For Duplicate. */
export function nextName(name: string, from: number, to: number): string {
  const re = new RegExp(`\\b${from}\\b`)
  return from !== to && re.test(name) ? name.replace(re, String(to)) : `${name} (copy)`.slice(0, 80)
}
