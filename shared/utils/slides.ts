// Which slides a recap shows and what they say (SPEC §5.1, M2e). Driven by
// the template's slide list. Pure, so the workspace preview and the public
// recap page build identical slides.

import type { SlideDef, Template, TokenShape } from '../templates/types'
import type { RecapPayload } from '../types/recap'
import type { SlideScene, SlideTransition } from './scenes'
import { GUESS_LIMIT, guessChoices, noteDuration, SCENE_TIMING, sceneOf, splitMilestone } from './scenes'

/** 'cover', a slide key from the template, 'photo-<id>', 'note' or 'share' */
export type SlideKey = string
export type SlideTone = 'accent' | 'dark' | 'light'

export interface Slide {
  key: SlideKey
  tone: SlideTone
  /** the composition that draws it (SPEC M2.5 P1) */
  scene: SlideScene
  /** ms on screen before moving on (the share slide waits: 0) */
  duration: number
  /** how it enters going forward */
  transition: SlideTransition
  /** the share slide waits for the viewer */
  autoAdvance: boolean
  /** cover title */
  title?: string
  /** small label above the headline */
  kicker?: string
  before?: string
  /** big number that counts up */
  value?: number
  /** big text instead of a number */
  text?: string
  /** glued in front of the big value, e.g. "€" */
  prefix?: string
  /** glued to the big value, e.g. "%" */
  suffix?: string
  after?: string
  /** small supporting line */
  small?: string
  /** note slide body */
  note?: string
  /** group photo slide (SPEC M2c) */
  photo?: { url: string, caption: string, width: number, height: number, index: number }
  /** days scene: a year's calendar or the days of a visit (from the visit date) */
  days?: { span: 'year' | 'visit', year: number, start: string | null }
  /** "Guess first": the real value and two decoys, ascending */
  guess?: number[]
  /** timeline scene: the filled-in milestones, in order (SPEC M2.5 P4) */
  items?: Array<{ label: string | null, text: string }>
  /** count scene: the tokens' shape (M2.7) */
  tokens?: TokenShape
  /** date scene: the day, YYYY-MM-DD (M2.7) */
  date?: string
  /** a "top X %" slide: `value` is the percentage, lower is better (M2.10) */
  top?: boolean
}

export interface ShareStat {
  value: string
  label: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** "2026-02-14" → "February 14, 2026" (short: "Feb 14, 2026") */
function formatDate(date: string, short = false): string {
  const m = DAY_RE.exec(date)
  if (!m)
    return date
  const month = MONTHS[Number(m[2]) - 1]!
  return `${short ? month.slice(0, 3) : month} ${Number(m[3])}, ${m[1]}`
}

function formatMonthYear(date: string | null): string | null {
  const m = date && /^(\d{4})-(\d{2})/.exec(date)
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null
}

function yearsSince(date: string | null, today = new Date()): number {
  const m = date && /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m)
    return 0
  let years = today.getUTCFullYear() - Number(m[1])
  const beforeAnniversary = today.getUTCMonth() + 1 < Number(m[2])
    || (today.getUTCMonth() + 1 === Number(m[2]) && today.getUTCDate() < Number(m[3]))
  if (beforeAnniversary)
    years--
  return Math.max(0, years)
}

/** The campaign's copy for a slide key, else the template default. */
function copyFor(t: Template, p: RecapPayload, key: string): string {
  const custom = p.settings.copy?.[key]?.trim()
  if (custom)
    return custom
  return key === 'cover' ? t.cover : t.slides.find(s => s.key === key)?.copy ?? ''
}

function placeholderValues(t: Template, p: RecapPayload): Record<string, string> {
  const out: Record<string, string> = {
    first_name: p.recipient.first_name,
    year: String(p.year),
    business: p.business.name,
    items_label: p.settings.items_label,
  }
  const dates = new Set(t.columns.filter(c => c.type === 'date').map(c => c.key))
  for (const [k, v] of Object.entries(p.recipient.values))
    out[k] = v == null ? '' : typeof v === 'number' ? formatNumber(v) : dates.has(k) ? formatDate(v) : v
  return out
}

export function fillCopy(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match).replace(/\s+/g, ' ')
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Split one copy line around its headline value:
 * "You saved €{amount_saved} with us." → before "You saved", prefix "€",
 * the value, after "with us."
 */
function splitCopy(template: string, headline: string, values: Record<string, string>) {
  const token = `{${headline}}`
  const at = template.indexOf(token)
  if (at < 0)
    return { before: capitalize(fillCopy(template, values).trim()), prefix: '', suffix: '', after: '', found: false }
  let before = fillCopy(template.slice(0, at), values)
  // Symbols right before the value ("€") stick to it; a word ("Total:") stays in the line.
  let prefix = /\S+$/.exec(before)?.[0] ?? ''
  if (/[\p{L}\p{N}]/u.test(prefix))
    prefix = ''
  before = capitalize(before.slice(0, before.length - prefix.length).trim())
  let after = fillCopy(template.slice(at + token.length), values)
  const suffix = /^[^\s.,!?;:]+/.exec(after)?.[0] ?? ''
  after = after.slice(suffix.length).trim()
  if (/^[.,!?;:]*$/.test(after))
    after = ''
  return { before, prefix, suffix, after, found: true }
}

const filled = (v: unknown) => typeof v === 'string' && v.trim() !== ''
const present = (v: unknown) => typeof v === 'number' || filled(v)

function shows(def: { min?: number, max?: number, needsLabel?: boolean, kind: string, list?: string[] }, value: unknown, p: RecapPayload): boolean {
  if (def.needsLabel && !p.settings.items_label.trim())
    return false
  if (def.list)
    return def.list.some(col => present(p.recipient.values[col]))
  if (def.kind !== 'number')
    return typeof value === 'string' && value.trim() !== ''
  if (typeof value !== 'number')
    return false
  return (def.min == null || value >= def.min) && (def.max == null || value <= def.max)
}

type Untimed = Omit<Slide, 'tone' | 'duration' | 'transition'>

function statSlide(def: SlideDef, t: Template, p: RecapPayload, values: Record<string, string>): Untimed {
  if (def.list) {
    // A business's milestones read their label from the text ("March: …"); a list
    // the business made (M2.7) labels each item with its column, numbers and dates formatted.
    const labels = def.listLabels
    return {
      key: def.key,
      scene: sceneOf(def),
      autoAdvance: true,
      before: capitalize(fillCopy(copyFor(t, p, def.key), values).trim()) || undefined,
      items: def.list.filter(col => present(p.recipient.values[col])).map(col => (labels
        ? { label: labels[col] ?? null, text: values[col] ?? '' }
        : splitMilestone(String(p.recipient.values[col])))),
    }
  }
  const raw = p.recipient.values[def.column]
  const parts = splitCopy(copyFor(t, p, def.key), def.column, values)
  const smallValue = def.small ? p.recipient.values[def.small.column] : null
  const scene = sceneOf(def)
  return {
    key: def.key,
    // Custom copy without the {column} placeholder has no value to draw.
    scene: parts.found ? scene : 'line',
    autoAdvance: true,
    before: parts.before || undefined,
    ...(parts.found ? (def.kind === 'number' ? { value: raw as number } : { text: def.kind === 'date' ? formatDate(String(raw)) : String(raw) }) : {}),
    prefix: parts.prefix || undefined,
    suffix: parts.suffix || undefined,
    after: parts.after || undefined,
    small: def.small && typeof smallValue === 'number' && smallValue > 0 ? fillCopy(def.small.copy, values) : undefined,
    days: scene === 'days' ? { span: def.span ?? 'year', year: p.year, start: def.span === 'visit' ? p.recipient.since : null } : undefined,
    tokens: scene === 'count' ? def.tokens : undefined,
    date: def.kind === 'date' && parts.found ? String(raw) : undefined,
    top: def.top || !!def.rankBy || undefined,
  }
}

/** Duration and entrance; Paper's motion is calmer (wipes only). */
function timed(s: Untimed, tone: SlideTone, paper: boolean): Slide {
  const timing = SCENE_TIMING[s.scene]
  const duration = s.scene === 'note' && s.note ? noteDuration(s.note) : timing.duration
  const transition = paper && !['share', 'cover', 'line'].includes(s.scene) ? 'wipe' : timing.transition
  return { ...s, tone, duration, transition }
}

export function buildSlides(t: Template, p: RecapPayload, today = new Date()): Slide[] {
  const values = placeholderValues(t, p)
  const middle = t.slides
    .filter(def => shows(def, p.recipient.values[def.column], p))
    .map(def => statSlide(def, t, p, values))

  // "Guess first": the first number slides ask before they reveal.
  if (p.settings.guess_first) {
    let asked = 0
    for (const s of middle) {
      const def = t.slides.find(d => d.key === s.key)!
      if (asked >= GUESS_LIMIT || s.value == null || s.scene === 'line' || s.top)
        continue
      const col = t.columns.find(c => c.key === def.column)
      s.guess = guessChoices(s.value, `${p.recipient.first_name}|${s.key}`, col?.min ?? 0, col?.max)
      asked++
    }
  }

  // Group photos come after the stats, before the note.
  const photos: Untimed[] = p.settings.photos
    .filter(ph => ph.url)
    .map((ph, index) => ({
      key: `photo-${ph.id}`,
      scene: 'photo' as const,
      autoAdvance: true,
      photo: { url: ph.url!, caption: ph.caption ?? '', width: ph.width, height: ph.height, index },
    }))

  const tail: Untimed[] = []
  const note = p.recipient.note?.trim() || p.settings.founder_note.trim()
  const since = formatMonthYear(p.recipient.since)
  if (note || since) {
    const years = t.since?.countYears ? yearsSince(p.recipient.since, today) : 0
    tail.push(note
      ? { key: 'note', scene: 'note', autoAdvance: true, note, small: since && t.since ? fillCopy(t.since.copy, { since }) : undefined }
      : {
          key: 'note',
          scene: 'since',
          autoAdvance: true,
          kicker: t.since?.kicker,
          text: since!,
          after: t.since?.countYears
            ? (years >= 1 ? `${years} ${years === 1 ? 'year' : 'years'} and counting.` : 'And just getting started.')
            : undefined,
        })
  }

  const paper = p.settings.theme === 'paper'
  const cycle: SlideTone[] = ['dark', 'light', 'accent']
  const toned = [...middle, ...tail].map((s, i) => timed(s, cycle[i % cycle.length]!, paper))
  return [
    timed({ key: 'cover', scene: 'cover', autoAdvance: true, title: fillCopy(copyFor(t, p, 'cover'), values).trim() }, 'accent', paper),
    ...toned.slice(0, middle.length),
    ...photos.map(s => timed(s, 'accent', paper)),
    ...toned.slice(middle.length),
    timed({ key: 'share', scene: 'share', autoAdvance: false }, 'dark', paper),
  ]
}

const DEFAULT_SHARE = {
  lead: 'That\'s your {year}, {first_name}.',
  title: '{first_name}\'s {year} with {business}',
  description: 'A look back at {business}, made for {first_name}.',
}

/** The share slide's lead line, the share card/image title and the link-preview description. */
export function shareTexts(t: Template, p: RecapPayload): { lead: string, title: string, description: string } {
  const values = placeholderValues(t, p)
  const s = { ...DEFAULT_SHARE, ...t.share }
  return { lead: fillCopy(s.lead, values).trim(), title: fillCopy(s.title, values).trim(), description: fillCopy(s.description, values).trim() }
}

/** The 3–4 headline stats on the share card and image (SPEC §5.4). */
export function shareStats(t: Template, p: RecapPayload): ShareStat[] {
  const values = placeholderValues(t, p)
  const out: ShareStat[] = []
  for (const def of t.shareStats) {
    const v = p.recipient.values[def.column]
    if (!shows({ ...def, kind: def.kind === 'top' ? 'number' : def.kind }, v, p))
      continue
    const value = def.kind === 'top' ? `Top ${v}%` : typeof v === 'number' ? formatNumber(v) : def.kind === 'date' ? formatDate(String(v), true) : String(v)
    out.push({ value, label: fillCopy(def.label, values).trim() })
    if (out.length === 4)
      break
  }
  return out
}
