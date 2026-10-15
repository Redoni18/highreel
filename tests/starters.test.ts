// Business-type templates (shared/templates/starters.ts): each fills in a real
// sheet template with copy it can use, and the landing's examples come from them.
import { describe, expect, test } from 'vitest'
import { copyKeysOf, getTemplate, templates } from '../shared/templates'
import { getStarter, starters, startersFor, withStarter } from '../shared/templates/starters'
import { buildSlides } from '../shared/utils/slides'
import { cleanLook } from '../shared/templates/designs'
import { normalizeSettings } from '../shared/utils/recap'

describe('starters', () => {
  test('keys and labels are unique', () => {
    expect(new Set(starters.map(s => s.key)).size).toBe(starters.length)
    expect(new Set(starters.map(s => s.label)).size).toBe(starters.length)
  })

  test('every one fills in a customer sheet template', () => {
    for (const s of starters) {
      const t = templates[s.template]
      expect(t, s.key).toBeTruthy()
      expect(t!.kind ?? 'customers', s.key).toBe('customers')
    }
    // every sheet template has at least one, so the gallery covers them all
    for (const t of Object.values(templates).filter(t => (t.kind ?? 'customers') === 'customers'))
      expect(startersFor(t.key).length, t.key).toBeGreaterThan(0)
  })

  test('copy only overrides the template\'s cover and slides, with known placeholders', () => {
    for (const s of starters) {
      const t = getTemplate(s.template)
      const keys = copyKeysOf(t)
      for (const [key, copy] of Object.entries(s.settings.copy)) {
        expect(keys, `${s.key}.${key}`).toContain(key)
        const slide = t.slides.find(x => x.key === key)
        if (slide)
          expect(copy, `${s.key}.${key} shows its value`).toContain(`{${slide.column}}`)
        for (const [, name] of copy.matchAll(/\{(\w+)\}/g))
          expect(['first_name', 'business', 'year', 'items_label', ...t.columns.map(c => c.key)], `${s.key}.${key}: {${name}}`).toContain(name)
      }
    }
  })

  test('a count label where the template has one, a look that exists, a note', () => {
    for (const s of starters) {
      const t = getTemplate(s.template)
      expect(!!s.settings.items_label, s.key).toBe(!!t.itemsLabel)
      // Its suggested design and colourway are real ones (cleanLook would change anything else).
      expect(cleanLook(s.look), s.key).toEqual(s.look)
      expect(s.settings.founder_note.length, s.key).toBeGreaterThan(0)
      expect(s.settings.founder_note.length, s.key).toBeLessThanOrEqual(280)
      expect(s.settings.cta_label.length, s.key).toBeLessThanOrEqual(32)
    }
  })

  test('withStarter keeps photos and survives normalizeSettings', () => {
    const s = getStarter('fitness-studio')!
    const base = { ...getTemplate('visit').defaultSettings, photos: [{ id: 'p', path: 'b/c/p.webp', caption: '', width: 10, height: 10 }] } as any
    const out = withStarter(base, s)
    expect(out.photos).toHaveLength(1)
    expect(normalizeSettings(out)).toMatchObject({ items_label: 'classes taken', look: { design: 'stories', colorway: 'pink' }, copy: { cover: '{first_name}, your {year} at {business}' } })
  })

  test('a starter\'s copy reaches the slides', () => {
    const s = getStarter('cafe')!
    const t = getTemplate(s.template)
    const slides = buildSlides(t, {
      template_key: t.key,
      year: 2026,
      business: { name: 'Kafe Lumi', logo_url: null, website_url: null },
      settings: withStarter(t.defaultSettings as any, s),
      recipient: { first_name: 'Ana', values: { orders: 52, favorite_product: 'Flat white' } },
    } as any)
    expect(slides.find(x => x.key === 'orders')).toMatchObject({ before: 'You came by', value: 52 })
    expect(slides.find(x => x.key === 'product')).toMatchObject({ before: 'Your usual:', text: 'Flat white' })
  })
})
