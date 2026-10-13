// The logos are drawn in two places (SPEC §6.4): Wordmark.vue's CSS on the
// site, and scripts/brand.mjs for the icons, brand/ files and the link
// preview. Both logos must be the same shapes in both, and LOGO picks one.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CAP_PLAY, CAP_ROUND, CAP_SHIFT, H_STEMS, logos, REST, STROKE, STROKE_BOX, WORD } from '../scripts/brand.mjs'
import { LOGO } from '../app/data/brand'

const component = readFileSync(new URL('../app/components/Wordmark.vue', import.meta.url), 'utf8')
/** Every declaration for a selector (`.hr-cap::before { … }`, shared rules included). */
const rule = (selector: string) => [...component.matchAll(new RegExp(`${selector.replace(/[.:]/g, '\\$&')} \\{([^}]+)\\}`, 'g'))].map(m => m[1]).join('\n')
/** A length in em, as font units (1000 to the em). */
const units = (css: string, prop: string) => Math.round(Number(css.match(new RegExp(`(?:^|\\s)${prop}: (-?[\\d.]+)em`))?.[1]) * 1000)
/** The data-URI masks in a rule: [viewBox, path, stroke width or null], once for -webkit-mask and once for mask. */
const masks = (css: string) => [...css.matchAll(/viewBox='([^']+)'[^%]*%3E%3Cpath d='([^']+)'(?: stroke='%23000' stroke-width='(\d+)')?/g)].map(m => [m[1], m[2], m[3] ?? null])
const numbers = (d: string) => d.match(/-?\d+/g)!.map(Number)

it('the site uses one of the logos', () => {
  expect(Object.keys(logos)).toContain(LOGO)
  expect(component).toContain('import { LOGO } from \'~/data/brand\'')
})

describe('the capital H', () => {
  it('is Outfit Bold\'s H without its crossbar, and the word moves right by its extra width', () => {
    expect(H_STEMS).toBe('M68 0V-706H225V0ZM505 0V-706H663V0Z')
    expect(CAP_SHIFT).toBe(730 - 572) // the H's advance against the h's
    expect(REST).toBe(WORD.slice(WORD.indexOf('M591'))) // "ighreel"
  })

  it('has the same stems on the site', () => {
    const css = rule('.hr-cap::before')
    expect(masks(css)).toEqual([['68 -706 595 706', H_STEMS, null], ['68 -706 595 706', H_STEMS, null]])
    expect([units(css, 'left'), units(css, 'width'), units(css, 'height'), units(css, 'bottom')]).toEqual([68, 595, 706, 260])
  })

  it('has the same play on the site, fitted between the stems', () => {
    const css = rule('.hr-cap::after')
    const [x0, y0, , , x1, ymid] = numbers(CAP_PLAY)
    // The triangle grown by its rounding fills the gap between the stems, x 225–505.
    const box = [x0 - CAP_ROUND, y0 - CAP_ROUND, x1 + CAP_ROUND - (x0 - CAP_ROUND), 2 * (ymid - (y0 - CAP_ROUND))]
    expect(box).toEqual([225, -520, 280, 334])
    expect(masks(css)).toEqual([[box.join(' '), CAP_PLAY, String(2 * CAP_ROUND)], [box.join(' '), CAP_PLAY, String(2 * CAP_ROUND)]])
    expect([units(css, 'left'), units(css, 'width'), units(css, 'height'), units(css, 'bottom')]).toEqual([225, 280, 334, 260 + 186])
  })
})

describe('the highlighter', () => {
  it('has the same marker stroke and box on the site', () => {
    const box = [STROKE_BOX.x, STROKE_BOX.y, STROKE_BOX.w, STROKE_BOX.h].join(' ')
    expect(masks(rule('.hr-high::before'))).toEqual([[box, STROKE, null], [box, STROKE, null]])
  })
})
