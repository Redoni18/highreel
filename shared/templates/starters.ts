// Business-type templates (2026-10-11): ready-made starting points on top of
// the four sheet templates. Each one picks a sheet template and fills in what
// a business of that kind would write (the count label, slide wording, the
// closing note and button) plus a suggested colour and theme. Picked when
// creating a recap (New recap) and any time in the Brand panel. The landing's
// example recaps are built from this same list (app/data/examples.ts), so
// what visitors tap through is what they can start from.
// Copy keys must be the sheet template's slide keys or "cover" (tests check).

import type { CampaignSettings } from '../types/recap'

export interface Starter {
  key: string
  /** "Gym or fitness studio" */
  label: string
  /** One line: what the recap shows */
  description: string
  /** The sheet template it fills in */
  template: string
  accent: string
  theme: CampaignSettings['theme']
  settings: Pick<CampaignSettings, 'items_label' | 'founder_note' | 'cta_label' | 'copy'>
}

export const starters: Starter[] = [
  {
    key: 'habit-app',
    label: 'Habit or fitness app',
    description: 'Active days, longest streak, habits checked off, favourite routine.',
    template: 'app',
    accent: '#4F46E5',
    theme: 'stories',
    settings: {
      items_label: 'habits checked off',
      founder_note: 'Thank you for showing up for yourself this year. See you next year!',
      cta_label: 'Invite a friend',
      copy: {},
    },
  },
  {
    key: 'saas-tool',
    label: 'Software tool',
    description: 'Days at work, streaks, things made, most-used feature.',
    template: 'app',
    accent: '#0F766E',
    theme: 'paper',
    settings: {
      items_label: 'invoices sent',
      founder_note: 'Thanks for running your business with us this year.',
      cta_label: 'See what\'s new',
      copy: {
        active_days: 'You got work done on {active_days} days.',
        top_feature: 'Your most-used feature: {top_feature}',
      },
    },
  },
  {
    key: 'learning-app',
    label: 'Learning app or course',
    description: 'Days learning, streak, lessons finished, favourite course.',
    template: 'app',
    accent: '#7C3AED',
    theme: 'stories',
    settings: {
      items_label: 'lessons finished',
      founder_note: 'Every lesson counts. We\'re proud of you.',
      cta_label: 'Keep learning',
      copy: {
        active_days: 'You learned something on {active_days} days.',
        top_feature: 'Your favourite course: {top_feature}',
      },
    },
  },
  {
    key: 'newsletter',
    label: 'Newsletter',
    description: 'Issues opened, reading streak, favourite issue, friends referred.',
    template: 'newsletter',
    accent: '#C8341B',
    theme: 'stories',
    settings: {
      items_label: '',
      founder_note: 'Thanks for reading every week. More good things next year.',
      cta_label: 'Forward it to a friend',
      copy: {},
    },
  },
  {
    key: 'online-shop',
    label: 'Online shop',
    description: 'Orders, favourite product and category, money saved, points.',
    template: 'shop',
    accent: '#1F6F4A',
    theme: 'paper',
    settings: {
      items_label: '',
      founder_note: 'Thank you for shopping with us this year.',
      cta_label: 'Shop the new collection',
      copy: {},
    },
  },
  {
    key: 'cafe',
    label: 'Café, bakery or restaurant',
    description: 'Visits, your usual, favourite category, money saved with the card.',
    template: 'shop',
    accent: '#9A3412',
    theme: 'stories',
    settings: {
      items_label: '',
      founder_note: 'Thanks for making us part of your mornings.',
      cta_label: 'See this week\'s specials',
      copy: {
        orders: 'You came by {orders} times this year.',
        product: 'Your usual: {favorite_product}',
        category: 'Your go-to: {favorite_category}',
        saved: 'You saved €{amount_saved} with your card.',
      },
    },
  },
  {
    key: 'fitness-studio',
    label: 'Gym or fitness studio',
    description: 'Days in, classes taken, best moment, a badge.',
    template: 'visit',
    accent: '#E2457A',
    theme: 'stories',
    settings: {
      items_label: 'classes taken',
      founder_note: 'Thanks for every early class. See you in January!',
      cta_label: 'Book your next class',
      copy: { cover: '{first_name}, your {year} at {business}' },
    },
  },
  {
    key: 'summer-camp',
    label: 'Summer camp',
    description: 'Days at camp, activities tried, best moment, a badge, group photos.',
    template: 'visit',
    accent: '#F5C518',
    theme: 'stories',
    settings: {
      items_label: 'activities tried',
      founder_note: 'You were a star this summer. Come back next year!',
      cta_label: 'Join us next summer',
      copy: {},
    },
  },
  {
    key: 'daycare',
    label: 'Daycare or kindergarten',
    description: 'Days with us, drawings made, favourite moment, a superpower, group photos.',
    template: 'visit',
    accent: '#0EA5E9',
    theme: 'stories',
    settings: {
      items_label: 'drawings made',
      founder_note: 'It was a joy to watch you grow this year.',
      cta_label: '',
      copy: {
        cover: '{first_name}, your year at {business}',
        days: 'Days with us: {days}',
        highlight: 'Favourite moment: {highlight}',
        badge: 'Your superpower: {badge}',
      },
    },
  },
  {
    key: 'lessons',
    label: 'Dance, music or art school',
    description: 'Days in class, lessons, best moment, a badge.',
    template: 'visit',
    accent: '#8F66F6',
    theme: 'stories',
    settings: {
      items_label: 'lessons',
      founder_note: 'Thank you for a wonderful year of lessons.',
      cta_label: 'Sign up for next term',
      copy: {
        cover: '{first_name}, your {year} at {business}',
        days: 'Days in class: {days}',
      },
    },
  },
  {
    // SPEC M2.7: any columns; each one the business adds becomes a slide it designs.
    key: 'own-sheet',
    label: 'Your own sheet',
    description: 'Bring any columns. Pick which become slides and how each one moves.',
    template: 'custom',
    accent: '#4F46E5',
    theme: 'stories',
    settings: {
      items_label: '',
      founder_note: 'Thank you for being part of our year.',
      cta_label: '',
      copy: {},
    },
  },
]

export function getStarter(key: string | null | undefined): Starter | undefined {
  return key ? starters.find(s => s.key === key) : undefined
}

/** The business types that fill in a given sheet template. */
export function startersFor(templateKey: string): Starter[] {
  return starters.filter(s => s.template === templateKey)
}

/** A campaign's settings with a starter's wording and theme (photos and the rest kept). */
export function withStarter(base: CampaignSettings, s: Starter): CampaignSettings {
  return {
    ...base,
    items_label: s.settings.items_label,
    founder_note: s.settings.founder_note,
    cta_label: s.settings.cta_label,
    copy: { ...s.settings.copy },
    theme: s.theme,
  }
}
