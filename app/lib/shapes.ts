// The landing's flower shapes (SVG paths in a -100…100 box). Each outline is
// a polar function sampled around the circle and joined with Catmull-Rom
// curves, so the shapes stay smooth at any size and cost a few hundred bytes.
// Drawn once into a sprite (LandingShapes.vue) and reused with <use>.

import { polar } from './blobs.ts'

export { blobFrames } from './blobs.ts'

export type ShapeKind = 'clover' | 'poppy' | 'marigold' | 'scallop' | 'daisy'

/** Outlines for the filled shapes; the daisy is drawn from strokes (see LandingShapes.vue). */
export const SHAPE_PATHS: Record<Exclude<ShapeKind, 'daisy'>, string> = {
  // five round leaves, pinched where they meet
  clover: polar(80, t => 100 * (0.62 + 0.38 * Math.abs(Math.cos(2.5 * t)) ** 0.7)),
  // eight broad petals
  poppy: polar(96, t => 100 * (0.76 + 0.24 * ((1 + Math.cos(8 * t)) / 2) ** 0.45)),
  // a soft eight-point star
  marigold: polar(64, t => 100 * (0.84 + 0.16 * Math.cos(8 * t))),
  // a wavy-edged circle
  scallop: polar(72, t => 100 * (0.93 + 0.07 * Math.cos(12 * t))),
}

export const DAISY_RAYS = 12
