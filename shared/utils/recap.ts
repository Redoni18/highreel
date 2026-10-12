// Building a recap payload from stored rows. Used by the public endpoint and
// by the workspace preview (which passes a live-computed top percent).

import type { ParsedRow, Template } from '../templates/types'
import type { CampaignPhoto, CampaignSettings, RecapRecipient } from '../types/recap'
import { cleanColumns, cleanSlides, storedRankKey } from '../templates/own'

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const strOrNull = (v: unknown) => (typeof v === 'string' && v !== '' ? v : null)

export function normalizeSettings(input: unknown): CampaignSettings {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const copy = (s.copy && typeof s.copy === 'object' ? s.copy : {}) as Record<string, unknown>
  const email = (s.email && typeof s.email === 'object' ? s.email : {}) as Record<string, unknown>
  const whatsapp = (s.whatsapp && typeof s.whatsapp === 'object' ? s.whatsapp : {}) as Record<string, unknown>
  return {
    items_label: str(s.items_label),
    founder_note: str(s.founder_note),
    cta_label: str(s.cta_label),
    cta_url: str(s.cta_url),
    copy: Object.fromEntries(Object.entries(copy).filter(([, v]) => typeof v === 'string' && v.trim())) as CampaignSettings['copy'],
    photos: Array.isArray(s.photos) ? s.photos.filter(isPhoto).slice(0, MAX_PHOTOS) : [],
    photo_in_share_image: s.photo_in_share_image === true,
    photos_consent_at: typeof s.photos_consent_at === 'string' ? s.photos_consent_at : null,
    theme: s.theme === 'paper' ? 'paper' : 'stories',
    guess_first: s.guess_first === true,
    columns: cleanColumns(s.columns),
    slides: cleanSlides(s.slides),
    email: { subject: str(email.subject), body: str(email.body) },
    email_consent_at: typeof s.email_consent_at === 'string' ? s.email_consent_at : null,
    whatsapp: { body: str(whatsapp.body), country: str(whatsapp.country) },
  }
}

export const MAX_PHOTOS = 6

function isPhoto(p: unknown): p is CampaignPhoto {
  const o = p as Record<string, unknown>
  return !!o && typeof o.id === 'string' && typeof o.path === 'string'
    && typeof o.width === 'number' && typeof o.height === 'number'
    && (o.caption === undefined || typeof o.caption === 'string')
}

/** Settings as stored: photos without signed URLs. */
export function storableSettings(s: CampaignSettings): CampaignSettings {
  return { ...s, photos: s.photos.map(({ url: _url, ...p }) => ({ ...p, caption: p.caption ?? '' })) }
}

/**
 * Columns a recap may show: what the slides and share stats read, including
 * columns named in the template's own copy ("{stat_1} {stat_1_label}") and
 * in the campaign's (`copy`, M2.7: "{people_gifted}" inside another slide).
 * Never the id, email or phone, even if copy names them.
 */
export function recapColumns(t: Template, copy: Record<string, string> = {}): string[] {
  const cols = new Set<string>()
  for (const s of t.slides) {
    cols.add(s.column)
    if (s.small)
      cols.add(s.small.column)
    for (const c of s.list ?? [])
      cols.add(c)
  }
  for (const s of t.shareStats)
    cols.add(s.column)
  const text = [t.cover, ...t.slides.flatMap(s => [s.copy, s.small?.copy ?? '']), ...t.shareStats.map(s => s.label), ...Object.values(copy)].join(' ')
  const named = new Set([...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]!))
  for (const c of t.columns) {
    if (named.has(c.key))
      cols.add(c.key)
  }
  const never = new Set(t.columns.filter(c => c.unique || c.type === 'email' || c.type === 'phone').map(c => c.key))
  return [...cols].filter(c => !never.has(c))
}

/**
 * Only first name and slide values leave the server (SPEC §5). With a rank,
 * the rank column holds the effective "top X%": the sheet's override, else
 * the computed one (`computedTopPercent` from the preview, else stored at publish).
 * Added "top X%" slides (M2.7) get theirs from `ranks` (the preview's, by
 * column), else from publish; never the column they rank by.
 */
export function toRecapRecipient(
  t: Template,
  data: ParsedRow,
  computedTopPercent?: number | null,
  opts: { ranks?: Record<string, number | null>, copy?: Record<string, string> } = {},
): RecapRecipient {
  const values: RecapRecipient['values'] = {}
  for (const col of recapColumns(t, opts.copy)) {
    const v = data[col]
    values[col] = typeof v === 'number' ? numOrNull(v) : strOrNull(v)
  }
  for (const def of t.slides) {
    if (def.rankBy) {
      const live = opts.ranks?.[def.rankBy]
      values[def.column] = live !== undefined ? live : numOrNull(data[storedRankKey(def.rankBy)])
    }
  }
  if (t.rank) {
    const key = t.rank.override ?? 'top_percent'
    const computed = computedTopPercent !== undefined ? computedTopPercent : numOrNull(data.computed_top_percent)
    values[key] = numOrNull(data[key]) ?? computed
  }
  return {
    first_name: str(data.first_name) || 'there',
    values,
    note: t.noteColumn ? strOrNull(data[t.noteColumn]) : null,
    since: t.since ? strOrNull(data[t.since.column]) : null,
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' || u.protocol === 'http:'
  }
  catch {
    return false
  }
}
