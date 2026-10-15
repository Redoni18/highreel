// Example recaps for the landing page and /example/[key] (SPEC M2.5 P2).
// Static payloads in the same shape the public recap endpoint returns, made
// up from scratch: fictional businesses, fictional people, illustrated photos
// (public/examples), never real customers. Each starts from one of the
// dashboard's business-type templates (shared/templates/starters.ts): its
// wording and the look it suggests (a design and colourway, SPEC M2.17), plus a
// signed note or photos here and there.

import type { CampaignSettings, RecapPayload } from '#shared/types/recap'
import type { ParsedRow } from '#shared/templates/types'
import { getTemplate } from '#shared/templates'
import { resolveLook } from '#shared/templates/designs'
import type { RecapTheme } from '#shared/utils/color'
import { getStarter, withStarter } from '#shared/templates/starters'
import { toRecapRecipient } from '#shared/utils/recap'

export interface Example {
  key: string
  /** Switcher label */
  label: string
  /** One line under the phone: whose recap this is */
  about: string
  payload: RecapPayload
  /** its look's colour and renderer, for the landing's dots, shapes and phone */
  accent: string
  theme: RecapTheme
}

function example(key: string, label: string, about: string, starterKey: string, business: string, s: Partial<CampaignSettings>, row: ParsedRow): Example {
  const starter = getStarter(starterKey)!
  const template = getTemplate(starter.template)
  const settings = { ...withStarter(template.defaultSettings, starter), ...s }
  const look = resolveLook(settings.look)
  return {
    key,
    label,
    about,
    payload: {
      template_key: template.key,
      year: 2026,
      business: { name: business, logo_url: null, website_url: null },
      settings,
      recipient: toRecapRecipient(template, row, null),
    },
    accent: look.accent,
    theme: look.theme,
  }
}

export const EXAMPLES: Example[] = [
  example('app', 'App', 'Ana\'s year in a habit-tracking app', 'habit-app', 'Habitly', {
    founder_note: 'Thank you for showing up for yourself this year. See you in 2027. — Mira, founder',
  }, {
    first_name: 'Ana',
    member_since: '2024-03-12',
    active_days: 212,
    longest_streak_days: 41,
    sessions: 1486,
    items_created: 1180,
    top_feature: 'Morning routine',
    top_percent: 5,
    personal_note: null,
  }),
  example('newsletter', 'Newsletter', 'Jonas\'s year with a food newsletter', 'newsletter', 'The Weekly Bite', {
    founder_note: 'Thanks for reading every Sunday. Next year: more dumplings. — Lea',
  }, {
    first_name: 'Jonas',
    subscribed_since: '2023-09-04',
    issues_opened: 47,
    links_clicked: 138,
    favorite_issue_title: 'The 10-minute dumpling',
    reading_streak_weeks: 22,
    referrals: 3,
    top_percent: 6,
    personal_note: null,
  }),
  example('shop', 'Online shop', 'Sam\'s year with a coffee roaster, in the Paper theme', 'online-shop', 'Bean & Leaf', {
    founder_note: 'Fourteen orders, every one roasted the week it shipped. Thank you. — The Bean & Leaf roastery',
  }, {
    first_name: 'Sam',
    first_order_date: '2023-06-02',
    orders: 14,
    items_bought: 31,
    favorite_product: 'Ethiopia Guji, light roast',
    favorite_category: 'Single origin',
    amount_saved: 42,
    loyalty_points: 860,
    top_percent: 9,
    personal_note: null,
  }),
  example('studio', 'Fitness studio', 'Dea\'s year at a fitness studio', 'fitness-studio', 'Forma Studio', {}, {
    first_name: 'Dea',
    visit_date: null,
    days: 86,
    activities_done: 112,
    highlight: 'Your first full pull-up',
    badge: 'Early bird',
    personal_note: 'Thanks for all the 7 a.m. classes. See you in January! — Arta, your coach',
  }),
  example('camp', 'Summer camp', 'Elira\'s three days at a summer day camp', 'summer-camp', 'Sunny Hill Camp', {
    photos: [
      { id: 'lake', path: '', caption: 'Morning swim at the lake', width: 1500, height: 1200, url: '/examples/camp-lake.svg' },
      { id: 'evening', path: '', caption: 'Last night around the fire', width: 1200, height: 1500, url: '/examples/camp-evening.svg' },
    ],
  }, {
    first_name: 'Elira',
    visit_date: '2026-07-14',
    days: 3,
    activities_done: 14,
    highlight: 'Swimming across the lake',
    badge: 'Brave swimmer',
    personal_note: 'You were first in the water every morning. Come back next summer!',
  }),
]

export function findExample(key: string): Example | undefined {
  return EXAMPLES.find(e => e.key === key)
}

/** The example's last-slide button leads to the demo (an absolute URL, like a business's own link). */
export function withDemoButton(p: RecapPayload, origin: string): RecapPayload {
  return { ...p, settings: { ...p.settings, cta_label: 'Make one for your customers', cta_url: `${origin}/login?demo=1` } }
}
