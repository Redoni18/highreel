// Recap scenes (SPEC M2.5 P1): which composition each slide gets, how long it
// stays, how it enters, and the layout maths behind the visuals. Pure and
// deterministic: a scene is a function of the slide's data and the time since
// it entered (seeded "randomness", no clocks), so the preview, the live page
// and a future video recorder (M4) draw the same frames.

import type { SceneKind, SlideDef } from '../templates/types'

export type { SceneKind }

/** Every slide's scene: the stat scenes plus the fixed ones. */
export type SlideScene = SceneKind | 'cover' | 'note' | 'since' | 'photo' | 'share' | 'line'

/** How a slide enters (forward). Going back always crossfades. */
export type SlideTransition = 'wipe' | 'push' | 'zoom' | 'flood' | 'rise' | 'fade'

/** Number slides count; text slides show the word; dates get a calendar page. Templates override with `scene`. */
export function sceneOf(def: Pick<SlideDef, 'kind' | 'scene'>): SceneKind {
  return def.scene ?? (def.kind === 'number' ? 'count' : def.kind === 'date' ? 'date' : 'word')
}

/** Time on screen (ms, 5–7 s) and entrance per scene. Cover and share as before M2.5. */
export const SCENE_TIMING: Record<SlideScene, { duration: number, transition: SlideTransition }> = {
  cover: { duration: 5000, transition: 'fade' },
  days: { duration: 6500, transition: 'wipe' },
  streak: { duration: 6000, transition: 'push' },
  count: { duration: 6000, transition: 'zoom' },
  word: { duration: 5500, transition: 'flood' },
  badge: { duration: 6000, transition: 'zoom' },
  rank: { duration: 6500, transition: 'flood' },
  timeline: { duration: 6500, transition: 'push' },
  date: { duration: 5500, transition: 'zoom' },
  // The M2.10 library.
  tally: { duration: 6000, transition: 'push' },
  fill: { duration: 6000, transition: 'rise' },
  slots: { duration: 6000, transition: 'zoom' },
  bignumber: { duration: 5500, transition: 'flood' },
  bubbles: { duration: 6000, transition: 'rise' },
  gauge: { duration: 6000, transition: 'zoom' },
  climb: { duration: 6500, transition: 'wipe' },
  sticker: { duration: 5500, transition: 'zoom' },
  typewriter: { duration: 6000, transition: 'fade' },
  flap: { duration: 6000, transition: 'push' },
  neon: { duration: 5500, transition: 'fade' },
  scatter: { duration: 5500, transition: 'flood' },
  spotlight: { duration: 6000, transition: 'fade' },
  postmark: { duration: 5500, transition: 'zoom' },
  podium: { duration: 6500, transition: 'rise' },
  leaderboard: { duration: 6500, transition: 'push' },
  receipt: { duration: 7000, transition: 'rise' },
  cards: { duration: 7000, transition: 'push' },
  checklist: { duration: 6500, transition: 'wipe' },
  note: { duration: 6000, transition: 'wipe' },
  since: { duration: 5000, transition: 'wipe' },
  photo: { duration: 6000, transition: 'push' },
  line: { duration: 5000, transition: 'fade' },
  share: { duration: 0, transition: 'rise' },
}

/** A note stays long enough to read: 5–7 s by word count. */
export function noteDuration(text: string): number {
  return Math.round(Math.min(7000, Math.max(5000, 4200 + words(text).length * 110)))
}

export function words(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

// --- Timing -------------------------------------------------------------------

/** The counter's curve: ease-out cubic, the same one CountUp uses. */
export const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3
const easeOutInverse = (y: number) => 1 - (1 - Math.min(1, Math.max(0, y))) ** (1 / 3)

/**
 * When a counter easing from 0 to n over `duration` (starting at `start`, ms)
 * first shows 1, 2 … n (it rounds, so step i appears at i − ½). Each tile,
 * link or token lights at its step, so the visual and the number move together.
 */
export function stepTimes(n: number, duration: number, start = 0): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, i) => Math.round(start + duration * easeOutInverse((i + 0.5) / n)))
}

/**
 * A CSS linear() easing that follows `f` (0 → 1 over the animation), sampled
 * at `points` steps. Lets a single keyframe (e.g. the chain's pan) track the
 * counter's curve exactly.
 */
export function cssEasing(f: (t: number) => number, points = 24): string {
  const values = Array.from({ length: points + 1 }, (_, i) => +f(i / points).toFixed(4))
  return `linear(${values.join(', ')})`
}

// --- Seeded randomness --------------------------------------------------------

/** mulberry32 seeded by a string (FNV-1a), so the same recap always gets the same jitter. */
export function seeded(key: string): () => number {
  let h = 0x811C9DC5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// --- days: a year's calendar, or one tile per visit day ----------------------

const MONTH_LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export interface CalendarMonth {
  label: string
  /** empty cells before the 1st (weeks start on Monday) */
  lead: number
  days: number
  /** index of this month's 1st within the year */
  first: number
}

/** The campaign year as 12 small month grids, with real weekdays. */
export function yearCalendar(year: number): { months: CalendarMonth[], total: number } {
  let first = 0
  const months = MONTH_LETTERS.map((label, m) => {
    const days = new Date(Date.UTC(year, m + 1, 0)).getUTCDate()
    const lead = (new Date(Date.UTC(year, m, 1)).getUTCDay() + 6) % 7
    const month = { label, lead, days, first }
    first += days
    return month
  })
  return { months, total: first }
}

/** The most days a short visit draws as its own days; a bigger number shows the year (Design says so). */
export const VISIT_DAYS = 70

/** How a visit's days are drawn: big tear-off pages, a small grid, or the year. */
export function daysLayout(value: number, span: 'year' | 'visit'): 'year' | 'pages' | 'grid' {
  if (span === 'year' || value > VISIT_DAYS)
    return 'year'
  return value <= 7 ? 'pages' : 'grid'
}

/** Tear-off page labels for a short visit: "Jul 14", "Jul 15" from the visit date, else "Day 1". */
export function visitPages(n: number, start: string | null): Array<{ top: string, day: string }> {
  const m = start && /^(\d{4})-(\d{2})-(\d{2})$/.exec(start)
  return Array.from({ length: n }, (_, i) => {
    if (!m)
      return { top: 'Day', day: String(i + 1) }
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + i))
    return { top: MONTH_SHORT[d.getUTCMonth()]!, day: String(d.getUTCDate()) }
  })
}

// --- count: tokens that drop and stack ---------------------------------------

const UNITS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]

/** At most ~60 tokens; above that each token stands for a round number ("● = 20"). */
export function tokenPlan(value: number, cap = 60): { count: number, unit: number } {
  const v = Math.max(0, Math.round(value))
  const unit = UNITS.find(u => Math.ceil(v / u) <= cap) ?? Math.ceil(v / cap)
  return { count: Math.min(cap, Math.ceil(v / unit)), unit }
}

// --- streak: a chain of links ------------------------------------------------

/** Links drawn: one per day/week up to 120 (beyond that nobody counts, the number says it). */
export function chainLinks(value: number): number {
  return Math.min(120, Math.max(0, Math.round(value)))
}

// --- The M2.10 library ----------------------------------------------------------

/** The round number a dial runs up to: 148 → 200, 41 → 50, 7 → 10, 2.4 → 5. */
export function niceMax(value: number): number {
  const v = Math.max(0, value)
  if (v <= 0)
    return 10
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * p >= v * 1.06)
      return m * p
  }
  return 10 * p
}

/** Tally marks: up to 50 drawn (ten groups of five); above that each mark stands for a round number. */
export function tallyPlan(value: number): { marks: number, unit: number } {
  const { count, unit } = tokenPlan(value, 50)
  return { marks: count, unit }
}

/** The characters of a word, for scenes that move each one ("Morning routine" → M, o, r…). */
export function letters(text: string, max = 40): string[] {
  return [...text].slice(0, max)
}

// --- timeline: milestones down a line ---------------------------------------

/** "March: opened the new barn" → a short label and the text; no label without a short lead-in. */
export function splitMilestone(text: string): { label: string | null, text: string } {
  const m = /^([^:]{1,24}):\s*(\S.*)$/.exec(text.trim())
  return m ? { label: m[1]!.trim(), text: m[2]!.trim() } : { label: null, text: text.trim() }
}

// --- Guess first ----------------------------------------------------------------

/**
 * The real value and two decoys, in ascending order. Deterministic per key.
 * Decoys keep the value's roughness (no round numbers next to an exact one),
 * stay inside the column's range, and the real one isn't always in the middle.
 */
export function guessChoices(value: number, key: string, min = 0, max = Number.POSITIVE_INFINITY): number[] {
  const rand = seeded(`guess|${key}|${value}`)
  const near = (dir: 1 | -1, from: number) => {
    const step = from < 12
      ? 1 + Math.floor(rand() * 3)
      : Math.max(2, Math.round(from * (0.22 + rand() * 0.3)))
    return from + dir * step
  }
  const ok = (n: number, taken: number[]) => n >= min && n <= max && !taken.includes(n)
  const patterns: Array<Array<1 | -1>> = [[-1, 1], [-1, -1], [1, 1]]
  const start = Math.floor(rand() * patterns.length)
  for (let k = 0; k < patterns.length; k++) {
    const pattern = patterns[(start + k) % patterns.length]!
    const out = [value]
    let lo = value
    let hi = value
    for (const dir of pattern) {
      const n = dir < 0 ? (lo = near(-1, lo)) : (hi = near(1, hi))
      if (!ok(n, out))
        break
      out.push(n)
    }
    if (out.length === 3)
      return out.sort((a, b) => a - b)
  }
  // Tiny ranges: walk outwards one step at a time.
  const out = [value]
  for (let d = 1; out.length < 3 && d < 1000; d++) {
    for (const n of [value + d, value - d]) {
      if (out.length < 3 && ok(n, out))
        out.push(n)
    }
  }
  return out.sort((a, b) => a - b)
}

/** "Guess first" asks on at most this many slides per recap, to keep the pace. */
export const GUESS_LIMIT = 2

// --- Type ------------------------------------------------------------------------

/** Font size (in --u units, 1/100 of the frame width) for a big value of `chars` characters. */
export function bigSizeU(chars: number, max = 30): number {
  return Math.min(max, 86 / Math.max(1, chars * 0.62))
}

/** Font size for a big word or phrase, by length. */
export function wordSizeU(text: string): number {
  const n = text.length
  if (n <= 8)
    return 16
  if (n <= 14)
    return 12.5
  if (n <= 22)
    return 10
  if (n <= 40)
    return 8
  return 6.6
}
