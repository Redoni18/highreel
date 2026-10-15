// Designs (SPEC M2.17): a Highreel's look is a design and one of its
// colourways; the business has no colour of its own.
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { templates, templateFor } from '../shared/templates'
import { cleanLook, DEFAULT_LOOK, designs, getDesign, resolveLook } from '../shared/templates/designs'
import { scenesFor } from '../shared/templates/own'
import { starters } from '../shared/templates/starters'
import { normalizeHex } from '../shared/utils/color'
import { normalizeSettings } from '../shared/utils/recap'

describe('designs', () => {
  test('each has a unique key, a renderer and colourways with real colours', () => {
    expect(new Set(designs.map(d => d.key)).size).toBe(designs.length)
    for (const d of designs) {
      expect(['stories', 'paper'], d.key).toContain(d.base)
      expect(d.colorways.length, d.key).toBeGreaterThan(0)
      expect(new Set(d.colorways.map(c => c.key)).size, d.key).toBe(d.colorways.length)
      for (const c of d.colorways)
        expect(normalizeHex(c.accent), `${d.key}.${c.key}`).toBe(c.accent.toUpperCase())
    }
  })

  test('a look as stored is made whole: unknown designs and colourways fall back', () => {
    expect(cleanLook({ design: 'paper', colorway: 'teal' })).toEqual({ design: 'paper', colorway: 'teal' })
    expect(cleanLook({ design: 'nope', colorway: 'teal' })).toEqual({ design: 'stories', colorway: 'teal' })
    expect(cleanLook({ design: 'stories', colorway: 'nope' })).toEqual({ design: 'stories', colorway: getDesign('stories').colorways[0]!.key })
    expect(cleanLook(null)).toEqual(DEFAULT_LOOK)
  })

  test('campaigns from before designs keep Stories or Paper (their theme)', () => {
    expect(normalizeSettings({ theme: 'paper' }).look.design).toBe('paper')
    expect(normalizeSettings({ theme: 'stories' }).look).toEqual(DEFAULT_LOOK)
    expect(normalizeSettings({}).look).toEqual(DEFAULT_LOOK)
  })

  test('the colours the business types had are their suggested looks', () => {
    const before: Record<string, string> = { 'habit-app': '#4F46E5', 'saas-tool': '#0F766E', 'newsletter': '#C8341B', 'summer-camp': '#F5C518' }
    for (const [key, accent] of Object.entries(before))
      expect(resolveLook(starters.find(s => s.key === key)!.look).accent, key).toBe(accent)
    expect(resolveLook(starters.find(s => s.key === 'saas-tool')!.look).theme).toBe('paper')
  })

  test('a design\'s preferred animation goes on slides nobody picked one for, where it fits', () => {
    const original = getDesign('stories').scenes
    getDesign('stories').scenes = { number: 'gauge', text: 'neon' }
    try {
      const look = { design: 'stories', colorway: 'indigo' }
      const t = templateFor('app', { columns: [], slides: null, look })
      const scene = (key: string) => t.slides.find(s => s.key === key)!.scene
      expect(scene('streak')).toBe('gauge')
      expect(scene('top_feature')).toBe('neon')
      // A rank isn't a "number" slide: its own animation stays.
      expect(scene('top_percent')).toBe(templates.app!.slides.find(s => s.key === 'top_percent')!.scene)
      // A slide's own pick wins.
      const picked = templateFor('app', { columns: [], slides: [{ key: 'streak', scene: 'tally' }], look })
      expect(picked.slides.find(s => s.key === 'streak')!.scene).toBe('tally')
      // Only where it fits the slide.
      for (const s of t.slides)
        expect(scenesFor(s), s.key).toContain(s.scene)
    }
    finally {
      getDesign('stories').scenes = original
    }
  })

  test('without design animations the template is untouched', () => {
    expect(templateFor('app', { columns: [], slides: null, look: DEFAULT_LOOK })).toBe(templates.app)
  })
})

describe('migrations/0007_campaign_looks.sql', () => {
  test('maps each old colour to the colourway with that colour, in both designs', () => {
    const sql = readFileSync(new URL('../migrations/0007_campaign_looks.sql', import.meta.url), 'utf8')
    const pairs = [...sql.matchAll(/when '(#[0-9A-F]{6})' then '(\w+)'/g)].map(m => [m[1], m[2]] as const)
    expect(pairs.length).toBe(10)
    for (const d of designs) {
      for (const [hex, key] of pairs)
        expect(d.colorways.find(c => c.key === key)?.accent, `${d.key}.${key}`).toBe(hex)
    }
    // Its fallbacks are each design's first colourway.
    expect(sql).toContain(`then '${getDesign('paper').colorways[0]!.key}' else '${getDesign('stories').colorways[0]!.key}'`)
  })
})
