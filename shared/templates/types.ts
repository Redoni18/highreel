// Types shared by every spreadsheet template (SPEC §4, M2e). A template is
// data: the columns a business fills in, how cells are validated, and which
// recap slides the values feed. Businesses defining their own templates later
// will produce this same shape.

/** int: whole numbers; decimal (M2.7, the business's own columns): up to 2 decimals */
export type ColumnType = 'text' | 'email' | 'phone' | 'date' | 'int' | 'decimal'

export interface TemplateColumn {
  key: string
  type: ColumnType
  required: boolean
  /** text: length limits */
  minLength?: number
  maxLength?: number
  /** int: inclusive range */
  min?: number
  max?: number
  /** date: reject dates after today */
  notFuture?: boolean
  /** unique within the sheet (duplicates flagged on every later row) */
  unique?: boolean
  /** short "Rule" text for the compact column table */
  rule: string
  /** short "Used for" text for the compact column table */
  usedFor: string
  /** grid column width in px */
  width: number
  /** The business's own column (SPEC M2.7): its header as written in the sheet */
  label?: string
  /**
   * Lenient rules for sheets exported from other tools (M2.7): numbers may
   * carry a currency sign or %, thousands separators and decimal commas
   * (whole numbers round), dates may carry a time.
   */
  lenient?: boolean
}

export type CellValue = string | number | null

/** Cells exactly as uploaded/edited. Always strings (trimmed). */
export type RawRow = Record<string, string>

/** Parsed, typed values. Invalid or blank cells are null. */
export type ParsedRow = Record<string, CellValue>

/** { column: message } */
export type RowErrors = Record<string, string>

/**
 * How a stat slide is drawn (SPEC M2.5 P1). Scenes only visualise the value
 * the slide already has: days (a calendar fills in), streak (a chain lights
 * up), count (rolling digits, tokens stack), word (big type over a marquee),
 * badge (a medal spins in), rank (100 dots, the top X% stay lit), timeline
 * (a line draws down a list of milestones; M2.5 P4).
 */
export type SceneKind =
  // numbers (M2.5 P1, M2.10)
  | 'count' | 'days' | 'streak' | 'tally' | 'fill' | 'slots' | 'bignumber' | 'bubbles' | 'gauge' | 'climb'
  // words and dates
  | 'word' | 'badge' | 'sticker' | 'typewriter' | 'flap' | 'neon' | 'scatter' | 'spotlight' | 'date' | 'postmark'
  // top X %
  | 'rank' | 'podium' | 'leaderboard'
  // lists
  | 'timeline' | 'receipt' | 'cards' | 'checklist'

/** What the count scene's tokens look like (SPEC M2.7). */
export type TokenShape = 'shapes' | 'dots' | 'hearts' | 'stars'

/**
 * One stat slide. Its copy is a sentence with {placeholders}; the {column}
 * placeholder is shown big (counting up for numbers).
 */
export interface SlideDef {
  key: string
  /** Name in the Brand panel: "Active days" */
  label: string
  column: string
  kind: 'number' | 'text' | 'date'
  copy: string
  /** number: show only when value ≥ min / ≤ max */
  min?: number
  max?: number
  /** hide unless the campaign's count label (items_label) is filled in */
  needsLabel?: boolean
  /** small supporting line, shown when its value is > 0 */
  small?: { column: string, copy: string }
  /** the scene that draws it; default: numbers → count, text → word */
  scene?: SceneKind
  /** days scene: the value out of a year (a 12-month calendar) or the days of one visit (a tile each) */
  span?: 'year' | 'visit'
  /** timeline scene: the columns listed in order (shown when any is filled); the copy is its heading */
  list?: string[]
  /** A list the business made (M2.7): each item labelled with its column's name, not split from its text */
  listLabels?: Record<string, string>
  /** count scene: the tokens' shape (default: squares and circles) */
  tokens?: TokenShape
  /** A "top X%" slide the business added (M2.7): ranks rows by this column; `column` holds the percentage */
  rankBy?: string
  /** Added by the business (M2.7), not part of the template */
  added?: boolean
  /** A number with decimals (M2.7): only scenes that don't count units fit it */
  decimal?: boolean
  /** A "top X %" slide (M2.10): its number is a percentage where lower is better, whichever scene draws it */
  top?: boolean
}

export interface ShareStatDef {
  column: string
  /** may use {items_label} and {business} */
  label: string
  kind: 'number' | 'text' | 'top' | 'date'
  min?: number
  max?: number
  needsLabel?: boolean
}

export interface Template {
  key: string
  /** A recap per customer (default), or one recap about the business itself (SPEC M2.5 P4) */
  kind?: 'customers' | 'business'
  label: string
  /** One line for the template picker */
  description: string
  columns: TemplateColumn[]
  /** Cover title; may use {first_name} {year} {business} */
  cover: string
  /** Share slide lead line, share card/image title and link-preview description (defaults: the yearly wording) */
  share?: { lead: string, title: string, description?: string }
  /** Brand panel label for the campaign-wide note (default "Founder note") */
  noteLabel?: string
  slides: SlideDef[]
  /** Per-recipient note column (else the campaign's founder note) */
  noteColumn?: string
  /** Date column for "With us since March 2025" */
  since?: { column: string, copy: string, kicker: string, countYears: boolean }
  /** "Top X%" ranking: by which column, with an optional override column */
  rank?: { by: string, override?: string }
  /** The campaign-level label after a count ("habits checked off", "animals fed") */
  itemsLabel?: { column: string, title: string, placeholder: string }
  /** 3–4 headline stats for the share card and image, first matches win */
  shareStats: ShareStatDef[]
  /** Settings a new campaign with this template starts with */
  defaultSettings: {
    items_label: string
    founder_note: string
    cta_label: string
    cta_url: string
    copy: Record<string, string>
    photos: []
    photo_in_share_image: boolean
    photos_consent_at: null
    theme: 'stories' | 'paper'
    guess_first: boolean
  }
  /** Files businesses download, in public/templates */
  files: { template: string, sample: string }
  /** Cross-column checks that warn but don't block publishing. */
  warnings?: (data: ParsedRow) => RowErrors
  /** Cross-column checks that block publishing, like a cell error. */
  check?: (data: ParsedRow) => RowErrors
  /** What a business recap can suggest from this template's campaigns (M2.5 P4): who got one… */
  audience?: string
  /** …and column totals across the published rows, labelled for followers ("habits checked off") */
  totals?: Array<{ column: string, label: string }>
}

/** A column the business brought (SPEC M2.7), kept in the campaign's settings. */
export interface CustomColumn {
  /** The header normalized: "Gifts made" → "gifts_made" */
  key: string
  /** The header as written in the sheet */
  label: string
  type: 'int' | 'decimal' | 'text' | 'date'
}

/**
 * One slide of a campaign's own list (SPEC M2.7): a template slide (by its
 * key) with options, or a slide the business added from a column.
 */
export interface SlideSetting {
  /** A template slide's key, or "c_<column>" / "top_<column>" for an added one */
  key: string
  /** Added slides: the column it shows, or ranks by */
  column?: string
  /** Added slides: the column's value, the row's "top X%" by it, or a list of several columns */
  show?: 'value' | 'top' | 'list'
  /** A list: its columns, in order (up to 5) */
  columns?: string[]
  /** Added slides: a short name for Design and the share card ("gifts made") */
  label?: string
  hidden?: boolean
  scene?: SceneKind
  tokens?: TokenShape
  span?: 'year' | 'visit'
  /** Numbers: shown from this value up */
  min?: number
  /** Top X%: shown to the top `max` % */
  max?: number
}
