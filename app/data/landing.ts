// The landing's words (SPEC M2.11), in one place for the page, its
// structured data and /llms.txt (server/routes/llms.txt.ts), so they never say
// different things. The page adds its own pictures and colours.

export const LANDING_TITLE = 'Highreel · Give every customer their year\'s highlight reel'
export const LANDING_DESCRIPTION = 'Spotify Wrapped for your business: each customer on your sheet gets a Highreel, an animated highlight reel of their year to share. From $99 per campaign.'
export const LANDING_LEDE = 'Spotify Wrapped, for your business. Upload a sheet with one row per customer, and each one gets their own Highreel: an animated highlight reel of their year to tap through and share.'
export const LANDING_AUDIENCE = 'Apps, newsletters, online shops, gyms, studios, camps and daycares. If you know what each customer did this year, they can have a Highreel of it.'

export const STEPS = [
  {
    title: 'Fill in the sheet.',
    body: 'One row per customer: a first name and their numbers for the year. CSV or Excel, with our columns or your own. Anything that needs fixing turns red, and you fix it right in the grid.',
  },
  {
    title: 'Make it look like you.',
    body: 'Add your logo and colour, choose a theme and rewrite any line. Click any customer to see their Highreel change as you type.',
  },
  {
    title: 'Share it with your members.',
    body: 'Publish, and everyone on your list gets a personal link. Send them from your own email address or on WhatsApp; they open their Highreel, save it and share it, and you see who did.',
  },
] as const

// SPEC §10: one price per campaign by list size; $99 is the founding price of the smallest.
export const PRICING_LEAD = 'Not per customer. Upload your list once and everyone on it gets their own Highreel. No subscription.'
export interface Tier {
  /** customers on the list, at most */
  size: string
  price: string
  /** the usual price, crossed out next to a founding price */
  was?: string
  founding?: boolean
}
export const TIERS: Tier[] = [
  { size: '1,000', price: '$99', was: '$199', founding: true },
  { size: '10,000', price: '$399' },
  { size: '50,000', price: '$799' },
]

export const INCLUDES = [
  { title: 'A template for your business', body: 'Apps, newsletters, shops, cafés, gyms, schools, camps and daycares.' },
  { title: 'Your brand on every slide', body: 'Your logo, your colours and your words.' },
  { title: 'Edit after publishing', body: 'Fix a line or a number; the links stay the same.' },
  { title: 'Made to be shared', body: 'A share image and a link preview for every customer.' },
] as const

export const FAQS = [
  {
    q: 'What counts as a campaign?',
    a: 'One send to one list: your sheet of customers, your brand and wording, and a personal Highreel for each person on it. You pay once for the whole list, not per customer. Your 2026 Highreels are one campaign; doing them again for 2027 is another.',
  },
  {
    q: 'Do you email my customers?',
    a: 'Not from us. Connect your own email account and every Highreel goes out from your address, to your list. You can also send them one tap at a time on WhatsApp, or download the links for the email tool you already use.',
  },
  {
    q: 'What data do you need?',
    a: 'One row per customer with the columns of the template you pick: an id, a first name and their numbers, like active days or orders. Your own columns can become slides too. Add an email or a phone number only if you want to send the Highreels from here; they never appear in one.',
  },
  {
    q: 'Can I try it first?',
    a: 'Yes. The demo runs the whole thing with sample data and needs no account: upload, brand, preview, publish and open the links.',
  },
] as const
