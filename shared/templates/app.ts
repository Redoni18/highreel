// Template "app" (SaaS and apps), SPEC §4.1. This is the contract: the grid
// columns, the validators and the recap slides all read from it.
// scripts/generate-sample.mjs writes CSVs with exactly these columns; keep
// the two in sync.

import type { RowErrors, Template } from './types'

export const appTemplate: Template = {
  key: 'app',
  label: 'SaaS and apps',
  description: 'Active days, streaks, things created, favourite feature.',
  files: { template: '/templates/highreel-template-app.csv', sample: '/templates/sample-habitly-200.csv' },
  columns: [
    {
      key: 'customer_id', type: 'text', required: true, maxLength: 64, unique: true,
      rule: 'unique, ≤ 64 chars', usedFor: 'joining links back to your email tool', width: 132,
    },
    {
      key: 'first_name', type: 'text', required: true, minLength: 1, maxLength: 30,
      rule: '1–30 chars', usedFor: 'every slide', width: 132,
    },
    {
      key: 'email', type: 'email', required: false,
      rule: 'valid email', usedFor: 'emailing the Highreel, and the links file', width: 214,
    },
    { key: 'phone', type: 'phone', required: false, rule: 'phone number, best with its country code', usedFor: 'WhatsApp only (never on the Highreel)', width: 150 },
    {
      key: 'member_since', type: 'date', required: false, notFuture: true,
      rule: 'YYYY-MM-DD, not in the future', usedFor: '"With us since March 2025"', width: 136,
    },
    {
      key: 'active_days', type: 'int', required: true, min: 0, max: 366,
      rule: '0–366', usedFor: 'active-days slide, ranking', width: 128,
    },
    {
      key: 'longest_streak_days', type: 'int', required: false, min: 0, max: 366,
      rule: '0–366, ≤ active_days', usedFor: 'streak slide', width: 178,
    },
    {
      key: 'sessions', type: 'int', required: false, min: 0,
      rule: '≥ 0', usedFor: 'small line on active-days slide', width: 104,
    },
    {
      key: 'items_created', type: 'int', required: false, min: 0,
      rule: '≥ 0', usedFor: 'volume slide (label set per campaign)', width: 140,
    },
    {
      key: 'top_feature', type: 'text', required: false, maxLength: 40,
      rule: '≤ 40 chars', usedFor: '"Your go-to: Morning routine"', width: 140,
    },
    {
      key: 'top_percent', type: 'int', required: false, min: 1, max: 100,
      rule: '1–100, usually blank', usedFor: 'override for the computed rank', width: 124,
    },
    {
      key: 'personal_note', type: 'text', required: false, maxLength: 140,
      rule: '≤ 140 chars', usedFor: 'per-customer note', width: 260,
    },
  ],
  cover: '{first_name}, your {year} with {business}',
  slides: [
    {
      key: 'active_days', label: 'Active days', column: 'active_days', kind: 'number', scene: 'days', span: 'year',
      copy: 'You showed up on {active_days} days.',
      small: { column: 'sessions', copy: '{sessions} sessions' },
    },
    {
      key: 'streak', label: 'Longest streak', column: 'longest_streak_days', kind: 'number', min: 3, scene: 'streak',
      copy: 'Longest streak: {longest_streak_days} days in a row.',
    },
    {
      key: 'items', label: 'Items', column: 'items_created', kind: 'number', min: 1, needsLabel: true, scene: 'count',
      copy: '{items_created} {items_label}.',
    },
    {
      key: 'top_feature', label: 'Go-to feature', column: 'top_feature', kind: 'text', scene: 'word',
      copy: 'Your go-to: {top_feature}',
    },
    {
      key: 'top_percent', label: 'Top percent', column: 'top_percent', kind: 'number', max: 25, scene: 'rank', top: true,
      copy: 'You\'re in the top {top_percent}% of {business} users.',
    },
  ],
  noteColumn: 'personal_note',
  since: { column: 'member_since', copy: 'With us since {since}', kicker: 'With us since', countYears: true },
  rank: { by: 'active_days', override: 'top_percent' },
  itemsLabel: { column: 'items_created', title: 'Items label', placeholder: 'habits checked off' },
  shareStats: [
    { column: 'active_days', label: 'active days', kind: 'number' },
    { column: 'longest_streak_days', label: 'day streak', kind: 'number', min: 3 },
    { column: 'items_created', label: '{items_label}', kind: 'number', min: 1, needsLabel: true },
    { column: 'top_percent', label: 'of {business} users', kind: 'top', max: 25 },
    { column: 'top_feature', label: 'go-to feature', kind: 'text' },
  ],
  audience: 'customers',
  totals: [
    { column: 'items_created', label: '{items_label}' },
    { column: 'active_days', label: 'active days' },
    { column: 'sessions', label: 'sessions' },
  ],
  defaultSettings: {
    items_label: 'items created',
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
  warnings(data) {
    const out: RowErrors = {}
    const streak = data.longest_streak_days
    const active = data.active_days
    if (typeof streak === 'number' && typeof active === 'number' && streak > active)
      out.longest_streak_days = 'Longer than active_days'
    return out
  },
}
