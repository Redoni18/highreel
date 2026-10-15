// Template "newsletter" (SPEC §4.4, M2e). Keep scripts/generate-sample.mjs in sync.

import { DEFAULT_LOOK } from './designs'
import type { Template } from './types'

export const newsletterTemplate: Template = {
  key: 'newsletter',
  label: 'Newsletters',
  description: 'Issues opened, reading streak, favorite issue, referrals.',
  files: { template: '/templates/highreel-template-newsletter.csv', sample: '/templates/sample-newsletter-200.csv' },
  columns: [
    { key: 'subscriber_id', type: 'text', required: true, maxLength: 64, unique: true, rule: 'unique, ≤ 64 chars', usedFor: 'joining links back to your email tool', width: 132 },
    { key: 'first_name', type: 'text', required: true, minLength: 1, maxLength: 30, rule: '1–30 chars', usedFor: 'every slide', width: 132 },
    { key: 'email', type: 'email', required: false, rule: 'valid email', usedFor: 'emailing the Highreel, and the links file', width: 214 },
    { key: 'phone', type: 'phone', required: false, rule: 'phone number, best with its country code', usedFor: 'WhatsApp only (never on the Highreel)', width: 150 },
    { key: 'subscribed_since', type: 'date', required: false, notFuture: true, rule: 'YYYY-MM-DD, not in the future', usedFor: '"Reading since May 2024"', width: 150 },
    { key: 'issues_opened', type: 'int', required: true, min: 0, max: 1000, rule: '0–1000', usedFor: 'issues slide, ranking', width: 132 },
    { key: 'links_clicked', type: 'int', required: false, min: 0, rule: '≥ 0', usedFor: 'small line on the issues slide', width: 128 },
    { key: 'favorite_issue_title', type: 'text', required: false, maxLength: 80, rule: '≤ 80 chars', usedFor: '"Your favorite issue: …"', width: 220 },
    { key: 'reading_streak_weeks', type: 'int', required: false, min: 0, max: 53, rule: '0–53', usedFor: 'streak slide', width: 180 },
    { key: 'referrals', type: 'int', required: false, min: 0, rule: '≥ 0', usedFor: 'referrals slide', width: 108 },
    { key: 'top_percent', type: 'int', required: false, min: 1, max: 100, rule: '1–100, usually blank', usedFor: 'override for the computed rank', width: 124 },
    { key: 'personal_note', type: 'text', required: false, maxLength: 140, rule: '≤ 140 chars', usedFor: 'per-reader note', width: 260 },
  ],
  cover: '{first_name}, your {year} with {business}',
  slides: [
    {
      key: 'issues', label: 'Issues opened', column: 'issues_opened', kind: 'number', scene: 'count',
      copy: 'You opened {issues_opened} issues this year.',
      small: { column: 'links_clicked', copy: '{links_clicked} links clicked' },
    },
    { key: 'streak', label: 'Reading streak', column: 'reading_streak_weeks', kind: 'number', min: 2, scene: 'streak', copy: 'You read {reading_streak_weeks} weeks in a row.' },
    { key: 'favorite', label: 'Favorite issue', column: 'favorite_issue_title', kind: 'text', scene: 'word', copy: 'Your favorite issue: {favorite_issue_title}' },
    { key: 'referrals', label: 'Referrals', column: 'referrals', kind: 'number', min: 1, scene: 'count', copy: 'Friends you brought along: {referrals}' },
    { key: 'top_percent', label: 'Top percent', column: 'top_percent', kind: 'number', max: 25, scene: 'rank', top: true, copy: 'You\'re among the top {top_percent}% of {business} readers.' },
  ],
  noteColumn: 'personal_note',
  since: { column: 'subscribed_since', copy: 'Reading since {since}', kicker: 'Reading since', countYears: true },
  rank: { by: 'issues_opened', override: 'top_percent' },
  shareStats: [
    { column: 'issues_opened', label: 'issues opened', kind: 'number' },
    { column: 'reading_streak_weeks', label: 'week streak', kind: 'number', min: 2 },
    { column: 'referrals', label: 'friends referred', kind: 'number', min: 1 },
    { column: 'top_percent', label: 'of {business} readers', kind: 'top', max: 25 },
    { column: 'favorite_issue_title', label: 'favorite issue', kind: 'text' },
  ],
  audience: 'readers',
  totals: [
    { column: 'issues_opened', label: 'issues opened' },
    { column: 'links_clicked', label: 'links clicked' },
    { column: 'referrals', label: 'new readers from referrals' },
  ],
  defaultSettings: {
    items_label: '',
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
