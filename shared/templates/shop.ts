// Template "shop" (SPEC §4.4, M2e). Keep scripts/generate-sample.mjs in sync.
// amount_saved is in whole currency units; the € sits in the slide copy.

import type { Template } from './types'

export const shopTemplate: Template = {
  key: 'shop',
  label: 'Online shops',
  description: 'Orders, items, favourite product and category, money saved.',
  files: { template: '/templates/highreel-template-shop.csv', sample: '/templates/sample-shop-200.csv' },
  columns: [
    { key: 'customer_id', type: 'text', required: true, maxLength: 64, unique: true, rule: 'unique, ≤ 64 chars', usedFor: 'joining links back to your email tool', width: 132 },
    { key: 'first_name', type: 'text', required: true, minLength: 1, maxLength: 30, rule: '1–30 chars', usedFor: 'every slide', width: 132 },
    { key: 'email', type: 'email', required: false, rule: 'valid email', usedFor: 'emailing the highlight reel, and the links file', width: 214 },
    { key: 'phone', type: 'phone', required: false, rule: 'phone number, best with its country code', usedFor: 'WhatsApp only (never on the highlight reel)', width: 150 },
    { key: 'first_order_date', type: 'date', required: false, notFuture: true, rule: 'YYYY-MM-DD, not in the future', usedFor: '"Customer since June 2023"', width: 150 },
    { key: 'orders', type: 'int', required: true, min: 0, max: 10000, rule: '0–10,000', usedFor: 'orders slide, ranking', width: 100 },
    { key: 'items_bought', type: 'int', required: false, min: 0, rule: '≥ 0', usedFor: 'small line on the orders slide', width: 128 },
    { key: 'favorite_product', type: 'text', required: false, maxLength: 60, rule: '≤ 60 chars', usedFor: '"Your favourite: …"', width: 190 },
    { key: 'favorite_category', type: 'text', required: false, maxLength: 40, rule: '≤ 40 chars', usedFor: 'category slide', width: 160 },
    { key: 'amount_saved', type: 'int', required: false, min: 0, rule: 'whole amount, ≥ 0', usedFor: '"You saved €42"', width: 128 },
    { key: 'loyalty_points', type: 'int', required: false, min: 0, rule: '≥ 0', usedFor: 'points slide', width: 128 },
    { key: 'top_percent', type: 'int', required: false, min: 1, max: 100, rule: '1–100, usually blank', usedFor: 'override for the computed rank', width: 124 },
    { key: 'personal_note', type: 'text', required: false, maxLength: 140, rule: '≤ 140 chars', usedFor: 'per-customer note', width: 260 },
  ],
  cover: '{first_name}, your {year} with {business}',
  slides: [
    {
      key: 'orders', label: 'Orders', column: 'orders', kind: 'number', min: 1, scene: 'count',
      copy: 'Orders this year: {orders}',
      small: { column: 'items_bought', copy: '{items_bought} items in total' },
    },
    { key: 'product', label: 'Favourite product', column: 'favorite_product', kind: 'text', scene: 'word', copy: 'Your favourite: {favorite_product}' },
    { key: 'category', label: 'Favourite category', column: 'favorite_category', kind: 'text', scene: 'badge', copy: 'Most loved category: {favorite_category}' },
    { key: 'saved', label: 'Money saved', column: 'amount_saved', kind: 'number', min: 1, scene: 'count', copy: 'You saved €{amount_saved} with us.' },
    { key: 'points', label: 'Loyalty points', column: 'loyalty_points', kind: 'number', min: 1, scene: 'count', copy: 'Points collected: {loyalty_points}' },
    { key: 'top_percent', label: 'Top percent', column: 'top_percent', kind: 'number', max: 25, scene: 'rank', top: true, copy: 'You\'re one of our top {top_percent}% customers.' },
  ],
  noteColumn: 'personal_note',
  since: { column: 'first_order_date', copy: 'Customer since {since}', kicker: 'Customer since', countYears: true },
  rank: { by: 'orders', override: 'top_percent' },
  shareStats: [
    { column: 'orders', label: 'orders', kind: 'number', min: 1 },
    { column: 'items_bought', label: 'items', kind: 'number', min: 1 },
    { column: 'loyalty_points', label: 'points', kind: 'number', min: 1 },
    { column: 'top_percent', label: 'of {business} customers', kind: 'top', max: 25 },
    { column: 'favorite_product', label: 'favourite', kind: 'text' },
  ],
  audience: 'customers',
  totals: [
    { column: 'orders', label: 'orders' },
    { column: 'items_bought', label: 'items sold' },
    { column: 'loyalty_points', label: 'loyalty points collected' },
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
    theme: 'stories',
    guess_first: false,
  },
}
