// Suggestions for a business recap's numbers (SPEC M2.5 P4), from that
// year's customer campaigns: who got a recap, and the template's column
// totals ("1,180 habits checked off"). Pure; the server feeds it the sums.

import { getTemplate } from '../templates'
import { fillCopy } from './slides'

export interface Suggestion {
  value: number
  label: string
}

export interface CampaignTotals {
  template_key: string
  items_label: string
  /** published rows (a link and no errors) */
  published: number
  /** column → sum over the published rows */
  sums: Record<string, number>
}

export function suggestions(campaigns: CampaignTotals[], max = 8): Suggestion[] {
  const out = new Map<string, number>()
  const add = (label: string, value: number) => {
    const v = Math.round(value)
    if (label.trim() && v > 0)
      out.set(label, (out.get(label) ?? 0) + v)
  }
  for (const c of campaigns) {
    const t = getTemplate(c.template_key)
    if (t.audience)
      add(`${t.audience} got a highlight reel`, c.published)
  }
  for (const c of campaigns) {
    for (const total of getTemplate(c.template_key).totals ?? [])
      add(fillCopy(total.label, { items_label: c.items_label }).trim(), c.sums[total.column] ?? 0)
  }
  return [...out].slice(0, max).map(([label, value]) => ({ value, label }))
}
