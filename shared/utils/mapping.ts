// Column mapping (SPEC M2f): when a sheet's headers don't match the template,
// suggest which header feeds which column, by name and common synonyms
// (English and Albanian), and rename rows once the business confirms.

import type { CustomColumn, SlideSetting, Template } from '../templates/types'
import { addedKey, MAX_OWN_COLUMNS, type OwnSettings, RESERVED_KEYS } from '../templates/own'
import { plainNumber } from './validate'

export type ColumnMapping = Record<string, string | null>

/** "First Name " → "first_name", "E-mail" → "e_mail", "Ditët" → "ditet" */
export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

// Normalized synonyms per column key. Id columns share one list.
const ID = ['id', 'customer', 'customer_id', 'user_id', 'userid', 'user', 'member_id', 'subscriber', 'subscriber_id', 'participant', 'participant_id', 'child_id', 'kid_id', 'client_id', 'nr', 'no']
const SYNONYMS: Record<string, string[]> = {
  customer_id: ID,
  subscriber_id: ID,
  participant_id: ID,
  first_name: ['first_name', 'firstname', 'first', 'given_name', 'name', 'child', 'child_name', 'kid', 'kid_name', 'emri', 'emer'],
  email: ['email', 'e_mail', 'mail', 'email_address', 'parent_email', 'emaili'],
  phone: ['phone', 'phone_number', 'mobile', 'mobile_number', 'mobile_phone', 'cell', 'tel', 'telephone', 'whatsapp', 'whatsapp_number', 'parent_phone', 'telefon', 'telefoni', 'numri', 'numri_i_telefonit'],
  member_since: ['member_since', 'signup_date', 'signed_up', 'joined', 'join_date', 'created', 'created_at', 'since', 'start_date'],
  subscribed_since: ['subscribed_since', 'subscribed', 'subscribe_date', 'signup_date', 'joined', 'created_at', 'since'],
  first_order_date: ['first_order_date', 'first_order', 'customer_since', 'since', 'created_at'],
  visit_date: ['visit_date', 'date', 'visit', 'arrival', 'arrival_date', 'start_date', 'data'],
  active_days: ['active_days', 'days_active', 'days'],
  longest_streak_days: ['longest_streak_days', 'longest_streak', 'streak', 'best_streak'],
  sessions: ['sessions', 'session_count', 'visits', 'logins'],
  items_created: ['items_created', 'items', 'created_items', 'count', 'total'],
  top_feature: ['top_feature', 'favorite_feature', 'favourite_feature', 'feature'],
  issues_opened: ['issues_opened', 'opens', 'opened', 'emails_opened'],
  links_clicked: ['links_clicked', 'clicks', 'clicked'],
  favorite_issue_title: ['favorite_issue_title', 'favourite_issue', 'favorite_issue', 'top_issue'],
  reading_streak_weeks: ['reading_streak_weeks', 'reading_streak', 'streak_weeks', 'streak'],
  referrals: ['referrals', 'referred', 'invites'],
  orders: ['orders', 'order_count', 'total_orders', 'purchases'],
  items_bought: ['items_bought', 'items', 'quantity', 'units'],
  favorite_product: ['favorite_product', 'favourite_product', 'top_product', 'product'],
  favorite_category: ['favorite_category', 'favourite_category', 'top_category', 'category'],
  amount_saved: ['amount_saved', 'saved', 'savings', 'discount'],
  loyalty_points: ['loyalty_points', 'points'],
  days: ['days', 'nights', 'number_of_days', 'ditet', 'dite'],
  activities_done: ['activities_done', 'activities', 'activity_count', 'animals_fed', 'aktivitete'],
  highlight: ['highlight', 'best_moment', 'favorite_moment', 'favourite_moment', 'moment'],
  badge: ['badge', 'award', 'title'],
  top_percent: ['top_percent', 'percentile', 'rank'],
  personal_note: ['personal_note', 'note', 'notes', 'message', 'comment', 'shenim'],
}

/**
 * Best header for each template column: exact key first, then synonyms in
 * order. Each header is used once.
 */
export function autoMap(headers: string[], template: Template): ColumnMapping {
  const byNorm = new Map<string, string>()
  for (const h of headers) {
    const n = normalizeHeader(h)
    if (n && !byNorm.has(n))
      byNorm.set(n, h)
  }
  const used = new Set<string>()
  const mapping: ColumnMapping = {}
  const take = (key: string, candidates: string[]) => {
    for (const c of candidates) {
      const h = byNorm.get(c)
      if (h && !used.has(h)) {
        used.add(h)
        mapping[key] = h
        return true
      }
    }
    return false
  }
  // Exact names first, so "days" isn't taken by active_days before days itself.
  for (const col of template.columns)
    take(col.key, [col.key])
  for (const col of template.columns) {
    if (!(col.key in mapping) && !take(col.key, SYNONYMS[col.key] ?? []))
      mapping[col.key] = null
  }
  return mapping
}

/** Does this sheet need the mapping step, or do its headers already fit? */
export function needsMapping(headers: string[], template: Template, mapping: ColumnMapping): boolean {
  const exact = new Set(headers.map(h => h.trim()))
  return template.columns.some(c => !exact.has(c.key) && (c.required || mapping[c.key]))
}

/** Rows keyed by the template's columns, read through the mapping. */
export function applyMapping(rows: Record<string, string>[], mapping: ColumnMapping): Record<string, string>[] {
  const pairs = Object.entries(mapping).filter((e): e is [string, string] => !!e[1])
  return rows.map(row => Object.fromEntries(pairs.map(([key, header]) => [key, row[header] ?? ''])))
}

export function missingRequired(template: Template, mapping: ColumnMapping): string[] {
  return template.columns.filter(c => c.required && !mapping[c.key]).map(c => c.key)
}

// --- The business's own columns (SPEC M2.7) ------------------------------------

/** A sheet column that isn't one of the template's fields, offered as the recap's own. */
export interface SheetExtra {
  header: string
  /** The column's key in the recap ("Gifts made" → gifts_made) */
  key: string
  label: string
  type: CustomColumn['type']
  /** Already one of this recap's own columns (matched by name) */
  existing: boolean
  /** Looks like an email, phone, address or id: not added unless picked */
  private: boolean
  /** First filled-in value */
  sample: string
  /** Import it and give it a slide */
  keep: boolean
}

/** More new columns than this and the business picks them itself (nothing pre-ticked). */
export const MAX_PRESELECTED = 12
const QUANTITY_RE = /^-?\d+(?:\.\d+)?$/
const DATE_PREFIX_RE = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/
const EMAIL_LIKE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_LIKE_RE = /^\+?[\d\s().-]{7,}$/
const PRIVATE_HEADER_RE = /(^|_)(e_?mail|phone|mobile|tel|telephone|cell|address|street|city|zip|zipcode|postal|postcode|post_code|last_name|lastname|surname|family_name|full_name|fullname|birth|birthday|dob|password|token|iban|account|card|ssn|passport|ip|user_agent|lat|latitude|lng|lon|longitude|id|uuid)($|_)/

/** Digits that aren't a quantity: a leading zero ("044 123") or too long to count (a phone, an id). */
const notAQuantity = (v: string) => /^0\d/.test(v) || v.replace(/\D/g, '').length > 9

/**
 * A column's type from its filled cells (≥ 80 % numbers or dates; numbers
 * with a fraction anywhere make it a decimal), and whether it looks private.
 */
export function inferColumn(header: string, values: string[]): { type: CustomColumn['type'], private: boolean } {
  const filled = values.filter(v => v !== '')
  const n = Math.max(1, filled.length)
  const quantities = filled.map(plainNumber).filter(v => QUANTITY_RE.test(v) && !notAQuantity(v))
  const dates = filled.filter(v => DATE_PREFIX_RE.test(v)).length
  const numeric = quantities.length >= 0.8 * n
  const type = numeric ? (quantities.some(v => /\.\d*[1-9]/.test(v)) ? 'decimal' : 'int') : dates >= 0.8 * n ? 'date' : 'text'
  const emails = filled.filter(v => EMAIL_LIKE_RE.test(v)).length
  const phones = filled.filter(v => PHONE_LIKE_RE.test(v) && v.replace(/\D/g, '').length >= 7 && notAQuantity(v.replace(/[\s().-]/g, ''))).length
  return { type, private: PRIVATE_HEADER_RE.test(normalizeHeader(header)) || emails >= 0.5 * n || phones >= 0.5 * n }
}

/** A free key for a header: normalized, starting with a letter, not taken. */
export function ownKeyFor(header: string, taken: Set<string>): string {
  let k = normalizeHeader(header).slice(0, 36) || 'column'
  if (!/^[a-z]/.test(k) || k.startsWith('top_'))
    k = `c_${k}`.slice(0, 36)
  let key = k
  for (let n = 2; taken.has(key); n++)
    key = `${k}_${n}`
  return key
}

/**
 * The sheet's columns that aren't template fields, as possible own columns:
 * those already in the recap (by name), and new ones with a detected type.
 * Headers the mapping uses, or named like a template field, aren't offered;
 * empty new columns are left out.
 */
export function sheetExtras(headers: string[], rows: Record<string, string>[], base: Template, own: CustomColumn[], mapping: ColumnMapping = {}): SheetExtra[] {
  const ownByKey = new Map(own.map(c => [c.key, c]))
  const fields = new Set(base.columns.map(c => c.key))
  const used = new Set(Object.values(mapping).filter(Boolean))
  const taken = new Set([...fields, ...RESERVED_KEYS, ...own.map(c => c.key)])
  const out: SheetExtra[] = []
  for (const header of headers) {
    if (!header.trim() || used.has(header) || fields.has(normalizeHeader(header)))
      continue
    const values = rows.map(r => r[header] ?? '').filter(v => v !== '')
    const existing = ownByKey.get(normalizeHeader(header))
    if (existing) {
      ownByKey.delete(existing.key)
      out.push({ header, key: existing.key, label: existing.label, type: existing.type, existing: true, private: false, sample: values[0] ?? '', keep: true })
      continue
    }
    if (!values.length)
      continue
    const key = ownKeyFor(header, taken)
    taken.add(key)
    const { type, private: priv } = inferColumn(header, values)
    out.push({ header, key, label: header.trim().slice(0, 60), type, existing: false, private: priv, sample: values[0]!, keep: !priv })
  }
  return out
}

/** Pre-tick at most MAX_PRESELECTED new columns: with more, the business picks. */
export function preselect(extras: SheetExtra[]): SheetExtra[] {
  const fresh = extras.filter(e => !e.existing)
  return fresh.length > MAX_PRESELECTED ? extras.map(e => (e.existing ? e : { ...e, keep: false })) : extras
}

/**
 * The recap's own columns and slides after a sheet: columns it ticked (new
 * ones get a slide each), plus earlier ones a slide still uses. A column the
 * sheet brings but the business unticked goes, with its slides.
 */
export function settingsForSheet(base: Template, settings: OwnSettings, extras: SheetExtra[]): Required<OwnSettings> {
  const kept = extras.filter(e => e.keep)
  const inSheet = new Set(kept.map(e => e.key))
  const dropped = new Set(extras.filter(e => e.existing && !e.keep).map(e => e.key))
  const usedBySlide = new Set((settings.slides ?? []).flatMap(s => (s.column ? [s.column] : [])))
  const stay = (settings.columns ?? []).filter(c => !dropped.has(c.key) && (inSheet.has(c.key) || usedBySlide.has(c.key)))
  const fresh = kept
    .filter(e => !e.existing && !stay.some(c => c.key === e.key))
    .map(e => ({ key: e.key, label: e.label, type: e.type }))
  const columns = [...stay, ...fresh].slice(0, MAX_OWN_COLUMNS)
  const known = new Set([...base.columns.map(c => c.key), ...columns.map(c => c.key)])
  const current = settings.slides ?? null
  const stale = !!current?.some(s => s.column && !known.has(s.column))
  const added = fresh.filter(c => columns.includes(c))
  if (!added.length && !stale)
    return { columns, slides: current }
  const list = (current ?? base.slides.map((d): SlideSetting => ({ key: d.key }))).filter(s => !s.column || known.has(s.column))
  for (const c of added)
    list.push({ key: addedKey(c.key, 'value'), column: c.key, show: 'value' })
  return { columns, slides: list }
}
