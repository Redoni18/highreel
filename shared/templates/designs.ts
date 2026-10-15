// Designs (SPEC M2.17): how a Highreel looks, apart from what it says. A
// Highreel is a business type (shared/templates/starters.ts: its sheet and
// wording) in a design: the artwork, its colours and the animations it
// prefers. Owner, 2026-10-15: colour belongs to the design, not to the
// business ("Your brand" has no colour any more), so a design comes in a few
// colourways of its own and a business picks one of those, never a colour of
// its own. A campaign stores its look as { design, colorway } (settings.look).
//
// To add a design: give it a key, a renderer to draw with (`base`: today the
// two the recap knows, Stories and Paper), at least one colourway and, if it
// has a style of its own, the animations it prefers per kind of slide. Keys
// are stored in campaigns: never rename one.

import type { RecapTheme } from '../utils/color'
import type { SceneKind } from './types'

export interface Colorway {
  key: string
  /** "Indigo" */
  label: string
  /** The colour the slides are drawn from (the recap derives its tones from it) */
  accent: string
}

/** The kinds of slide a design can pick an animation for (scenesFor() decides what fits). */
export type SceneGroup = 'number' | 'text' | 'date' | 'top' | 'list'

export interface Design {
  key: string
  label: string
  /** One line: how it looks */
  description: string
  /** The renderer it draws with */
  base: RecapTheme
  /** Its colours; the first is where it starts */
  colorways: Colorway[]
  /** The animation it prefers for a slide nobody picked one for, when that fits the slide */
  scenes?: Partial<Record<SceneGroup, SceneKind>>
}

/** What a campaign stores (settings.look). */
export interface Look {
  design: string
  colorway: string
}

// The colours the business types had before designs (each type suggests one).
const COLORS: Colorway[] = [
  { key: 'indigo', label: 'Indigo', accent: '#4F46E5' },
  { key: 'teal', label: 'Teal', accent: '#0F766E' },
  { key: 'violet', label: 'Violet', accent: '#7C3AED' },
  { key: 'lilac', label: 'Lilac', accent: '#8F66F6' },
  { key: 'sky', label: 'Sky', accent: '#0EA5E9' },
  { key: 'forest', label: 'Forest', accent: '#1F6F4A' },
  { key: 'sunflower', label: 'Sunflower', accent: '#F5C518' },
  { key: 'rust', label: 'Rust', accent: '#9A3412' },
  { key: 'poppy', label: 'Poppy', accent: '#C8341B' },
  { key: 'pink', label: 'Pink', accent: '#E2457A' },
]

export const designs: Design[] = [
  {
    key: 'stories',
    label: 'Stories',
    description: 'Full-screen color, like Instagram stories.',
    base: 'stories',
    colorways: COLORS,
  },
  {
    key: 'paper',
    label: 'Paper',
    description: 'A light paper page with color on the numbers and highlights.',
    base: 'paper',
    colorways: [COLORS[1]!, ...COLORS.filter((_, i) => i !== 1)],
  },
]

export const DEFAULT_LOOK: Look = { design: 'stories', colorway: 'indigo' }

export function getDesign(key: string | null | undefined): Design {
  return designs.find(d => d.key === key) ?? designs[0]!
}

/** A look as stored, made whole: a design that exists and one of its colourways. Before designs, `theme` said Stories or Paper. */
export function cleanLook(input: unknown, legacyTheme?: unknown): Look {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const key = typeof o.design === 'string' && designs.some(d => d.key === o.design) ? o.design : legacyTheme === 'paper' ? 'paper' : DEFAULT_LOOK.design
  const design = getDesign(key)
  const colorway = typeof o.colorway === 'string' && design.colorways.some(c => c.key === o.colorway) ? o.colorway : design.colorways[0]!.key
  return { design: design.key, colorway }
}

/** Everything the recap draws a look with. */
export interface ResolvedLook {
  design: Design
  colorway: Colorway
  /** the renderer: Stories or Paper */
  theme: RecapTheme
  accent: string
}

export function resolveLook(look: Look | null | undefined): ResolvedLook {
  const clean = cleanLook(look)
  const design = getDesign(clean.design)
  const colorway = design.colorways.find(c => c.key === clean.colorway) ?? design.colorways[0]!
  return { design, colorway, theme: design.base, accent: colorway.accent }
}
