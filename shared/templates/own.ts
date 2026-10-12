// A recap's own columns and slides on top of its template (SPEC M2.7). The
// template stays as code; a campaign's settings add columns from the
// business's sheet (`columns`) and reorder, hide, restyle or add slides
// (`slides`). withOwn() merges the two into the effective Template that the
// grid, validation, publish, the recap, the share image and the link preview
// all read, so they never need to know which parts the business added.

import type { CampaignSettings } from '../types/recap'
import type { ColumnType, CustomColumn, SceneKind, ShareStatDef, SlideDef, SlideSetting, Template, TemplateColumn, TokenShape } from './types'

export type OwnSettings = Pick<CampaignSettings, 'columns' | 'slides'>

export const MAX_OWN_COLUMNS = 30
export const MAX_SLIDES = 40
/** Placeholders every line already has; a column can't take their names. */
export const RESERVED_KEYS = ['first_name', 'year', 'business', 'items_label']
export const TOKEN_SHAPES: TokenShape[] = ['shapes', 'dots', 'hearts', 'stars']
/** A list slide shows up to this many columns. */
export const MAX_LIST = 5
/** Added numbers show from 1 (a "0 gifts made" slide helps nobody); added ranks to the top 25%. */
export const DEFAULT_MIN = 1
export const DEFAULT_TOP = 25

/** The scene library (SPEC M2.7, M2.10): what Design calls each scene. */
export const SCENES: Record<SceneKind, { label: string, hint: string }> = {
  count: { label: 'Count up', hint: 'The number rolls in while tokens pile up.' },
  days: { label: 'Calendar', hint: 'Days light up across the year, or one page per day for a short visit.' },
  streak: { label: 'Chain', hint: 'A chain lights up link by link.' },
  tally: { label: 'Tally', hint: 'Tally marks drawn in fives, like counting on a wall.' },
  fill: { label: 'Fill up', hint: 'A glass fills up while the number counts.' },
  slots: { label: 'Slot machine', hint: 'Reels spin and stop on each digit.' },
  bignumber: { label: 'Big number', hint: 'Poster-size type with echoes sliding in.' },
  bubbles: { label: 'Bubbles', hint: 'A bubble rises for each one and floats.' },
  gauge: { label: 'Gauge', hint: 'A needle swings up the dial to the number.' },
  climb: { label: 'Climb', hint: 'A trail lights up a mountain to a flag at the top.' },
  word: { label: 'Big word', hint: 'Big type over a moving wall of it.' },
  badge: { label: 'Badge', hint: 'A medal spins in with the word on it.' },
  sticker: { label: 'Sticker', hint: 'A sticker slaps on with a peeled corner.' },
  typewriter: { label: 'Typewriter', hint: 'Typed out letter by letter on a sheet.' },
  flap: { label: 'Departure board', hint: 'Split-flap tiles flip in, one letter each.' },
  neon: { label: 'Neon', hint: 'A neon sign flickers on.' },
  scatter: { label: 'Letters fly in', hint: 'Scattered letters fly together into the word.' },
  spotlight: { label: 'Spotlight', hint: 'A spotlight sweeps the dark and lands on it.' },
  date: { label: 'Calendar page', hint: 'A tear-off page drops in on the date.' },
  postmark: { label: 'Postmark', hint: 'A postmark stamps the date down.' },
  rank: { label: 'Top %', hint: '100 dots count down to theirs.' },
  podium: { label: 'Podium', hint: 'Three blocks rise; theirs is the tallest.' },
  leaderboard: { label: 'Leaderboard', hint: 'Rows slide in with theirs near the top.' },
  timeline: { label: 'Timeline', hint: 'A line draws down the list.' },
  receipt: { label: 'Receipt', hint: 'A receipt prints out, a line per item.' },
  cards: { label: 'Cards', hint: 'Each item is dealt on its own card.' },
  checklist: { label: 'Checklist', hint: 'Items tick off one by one.' },
}

const NUMBER_SCENES: SceneKind[] = ['count', 'days', 'streak', 'tally', 'fill', 'slots', 'bignumber', 'bubbles', 'gauge', 'climb']
/** A decimal (24.5) can't be counted out in marks, days, links or bubbles. */
const DECIMAL_SCENES: SceneKind[] = ['count', 'fill', 'slots', 'bignumber', 'gauge']
const TEXT_SCENES: SceneKind[] = ['word', 'badge', 'sticker', 'typewriter', 'flap', 'neon', 'scatter', 'spotlight']
const DATE_SCENES: SceneKind[] = ['date', 'postmark', 'word', 'flap', 'typewriter', 'neon']
const TOP_SCENES: SceneKind[] = ['rank', 'podium', 'leaderboard', 'bignumber', 'gauge']
const LIST_SCENES: SceneKind[] = ['timeline', 'receipt', 'cards', 'checklist']

/** Whole numbers and decimals. */
export const isNumeric = (type: ColumnType) => type === 'int' || type === 'decimal'

/** Scenes that fit a slide's data, in a fixed order (Design's pills don't move when one is picked). */
export function scenesFor(def: Pick<SlideDef, 'kind' | 'scene' | 'list' | 'rankBy' | 'decimal' | 'top'>): SceneKind[] {
  if (def.list)
    return LIST_SCENES
  if (def.top || def.rankBy || def.scene === 'rank')
    return TOP_SCENES
  // A calendar or a chain of 24.5 doesn't mean anything.
  if (def.decimal)
    return DECIMAL_SCENES
  return def.kind === 'number' ? NUMBER_SCENES : def.kind === 'date' ? DATE_SCENES : TEXT_SCENES
}

/** "Gifts_made" → "gifts made" */
export function humanize(header: string): string {
  return header.replace(/[_\s]+/g, ' ').trim().toLowerCase()
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Can a business column take this key next to this template's columns? */
export function ownKeyOk(key: string, base: Template): boolean {
  return /^[a-z][a-z0-9_]{0,39}$/.test(key)
    && !key.startsWith('top_')
    && !RESERVED_KEYS.includes(key)
    && !base.columns.some(c => c.key === key)
}

export function ownColumnDef(c: CustomColumn): TemplateColumn {
  const rule = c.type === 'int' ? 'whole number' : c.type === 'decimal' ? 'number, 2 decimals' : c.type === 'date' ? 'YYYY-MM-DD' : '≤ 140 chars'
  return {
    key: c.key,
    type: c.type,
    required: false,
    lenient: true,
    ...(c.type === 'text' ? { maxLength: 140 } : {}),
    label: c.label,
    rule,
    usedFor: 'your column',
    width: c.type === 'text' ? 180 : Math.min(200, Math.max(104, c.key.length * 8 + 40)),
  }
}

/** The column a "top X%" slide fills with the percentage. */
export const topColumn = (column: string) => `top_${column}`

/** The key an added slide must have: "c_<column>" for its value, "top_<column>" for its rank. */
export const addedKey = (column: string, show: SlideSetting['show']) => (show === 'top' ? topColumn(column) : `c_${column}`)

/** Lists are numbered: "list_1", "list_2"… */
export const LIST_KEY_RE = /^list_\d{1,3}$/
export function nextListKey(slides: SlideSetting[]): string {
  let n = 1
  while (slides.some(s => s.key === `list_${n}`))
    n++
  return `list_${n}`
}

/** Columns a slide may show: not the id, email, phone, first name or the note column. */
export function slideable(col: TemplateColumn, base: Template): boolean {
  return !col.unique && col.type !== 'email' && col.type !== 'phone' && col.key !== 'first_name' && col.key !== base.noteColumn
}

/** A default scene for an added column, by its name. */
export function defaultScene(col: Pick<TemplateColumn, 'key' | 'type'>): SceneKind {
  if (col.type === 'date')
    return 'date'
  if (col.type === 'decimal')
    return 'count'
  if (col.type === 'int')
    return /(^|_)days?($|_)/.test(col.key) ? 'days' : /(^|_)streaks?($|_)/.test(col.key) ? 'streak' : 'count'
  return /(^|_)(badge|award|level|title|status)($|_)/.test(col.key) ? 'badge' : 'word'
}

/** The name an added slide goes by ("gifts made"). */
export function addedLabel(s: SlideSetting, col: TemplateColumn): string {
  return s.label?.trim() || humanize(col.label ?? col.key)
}

function addedSlide(s: SlideSetting, col: TemplateColumn): { def: SlideDef, stat: ShareStatDef } {
  const label = addedLabel(s, col)
  if (s.show === 'top') {
    const column = topColumn(col.key)
    const max = s.max ?? DEFAULT_TOP
    return {
      def: { key: s.key, label: `Top % for ${label}`, column, kind: 'number', max, scene: s.scene && TOP_SCENES.includes(s.scene) ? s.scene : 'rank', top: true, rankBy: col.key, added: true, copy: `You're in the top {${column}}% for ${label}.` },
      stat: { column, label: `for ${label}`, kind: 'top', max },
    }
  }
  const kind = isNumeric(col.type) ? 'number' : col.type === 'date' ? 'date' : 'text'
  const decimal = col.type === 'decimal'
  const fits = scenesFor({ kind, decimal })
  const scene = s.scene && fits.includes(s.scene) ? s.scene : defaultScene(col)
  if (kind === 'number') {
    const min = s.min ?? DEFAULT_MIN
    return {
      def: { key: s.key, label: capitalize(label), column: col.key, kind, min, scene, added: true, copy: `{${col.key}} ${label}`, ...(decimal ? { decimal } : {}), ...(s.tokens ? { tokens: s.tokens } : {}), ...(scene === 'days' ? { span: s.span ?? 'year' } : {}) },
      stat: { column: col.key, label, kind: 'number', min },
    }
  }
  return {
    def: { key: s.key, label: capitalize(label), column: col.key, kind, scene, added: true, copy: `${capitalize(label)}: {${col.key}}` },
    stat: { column: col.key, label, kind: kind === 'date' ? 'date' : 'text' },
  }
}

/** A list the business made (M2.7): its columns down a timeline, each labelled with the column's name. */
function listSlide(s: SlideSetting, cols: TemplateColumn[]): SlideDef {
  return {
    key: s.key,
    label: s.label?.trim() || 'At a glance',
    column: cols[0]!.key,
    kind: 'text',
    scene: s.scene && LIST_SCENES.includes(s.scene) ? s.scene : 'timeline',
    list: cols.map(c => c.key),
    listLabels: Object.fromEntries(cols.map(c => [c.key, capitalize(humanize(c.label ?? c.key))])),
    added: true,
    copy: 'Your {year} at a glance',
  }
}

/** A template slide with the campaign's options: scene, tokens, calendar span, show rule. */
function withOptions(def: SlideDef, s: SlideSetting): SlideDef {
  const out: SlideDef = { ...def }
  if (s.scene && scenesFor(def).includes(s.scene))
    out.scene = s.scene
  if (s.tokens)
    out.tokens = s.tokens
  if (s.span)
    out.span = s.span
  if (def.kind === 'number' && !def.list) {
    if (s.min !== undefined && Number.isFinite(s.min))
      out.min = s.min
    if (s.max !== undefined && Number.isFinite(s.max))
      out.max = s.max
  }
  return out
}

export interface SlideEntry {
  def: SlideDef
  /** The setting as stored, or a bare { key } for a template slide nobody touched */
  setting: SlideSetting
  hidden: boolean
  /** Share-card stat of an added slide */
  stat?: ShareStatDef
}

/** The template's columns plus the business's own (those that fit next to them). */
export function columnsWithOwn(base: Template, settings?: OwnSettings | null): TemplateColumn[] {
  const seen = new Set<string>()
  const own = (settings?.columns ?? []).filter((c) => {
    const ok = ownKeyOk(c.key, base) && !seen.has(c.key)
    seen.add(c.key)
    return ok
  })
  return [...base.columns, ...own.slice(0, MAX_OWN_COLUMNS).map(ownColumnDef)]
}

/**
 * Every slide of the recap in order, hidden ones included (Design lists
 * them). Settings that no longer fit (a column gone, a duplicate key) are
 * skipped; template slides the list doesn't mention come at the end.
 */
export function slideEntries(base: Template, settings?: OwnSettings | null, columns = columnsWithOwn(base, settings)): SlideEntry[] {
  const list = settings?.slides
  if (!list)
    return base.slides.map(def => ({ def, setting: { key: def.key }, hidden: false }))
  const byKey = new Map(columns.map(c => [c.key, c]))
  const out: SlideEntry[] = []
  const seen = new Set<string>()
  for (const s of list.slice(0, MAX_SLIDES)) {
    if (seen.has(s.key))
      continue
    const def = base.slides.find(d => d.key === s.key)
    if (def) {
      seen.add(s.key)
      out.push({ def: withOptions(def, s), setting: s, hidden: !!s.hidden })
      continue
    }
    if (s.show === 'list') {
      const cols = (s.columns ?? []).map(k => byKey.get(k)).filter((c): c is TemplateColumn => !!c && slideable(c, base)).slice(0, MAX_LIST)
      if (!LIST_KEY_RE.test(s.key) || !cols.length)
        continue
      seen.add(s.key)
      out.push({ def: listSlide(s, cols), setting: s, hidden: !!s.hidden })
      continue
    }
    const col = s.column ? byKey.get(s.column) : undefined
    if (!col || !slideable(col, base) || s.key !== addedKey(col.key, s.show) || (s.show === 'top' && !isNumeric(col.type)))
      continue
    seen.add(s.key)
    const { def: added, stat } = addedSlide(s, col)
    out.push({ def: added, setting: s, hidden: !!s.hidden, stat })
  }
  for (const def of base.slides) {
    if (!seen.has(def.key))
      out.push({ def, setting: { key: def.key }, hidden: false })
  }
  return out
}

/** The effective template: the base with the campaign's own columns and slides. */
export function withOwn(base: Template, settings?: OwnSettings | null): Template {
  if (!settings?.columns?.length && !settings?.slides)
    return base
  const columns = columnsWithOwn(base, settings)
  const entries = slideEntries(base, settings, columns)
  const shown = entries.filter(e => !e.hidden)
  // A hidden template slide takes its share-card stat with it; a changed show rule applies there too.
  const hidden = new Set(entries.filter(e => e.hidden && !e.def.added).map(e => e.def.column))
  const rules = new Map(shown.filter(e => !e.def.added).map(e => [e.def.column, e.def]))
  const shareStats: ShareStatDef[] = [
    ...base.shareStats
      .filter(s => !hidden.has(s.column))
      .map((s) => {
        const def = rules.get(s.column)
        return def && s.kind !== 'text' ? { ...s, min: def.min ?? s.min, max: def.max ?? s.max } : s
      }),
    ...shown.flatMap(e => (e.stat ? [e.stat] : [])),
  ]
  return { ...base, columns, slides: shown.map(e => e.def), shareStats }
}

/** Copy keys a campaign may set: the cover and every slide, hidden ones too. */
export function ownCopyKeys(base: Template, settings?: OwnSettings | null): string[] {
  return ['cover', ...slideEntries(base, settings).map(e => e.def.key)]
}

/** Number columns a "top X%" can rank by: computed for all of them at publish. */
export function rankableColumns(t: Template): string[] {
  return t.columns.filter(c => isNumeric(c.type) && slideable(c, t)).map(c => c.key)
}

/** Where publish stores a row's "top X%" by a column (inside `data`). */
export const storedRankKey = (column: string) => `computed_top:${column}`

// --- Changing a column (the Sheet's column menu) ----------------------------------

/**
 * The recap's columns and slides after a column changes type or goes. Its
 * slides keep what still fits: a "top X%" needs a number, scenes and number
 * options go when the new type can't use them; a removed column leaves its
 * slides and lists (a list that empties goes too).
 */
export function changeColumn(settings: OwnSettings, key: string, change: { type: CustomColumn['type'] } | { remove: true }): Required<OwnSettings> {
  const columns = settings.columns ?? []
  const slides = settings.slides ?? null
  if ('remove' in change) {
    return {
      columns: columns.filter(c => c.key !== key),
      slides: slides && slides.flatMap((s) => {
        if (s.show === 'list') {
          const cols = (s.columns ?? []).filter(c => c !== key)
          return cols.length ? [{ ...s, columns: cols }] : []
        }
        return s.column === key ? [] : [s]
      }),
    }
  }
  const { type } = change
  const kind = isNumeric(type) ? 'number' : type === 'date' ? 'date' : 'text'
  const fits = scenesFor({ kind, decimal: type === 'decimal' })
  return {
    columns: columns.map(c => (c.key === key ? { ...c, type } : c)),
    slides: slides && slides.flatMap((s) => {
      if (s.column !== key || s.show === 'list')
        return [s]
      if (s.show === 'top')
        return isNumeric(type) ? [s] : []
      const { scene, tokens, span, min, max: _max, ...rest } = s
      const next: SlideSetting = { ...rest }
      if (scene && fits.includes(scene))
        next.scene = scene
      if (kind === 'number') {
        if (tokens)
          next.tokens = tokens
        if (span && type === 'int')
          next.span = span
        if (min !== undefined)
          next.min = min
      }
      return [next]
    }),
  }
}

// --- Reading settings (stored JSON, request bodies) --------------------------------

const SCENE_KEYS = Object.keys(SCENES) as SceneKind[]
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/** Columns as stored or sent: the shape only (withOwn checks them against the template). */
export function cleanColumns(input: unknown): CustomColumn[] {
  if (!Array.isArray(input))
    return []
  const out: CustomColumn[] = []
  for (const c of input.slice(0, MAX_OWN_COLUMNS)) {
    const o = c as Record<string, unknown>
    if (!o || typeof o.key !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(o.key) || out.some(x => x.key === o.key))
      continue
    if (o.type !== 'int' && o.type !== 'decimal' && o.type !== 'text' && o.type !== 'date')
      continue
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 60) : o.key
    out.push({ key: o.key, label, type: o.type })
  }
  return out
}

/** A slide list as stored or sent: the shape only; null keeps the template's own. */
export function cleanSlides(input: unknown): SlideSetting[] | null {
  if (!Array.isArray(input))
    return null
  const out: SlideSetting[] = []
  for (const x of input.slice(0, MAX_SLIDES)) {
    const o = x as Record<string, unknown>
    if (!o || typeof o.key !== 'string' || !/^[\w-]{1,48}$/.test(o.key) || out.some(s => s.key === o.key))
      continue
    const s: SlideSetting = { key: o.key }
    if (typeof o.column === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(o.column))
      s.column = o.column
    if (o.show === 'value' || o.show === 'top' || o.show === 'list')
      s.show = o.show
    if (Array.isArray(o.columns)) {
      const cols = o.columns.filter((c): c is string => typeof c === 'string' && /^[a-z][a-z0-9_]{0,39}$/.test(c))
      s.columns = [...new Set(cols)].slice(0, MAX_LIST)
    }
    if (typeof o.label === 'string' && o.label.trim())
      s.label = o.label.trim().slice(0, 40)
    if (o.hidden === true)
      s.hidden = true
    if (typeof o.scene === 'string' && SCENE_KEYS.includes(o.scene as SceneKind))
      s.scene = o.scene as SceneKind
    if (typeof o.tokens === 'string' && TOKEN_SHAPES.includes(o.tokens as TokenShape))
      s.tokens = o.tokens as TokenShape
    if (o.span === 'year' || o.span === 'visit')
      s.span = o.span
    if (isInt(o.min) && o.min >= 0 && o.min <= 1_000_000)
      s.min = o.min
    if (isInt(o.max) && o.max >= 1 && o.max <= 100)
      s.max = o.max
    out.push(s)
  }
  return out
}
