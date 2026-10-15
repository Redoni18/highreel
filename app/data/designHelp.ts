// What each option in Design does (SPEC M2.16): the words behind its (i)
// popover (InfoTip). Owner, 2026-10-15: every option should say what it does,
// in plain words, so nobody switches one back and forth wondering. Keep them
// true to what the code does: the numbers below come from the code.

import { designs } from '#shared/templates/designs'
import { DEFAULT_TOP, MAX_LIST, MAX_OWN_COLUMNS } from '#shared/templates/own'
import { GUESS_LIMIT, VISIT_DAYS } from '#shared/utils/scenes'
import { MAX_PHOTOS } from '#shared/utils/recap'

export interface Help {
  title: string
  /** paragraphs */
  body: string[]
  /** the choices, each with what it does */
  options?: { name: string, text: string }[]
  /** a last paragraph, after the choices */
  foot?: string
}

const TOPICS = {
  look: {
    title: 'Look',
    body: [
      'How every slide of this Highreel looks: a design, and one of its colors. Each design is its own artwork, with colors made for it, so you pick from those rather than mixing your own.',
      'Your kind of business suggests one when you start; any design works with any kind of business.',
    ],
    options: designs.map(d => ({ name: d.label, text: `${d.description} ${d.colorways.length} colors.` })),
    foot: 'The words, the numbers and your logo stay the same whichever you pick. The phone shows it straight away; Save keeps it.',
  },
  guess: {
    title: 'Guess first',
    body: [
      'Before a number shows, people pick it from three: their real number and two close guesses. Then the slide plays and says whether they were right.',
      `Only the first ${GUESS_LIMIT} number slides ask, so the Highreel doesn't drag. Tapping ahead shows the number without guessing.`,
    ],
  },
  slides: {
    title: 'Slides',
    body: [
      'The slides between the cover and the end, in the order people see them. Each one shows a column of your sheet, a list of a few, or a top %.',
      'Drag ⠿ (or use the arrows) to change the order, and the eye to hide a slide from everyone. A slide only shows to people whose cell passes its rule: nobody gets "0 days in a row". The gray line under each slide is what the person in the preview sees.',
    ],
  },
  end: {
    title: 'Always at the end',
    body: ['Every Highreel ends with these, in this order: your group photos (if you add any), your note, then the last slide with the share card, Save image, Share and your button.'],
  },
  line: {
    title: 'Line',
    body: [
      'The words on this slide. Leave it blank to keep the suggested wording shown in gray.',
      'Words in curly brackets are filled in for each person: {first_name} becomes their first name, and a column\'s name becomes their value from the sheet. Add them with the buttons under the field, so they land where your cursor is.',
    ],
  },
  coverLine: {
    title: 'Line',
    body: [
      'The title on the first slide, the one people see when they open their link. Leave it blank to keep the suggested wording shown in gray.',
      'Words in curly brackets are filled in for each person: {first_name} becomes their first name, {business} your business name, {year} this Highreel\'s year.',
    ],
  },
  itemsLabel: {
    title: 'What it counts',
    body: [
      'The name for what this number counts, like "habits checked off" or "orders". It goes after the number on the slide and on the share card.',
      'Leave it blank and this slide is hidden for everyone.',
    ],
  },
  listColumns: {
    title: 'Columns',
    body: [`Each column is a line on this slide, with its name in front ("Favorite class: Yoga"). People only see the lines they have a value for. Up to ${MAX_LIST} columns.`],
  },
  animation: {
    title: 'Animation',
    body: [
      'How this slide reveals its number or word. Only the ones that fit this column are offered: counting for numbers, lettering for words, pages and stamps for dates, rankings for a top %.',
      'The words and the number stay the same whichever you pick. The phone plays your choice straight away.',
    ],
  },
  tokens: {
    title: 'Tokens',
    body: ['The little pieces that drop and pile up while the number counts.'],
    options: [
      { name: 'Shapes', text: 'Squares and circles mixed, in your colors.' },
      { name: 'Dots', text: 'Round dots only.' },
      { name: 'Hearts', text: 'Hearts, for a gift, a club or a charity.' },
      { name: 'Stars', text: 'Stars, for points, wins or reviews.' },
    ],
    foot: 'Up to 60 fall. For a bigger number each piece stands for a round amount, and the slide says so ("● = 20").',
  },
  calendar: {
    title: 'Calendar',
    body: ['What the calendar under the number shows.'],
    options: [
      { name: 'A year', text: 'Twelve small months of this Highreel\'s year. The days light up one by one as the number counts, so 212 fills a little more than half the year.' },
      { name: 'A short visit', text: `For a stay, a camp or a course: up to 7 days, a tear-off calendar page for each day (dated from the visit date when the sheet has one); up to ${VISIT_DAYS} days, a grid of that many days.` },
    ],
    foot: `Above ${VISIT_DAYS} days, a short visit would be a wall of pages, so the slide shows the year either way. That's why switching changes nothing for someone with a bigger number.`,
  },
  showsFrom: {
    title: 'Shows from',
    body: [
      'The smallest number that gets this slide. Anyone below it skips the slide, so nobody sees a number that\'s nothing to celebrate.',
      'At 0, everyone with a number in this column gets it.',
    ],
  },
  showsTop: {
    title: 'Shows to the top (%)',
    body: [
      `Who gets this slide: the people whose number puts them in the top this-many percent of your sheet. At ${DEFAULT_TOP}, the best quarter of your customers see "You're in the top 8%", and everyone else skips it.`,
      'Ranks are worked out against everyone in the sheet when you publish.',
    ],
  },
  shareName: {
    title: 'Name on the share card',
    body: ['The last slide sums up a few of their numbers on a card made to share. This is the name next to this number there, like "gifts made". Leave it blank to use the column\'s name.'],
  },
  addValue: {
    title: 'A column\'s value',
    body: ['Pick a column of your sheet. Its slide shows each person their own value (a number, a word or a date) with an animation that suits it. Columns that already have a slide aren\'t listed.'],
  },
  addTop: {
    title: 'Top % by a number',
    body: [`Ranks everyone in your sheet by a number column and tells the people near the top where they stand: "You're in the top 8%". It goes to the top ${DEFAULT_TOP}% to start with; change that once it's added.`],
  },
  addList: {
    title: 'A list',
    body: [`Puts a few columns on one slide, a line each with its name, like "Favorite class: Yoga". Good for words that don't need a slide each. Up to ${MAX_LIST} columns.`],
  },
  addColumn: {
    title: 'A new column',
    body: [
      'Adds an empty column to this Highreel\'s sheet, with a slide for it. Fill it in on the Sheet tab, or in the sheet you download and upload again.',
      `Its type decides which animations it can have: numbers count up, words get lettering, dates get calendar pages. Up to ${MAX_OWN_COLUMNS} of your own columns.`,
    ],
  },
  photos: {
    title: 'Group photos',
    body: [
      `Photos of your team, your place or your customers together. Everyone gets the same photos, a slide each, after their numbers and before your note. Up to ${MAX_PHOTOS}, and they save as soon as you add them.`,
      'Only add photos you\'re allowed to share with everyone who gets this Highreel.',
    ],
  },
  shareImage: {
    title: 'The first photo on the share image',
    body: ['The share image is the picture people save and post publicly. With this on, your first photo goes at its top. It\'s off to start with because group photos can show other people, children at a camp for example, and that image goes public.'],
  },
  note: {
    title: 'Your note',
    body: ['A short message from you near the end, the same for everyone, like the line you\'d write in a card. Leave it blank for no note.'],
  },
  button: {
    title: 'Last slide',
    body: [
      'The last slide always has the share card, Save image and Share. Your own button can go under them: invite a friend, renew, book the next visit.',
      'The label is what the button says; the link is where it goes (a full address, starting https://). Leave the label blank for no button.',
    ],
  },
} satisfies Record<string, Help>

export type HelpKey = keyof typeof TOPICS
export const HELP: Record<HelpKey, Help> = TOPICS
