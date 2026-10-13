// The business home's sentences (SPEC M2.5 P3): the year written like a
// recap instead of stat tiles, the drafts that need attention, and the
// activity lines. Pure, so they're unit-tested. Numbers come back as
// { n } parts so the page can set them in mono.

import type { HomeActivity, HomeCampaign } from '../types/recap'

export type Part = string | { n: string }
export type Phrase = Part[]

const fmt = (x: number) => x.toLocaleString('en-US')
const n = (x: number): Part => ({ n: fmt(x) })
const plural = (x: number, one: string, many: string) => (x === 1 ? one : many)

/** "a, b, and c" with the parts kept as phrases. */
function list(items: Phrase[]): Phrase {
  if (items.length <= 1)
    return items[0] ?? []
  const out: Phrase = []
  items.forEach((item, i) => {
    if (i > 0)
      out.push(i === items.length - 1 ? (items.length > 2 ? ', and ' : ' and ') : ', ')
    out.push(...item)
  })
  return out
}

/** The year at a glance, as sentences. */
export function yearSummary(year: number, campaigns: HomeCampaign[]): Phrase[] {
  const sentCampaigns = campaigns.filter(c => c.kind === 'customers' && c.published > 0)
  const sum = (k: 'published' | 'opened' | 'saved' | 'shared' | 'clicked') => sentCampaigns.reduce((s, c) => s + c[k], 0)
  const sent = sum('published')
  const lines: Phrase[] = []

  if (sent) {
    lines.push([`In ${year} you sent `, n(sent), ` ${plural(sent, 'Highreel', 'Highreels')} in `, n(sentCampaigns.length), ` ${plural(sentCampaigns.length, 'campaign', 'campaigns')}.`])
    const opened = sum('opened')
    if (opened) {
      const pct = Math.round((opened / sent) * 100)
      const rest: Phrase[] = [[n(opened), ` ${plural(opened, 'was', 'were')} opened (`, { n: `${pct}%` }, ')']]
      for (const [k, verb] of [['saved', 'saved'], ['shared', 'shared'], ['clicked', 'tapped your button']] as const) {
        const v = sum(k)
        if (v)
          rest.push([n(v), ` ${verb}`])
      }
      lines.push([...list(rest), '.'])
    }
    else {
      lines.push(['None opened yet.'])
    }
  }
  else if (campaigns.some(c => c.kind === 'customers')) {
    lines.push([`Nothing sent in ${year} yet.`])
  }

  for (const c of campaigns.filter(c => c.kind === 'business' && c.published > 0))
    lines.push([`Your Highreel “${c.name}” was viewed `, n(c.views), ` ${plural(c.views, 'time', 'times')}.`])
  return lines
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
