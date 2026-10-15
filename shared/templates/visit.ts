// Template "visit" (M2e): camps, daycares, gyms, studios, clubs. With kids'
// places the recipients are usually parents, and the recap speaks to the child. No ranking: it's a keepsake,
// not a leaderboard. Pairs well with the campaign's group photos (M2c).
// Keep scripts/generate-sample.mjs in sync.

import { DEFAULT_LOOK } from './designs'
import type { Template } from './types'

export const visitTemplate: Template = {
  key: 'visit',
  label: 'Visits and camps',
  description: 'Camps, daycares, gyms, studios, clubs: days, activities, best moment, a badge.',
  files: { template: '/templates/highreel-template-visit.csv', sample: '/templates/sample-visit-120.csv' },
  columns: [
    { key: 'participant_id', type: 'text', required: true, maxLength: 64, unique: true, rule: 'unique, ≤ 64 chars', usedFor: 'joining links back to your contact list', width: 140 },
    { key: 'first_name', type: 'text', required: true, minLength: 1, maxLength: 30, rule: '1–30 chars', usedFor: 'every slide', width: 132 },
    { key: 'email', type: 'email', required: false, rule: 'valid email', usedFor: 'emailing the Highreel (a parent\'s)', width: 214 },
    { key: 'phone', type: 'phone', required: false, rule: 'a parent\'s phone, best with its country code', usedFor: 'WhatsApp only (never on the Highreel)', width: 150 },
    { key: 'visit_date', type: 'date', required: false, notFuture: true, rule: 'YYYY-MM-DD, not in the future', usedFor: '"Your visit: June 2026"', width: 120 },
    { key: 'days', type: 'int', required: false, min: 1, max: 366, rule: '1–366', usedFor: 'days slide', width: 80 },
    { key: 'activities_done', type: 'int', required: false, min: 0, max: 1000, rule: '0–1000', usedFor: 'activities slide (label set per campaign)', width: 140 },
    { key: 'highlight', type: 'text', required: false, maxLength: 60, rule: '≤ 60 chars', usedFor: '"Best moment: the treasure hunt"', width: 220 },
    { key: 'badge', type: 'text', required: false, maxLength: 40, rule: '≤ 40 chars', usedFor: '"You earned: Early bird"', width: 160 },
    { key: 'personal_note', type: 'text', required: false, maxLength: 140, rule: '≤ 140 chars', usedFor: 'a note from the team', width: 260 },
  ],
  cover: '{first_name}, your days at {business}',
  share: { lead: 'What a time, {first_name}!', title: '{first_name}\'s days at {business}' },
  slides: [
    { key: 'days', label: 'Days', column: 'days', kind: 'number', min: 1, scene: 'days', span: 'visit', copy: 'Days at {business}: {days}' },
    { key: 'activities', label: 'Activities', column: 'activities_done', kind: 'number', min: 1, needsLabel: true, scene: 'count', copy: '{items_label}: {activities_done}' },
    { key: 'highlight', label: 'Best moment', column: 'highlight', kind: 'text', scene: 'word', copy: 'Best moment: {highlight}' },
    { key: 'badge', label: 'Badge', column: 'badge', kind: 'text', scene: 'badge', copy: 'You earned: {badge}' },
  ],
  noteColumn: 'personal_note',
  since: { column: 'visit_date', copy: 'Your visit: {since}', kicker: 'Your visit', countYears: false },
  itemsLabel: { column: 'activities_done', title: 'Activities label', placeholder: 'classes taken' },
  shareStats: [
    { column: 'days', label: 'days', kind: 'number', min: 1 },
    { column: 'activities_done', label: '{items_label}', kind: 'number', min: 1, needsLabel: true },
    { column: 'badge', label: 'badge earned', kind: 'text' },
    { column: 'highlight', label: 'best moment', kind: 'text' },
  ],
  audience: 'visitors',
  totals: [
    { column: 'activities_done', label: '{items_label}' },
    { column: 'days', label: 'days of visits' },
  ],
  defaultSettings: {
    items_label: 'activities',
    founder_note: '',
    cta_label: '',
    cta_url: '',
    copy: {},
    photos: [],
    photo_in_share_image: false,
    photos_consent_at: null,
    look: { ...DEFAULT_LOOK },
    guess_first: false,
  },
}
