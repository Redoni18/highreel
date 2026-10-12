// Template "custom", "Your own sheet" (SPEC M2.7): only an id and a first
// name are required; every other column comes from the business's own sheet
// (settings.columns) and becomes a slide it designs (settings.slides). No
// slides, ranking or share stats of its own: templateFor() adds them.
// scripts/generate-sample.mjs writes its template and the Keepsake sample.

import type { Template } from './types'

export const customTemplate: Template = {
  key: 'custom',
  label: 'Your own sheet',
  description: 'Any columns you have: pick which become slides and how they move.',
  files: { template: '/templates/highreel-template-custom.csv', sample: '/templates/sample-keepsake-150.csv' },
  columns: [
    { key: 'customer_id', type: 'text', required: true, maxLength: 64, unique: true, rule: 'unique, ≤ 64 chars', usedFor: 'joining links back to your email tool', width: 132 },
    { key: 'first_name', type: 'text', required: true, minLength: 1, maxLength: 30, rule: '1–30 chars', usedFor: 'every slide', width: 132 },
    { key: 'email', type: 'email', required: false, rule: 'valid email', usedFor: 'emailing the highlight reel, and the links file', width: 214 },
    { key: 'phone', type: 'phone', required: false, rule: 'phone number, best with its country code', usedFor: 'WhatsApp only (never on the highlight reel)', width: 150 },
    { key: 'personal_note', type: 'text', required: false, maxLength: 140, rule: '≤ 140 chars', usedFor: 'per-customer note', width: 260 },
  ],
  cover: '{first_name}, your {year} with {business}',
  slides: [],
  noteColumn: 'personal_note',
  shareStats: [],
  audience: 'customers',
  defaultSettings: {
    items_label: '',
    founder_note: '',
    cta_label: '',
    cta_url: '',
    copy: {},
    photos: [],
    photo_in_share_image: false,
    photos_consent_at: null,
    theme: 'stories',
    guess_first: false,
  },
}
