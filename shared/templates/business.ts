// Template "business" (SPEC M2.5 P4): one recap about the business's own
// year, for its Instagram, Facebook or LinkedIn ("Our 2026 at Forma
// Studio"). Not a sheet: the business fills in a form with up to four headline
// numbers, the highlight, up to three milestones; the thank-you note is the
// campaign note and the photos are the campaign photos. Copy speaks to
// followers. A campaign of this kind has exactly one row.

import type { RowErrors, Template } from './types'

const STATS = [1, 2, 3, 4]
const MILESTONES = [1, 2, 3]

export const businessTemplate: Template = {
  key: 'business',
  kind: 'business',
  label: 'Your business year',
  description: 'One Highreel of your year for your followers: headline numbers, the highlight, milestones, photos and a thank-you.',
  // No sheet to download: the business fills in a form.
  files: { template: '', sample: '' },
  columns: [
    ...STATS.flatMap(n => [
      { key: `stat_${n}`, type: 'int' as const, required: n === 1, min: 0, rule: 'whole number ≥ 0', usedFor: `number ${n}`, width: 100 },
      { key: `stat_${n}_label`, type: 'text' as const, required: n === 1, maxLength: 40, rule: '≤ 40 chars', usedFor: `what number ${n} counts`, width: 180 },
    ]),
    { key: 'highlight', type: 'text', required: false, maxLength: 80, rule: '≤ 80 chars', usedFor: 'highlight of the year', width: 240 },
    ...MILESTONES.map(n => ({ key: `milestone_${n}`, type: 'text' as const, required: false, maxLength: 80, rule: '≤ 80 chars', usedFor: 'a milestone, like "March: opened our second location"', width: 240 })),
  ],
  cover: 'Our {year} at {business}',
  share: {
    lead: 'Thank you for an amazing {year}.',
    title: 'Our {year} at {business}',
    description: 'A look back at {business}\'s {year}.',
  },
  noteLabel: 'Thank-you note',
  slides: [
    ...STATS.map(n => ({
      key: `stat_${n}`,
      label: `Number ${n}`,
      column: `stat_${n}`,
      kind: 'number' as const,
      scene: 'count' as const,
      copy: `{stat_${n}} {stat_${n}_label}`,
    })),
    { key: 'highlight', label: 'Highlight', column: 'highlight', kind: 'text', scene: 'word', copy: 'Highlight of the year: {highlight}' },
    {
      key: 'milestones',
      label: 'Milestones',
      column: 'milestone_1',
      kind: 'text',
      scene: 'timeline',
      list: MILESTONES.map(n => `milestone_${n}`),
      copy: 'Milestones of {year}',
    },
  ],
  shareStats: STATS.map(n => ({ column: `stat_${n}`, label: `{stat_${n}_label}`, kind: 'number' as const })),
  defaultSettings: {
    items_label: '',
    founder_note: 'Thank you for being part of our year. See you in the next one!',
    cta_label: '',
    cta_url: '',
    copy: {},
    photos: [],
    photo_in_share_image: false,
    photos_consent_at: null,
    theme: 'stories',
    guess_first: false,
  },
  check(data) {
    const out: RowErrors = {}
    for (const n of STATS) {
      const value = data[`stat_${n}`]
      const label = data[`stat_${n}_label`]
      if (value != null && !label)
        out[`stat_${n}_label`] = 'Say what this counts'
      if (label && value == null)
        out[`stat_${n}`] = 'Add the number'
    }
    return out
  },
}
