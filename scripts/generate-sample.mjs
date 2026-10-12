// Writes the spreadsheet templates businesses fill in, and a sample sheet per
// template for the demo (all businesses made up). Deterministic: the same
// seeds always produce the same files, so screenshots and tests stay stable.
//
//   node scripts/generate-sample.mjs
//   node scripts/generate-sample.mjs --rows 10000 --out /tmp/sample-10000.csv
//
// With --rows, only that many rows of the Habitly (app) sample are written
// (to --out, default public/templates/sample-habitly-<rows>.csv); use it for
// the grid's 10,000-row smoothness check. The planted errors stay put.
//
// The column contracts live in shared/templates/*.ts and SPEC.md §4.
// Keep all three in sync.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'templates')
mkdirSync(outDir, { recursive: true })

// mulberry32: tiny seeded PRNG
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function tools(seed) {
  const rand = rng(seed)
  return {
    rand,
    pick: arr => arr[Math.floor(rand() * arr.length)],
    int: (min, max) => Math.floor(rand() * (max - min + 1)) + min,
  }
}

function csvCell(value) {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}
function toCsv(columns, rows) {
  return [columns.join(','), ...rows.map(r => columns.map(c => csvCell(r[c])).join(','))].join('\n') + '\n'
}
const pad2 = n => String(n).padStart(2, '0')
// WhatsApp numbers (SPEC M2.9): Ofcom's drama range (+44 7700 900000–900999)
// is reserved for fiction, so no real phone gets these. Four in five rows have
// one. Worked out from the row number, not the seeded random numbers, so every
// other value (and the planted errors) stays the same.
const phoneFor = i => (i % 5 === 0 ? '' : `+44 7700 900${String(i % 1000).padStart(3, '0')}`)

// --- app: "Habitly", a habit tracker (200 rows, 5 planted errors) -------------

const APP_COLUMNS = [
  'customer_id', 'first_name', 'email', 'phone', 'member_since', 'active_days', 'longest_streak_days',
  'sessions', 'items_created', 'top_feature', 'top_percent', 'personal_note',
]
const FIRST_NAMES = [
  'Ana', 'Liam', 'Sofia', 'Noah', 'Mia', 'Lucas', 'Emma', 'Arben', 'Lea', 'Mateo',
  'Yuki', 'Amara', 'Jonas', 'Elif', 'Omar', 'Chloe', 'Diego', 'Nora', 'Ravi', 'Zara',
  'Erion', 'Ines', 'Felix', 'Hana', 'Kai', 'Leila', 'Marco', 'Priya', 'Sam', 'Tara',
  'Ilir', 'Maya', 'Oskar', 'Lina', 'Theo', 'Aisha', 'Ben', 'Clara', 'Dev', 'Freya',
]
const FEATURES = ['Morning routine', 'Water tracker', 'Reading goal', 'Workout log', 'Journal', 'Sleep tracker', 'Focus timer']
const NOTES = [
  'Thanks for being one of our first 100 users.',
  'Your bug report in March made the app better for everyone.',
  'See you in 2027!',
]

const app = tools(2026)
function makeAppRow(i) {
  const { rand, pick, int } = app
  const activeDays = int(4, 320)
  const year = pick([2023, 2024, 2025, 2026])
  // Sign-ups this year stop at September so no date lands in the future.
  const month = pad2(int(1, year === 2026 ? 9 : 12))
  const day = pad2(int(1, 28))
  const name = pick(FIRST_NAMES)
  return {
    customer_id: `usr_${String(10000 + i)}`,
    first_name: name,
    email: `${name.toLowerCase()}.${10000 + i}@example.com`,
    phone: phoneFor(i),
    member_since: `${year}-${month}-${day}`,
    active_days: activeDays,
    longest_streak_days: Math.min(activeDays, int(1, Math.max(2, Math.floor(activeDays / 3)))),
    sessions: activeDays * int(1, 4),
    items_created: int(activeDays, activeDays * 6),
    top_feature: pick(FEATURES),
    // Usually blank: the app works out "top X%" from active_days itself.
    top_percent: '',
    personal_note: rand() < 0.06 ? pick(NOTES) : '',
  }
}

const args = process.argv.slice(2)
const flag = name => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
const count = Number(flag('--rows') ?? 200)
if (!Number.isInteger(count) || count < 150) {
  console.error('--rows must be a whole number of at least 150 (the planted errors go up to row 141)')
  process.exit(1)
}

const appRows = Array.from({ length: count }, (_, i) => makeAppRow(i + 1))
// A few deliberate mistakes so the demo can show cell-level validation.
appRows[7].first_name = ''                       // required value missing
appRows[23].active_days = 'about 40'             // not a whole number
appRows[58].customer_id = appRows[57].customer_id // duplicate id
appRows[91].member_since = '31/02/2025'          // not YYYY-MM-DD
appRows[140].top_percent = 140                   // out of range (1-100)

if (flag('--rows')) {
  const out = flag('--out') ?? join(outDir, `sample-habitly-${count}.csv`)
  writeFileSync(out, toCsv(APP_COLUMNS, appRows))
  console.log(`Wrote ${appRows.length} sample rows to ${out}`)
  process.exit(0)
}

writeFileSync(join(outDir, 'sample-habitly-200.csv'), toCsv(APP_COLUMNS, appRows))
writeFileSync(join(outDir, 'highreel-template-app.csv'), toCsv(APP_COLUMNS, [
  { customer_id: 'cus_001', first_name: 'Ana', email: 'ana@example.com', phone: '+44 7700 900001', member_since: '2025-03-14', active_days: 212, longest_streak_days: 41, sessions: 530, items_created: 1180, top_feature: 'Morning routine', top_percent: '', personal_note: 'Thanks for being one of our first users!' },
  { customer_id: 'cus_002', first_name: 'Liam', email: 'liam@example.com', member_since: '2026-01-02', active_days: 37, longest_streak_days: 9, sessions: 61, items_created: 140, top_feature: 'Workout log', top_percent: '', personal_note: '' },
]))

// --- newsletter: "The Weekly Bite", a food newsletter (200 rows, 3 errors) ------

const NEWSLETTER_COLUMNS = [
  'subscriber_id', 'first_name', 'email', 'phone', 'subscribed_since', 'issues_opened', 'links_clicked',
  'favorite_issue_title', 'reading_streak_weeks', 'referrals', 'top_percent', 'personal_note',
]
const ISSUES = ['The 10-minute pasta', 'Bread without a bakery', 'Spices that do the work', 'Soup season', 'One-pan dinners', 'The perfect omelette', 'Cooking for one']
const nl = tools(4711)
const newsletterRows = Array.from({ length: 200 }, (_, n) => {
  const { rand, pick, int } = nl
  const i = n + 1
  const name = pick(FIRST_NAMES)
  const year = pick([2021, 2022, 2023, 2024, 2025, 2026])
  const opened = int(0, 52)
  return {
    subscriber_id: `sub_${20000 + i}`,
    first_name: name,
    email: `${name.toLowerCase()}.${20000 + i}@example.com`,
    phone: phoneFor(i),
    subscribed_since: `${year}-${pad2(int(1, year === 2026 ? 9 : 12))}-${pad2(int(1, 28))}`,
    issues_opened: opened,
    links_clicked: int(0, opened * 3),
    favorite_issue_title: opened > 3 ? pick(ISSUES) : '',
    reading_streak_weeks: Math.min(opened, int(0, 20)),
    referrals: rand() < 0.2 ? int(1, 6) : 0,
    top_percent: '',
    personal_note: rand() < 0.04 ? 'You replied to almost every issue. Thank you!' : '',
  }
})
newsletterRows[4].issues_opened = 'n/a'           // not a whole number
newsletterRows[32].email = 'mia.at.example.com'   // not an email
newsletterRows[76].reading_streak_weeks = 60      // out of range (0-53)
writeFileSync(join(outDir, 'sample-newsletter-200.csv'), toCsv(NEWSLETTER_COLUMNS, newsletterRows))
writeFileSync(join(outDir, 'highreel-template-newsletter.csv'), toCsv(NEWSLETTER_COLUMNS, [
  { subscriber_id: 'sub_001', first_name: 'Ana', email: 'ana@example.com', phone: '+44 7700 900001', subscribed_since: '2024-05-02', issues_opened: 48, links_clicked: 96, favorite_issue_title: 'Soup season', reading_streak_weeks: 19, referrals: 3, top_percent: '', personal_note: '' },
  { subscriber_id: 'sub_002', first_name: 'Liam', email: 'liam@example.com', subscribed_since: '2026-02-11', issues_opened: 12, links_clicked: 4, favorite_issue_title: '', reading_streak_weeks: 4, referrals: 0, top_percent: '', personal_note: '' },
]))

// --- shop: "Bean & Leaf", a coffee and tea shop (200 rows, 3 errors) ------------

const SHOP_COLUMNS = [
  'customer_id', 'first_name', 'email', 'phone', 'first_order_date', 'orders', 'items_bought',
  'favorite_product', 'favorite_category', 'amount_saved', 'loyalty_points', 'top_percent', 'personal_note',
]
const PRODUCTS = ['Kosovo Morning Blend', 'Ethiopia Yirgacheffe', 'House Espresso', 'Mountain Tea', 'Cold Brew Pack', 'Decaf Colombia']
const CATEGORIES = ['Espresso', 'Filter coffee', 'Tea', 'Gear']
const shop = tools(8080)
const shopRows = Array.from({ length: 200 }, (_, n) => {
  const { rand, pick, int } = shop
  const i = n + 1
  const name = pick(FIRST_NAMES)
  const year = pick([2022, 2023, 2024, 2025, 2026])
  const orders = int(1, 30)
  return {
    customer_id: `cus_${30000 + i}`,
    first_name: name,
    email: `${name.toLowerCase()}.${30000 + i}@example.com`,
    phone: phoneFor(i),
    first_order_date: `${year}-${pad2(int(1, year === 2026 ? 9 : 12))}-${pad2(int(1, 28))}`,
    orders,
    items_bought: orders + int(0, orders * 2),
    favorite_product: pick(PRODUCTS),
    favorite_category: pick(CATEGORIES),
    amount_saved: rand() < 0.6 ? int(2, 90) : 0,
    loyalty_points: orders * int(8, 15),
    top_percent: '',
    personal_note: rand() < 0.04 ? 'Thanks for the lovely review in June!' : '',
  }
})
shopRows[11].orders = -3                          // out of range (0-10000)
shopRows[44].first_order_date = '2027-01-01'      // in the future
shopRows[149].customer_id = shopRows[148].customer_id // duplicate id
writeFileSync(join(outDir, 'sample-shop-200.csv'), toCsv(SHOP_COLUMNS, shopRows))
writeFileSync(join(outDir, 'highreel-template-shop.csv'), toCsv(SHOP_COLUMNS, [
  { customer_id: 'cus_001', first_name: 'Ana', email: 'ana@example.com', phone: '+44 7700 900001', first_order_date: '2023-06-10', orders: 14, items_bought: 31, favorite_product: 'House Espresso', favorite_category: 'Espresso', amount_saved: 42, loyalty_points: 180, top_percent: '', personal_note: '' },
  { customer_id: 'cus_002', first_name: 'Liam', email: 'liam@example.com', first_order_date: '2026-03-01', orders: 2, items_bought: 3, favorite_product: 'Mountain Tea', favorite_category: 'Tea', amount_saved: 0, loyalty_points: 20, top_percent: '', personal_note: '' },
]))

// --- visit: "Sunny Hill Camp", a summer day camp for kids (120 rows, 3 errors) ---

const VISIT_COLUMNS = [
  'participant_id', 'first_name', 'email', 'phone', 'visit_date', 'days', 'activities_done', 'highlight', 'badge', 'personal_note',
]
const KIDS = ['Arta', 'Dren', 'Elira', 'Besnik', 'Lira', 'Ardit', 'Era', 'Albin', 'Nora', 'Drin', 'Rina', 'Leon', 'Jona', 'Gent', 'Ema', 'Liam', 'Mia', 'Noah', 'Sara', 'Luka']
const HIGHLIGHTS = ['The treasure hunt', 'Swimming across the lake', 'The climbing wall', 'Campfire songs', 'Building a raft', 'The talent show', 'Painting the camp mural']
const BADGES = ['Brave swimmer', 'Team captain', 'Trail finder', 'Early bird', 'Kind helper', 'Fire keeper']
const STAFF_NOTES = ['You were so brave on the climbing wall!', 'The lake will miss you. Come back soon!', 'Best treasure hunter of the summer.']
const visit = tools(1999)
const visitRows = Array.from({ length: 120 }, (_, n) => {
  const { rand, pick, int } = visit
  const i = n + 1
  const name = pick(KIDS)
  return {
    participant_id: `kid_${String(i).padStart(3, '0')}`,
    first_name: name,
    email: `parent.${name.toLowerCase()}${i}@example.com`,
    phone: phoneFor(i),
    visit_date: `2026-${pad2(int(4, 9))}-${pad2(int(1, 28))}`,
    days: int(1, 5),
    activities_done: int(3, 25),
    highlight: pick(HIGHLIGHTS),
    badge: rand() < 0.75 ? pick(BADGES) : '',
    personal_note: rand() < 0.12 ? pick(STAFF_NOTES) : '',
  }
})
visitRows[8].first_name = ''                      // required value missing
visitRows[39].days = 0                            // out of range (1-366)
visitRows[87].email = 'parent@'                   // not an email
writeFileSync(join(outDir, 'sample-visit-120.csv'), toCsv(VISIT_COLUMNS, visitRows))
writeFileSync(join(outDir, 'highreel-template-visit.csv'), toCsv(VISIT_COLUMNS, [
  { participant_id: 'kid_001', first_name: 'Arta', email: 'parent@example.com', phone: '+44 7700 900001', visit_date: '2026-07-14', days: 2, activities_done: 14, highlight: 'The treasure hunt', badge: 'Brave swimmer', personal_note: 'You were so brave on the climbing wall!' },
  { participant_id: 'kid_002', first_name: 'Dren', email: '', visit_date: '2026-07-14', days: 1, activities_done: 6, highlight: 'Campfire songs', badge: '', personal_note: '' },
]))

// --- custom: "Keepsake", a made-up site where members make digital gifts -------
// (SPEC M2.7: "Your own sheet"). Only member_id and first_name are template
// fields; every other column is the business's own and becomes a slide. It
// reads like a database export: `joined` carries a time, numbers are plain.
// 150 rows, 3 planted errors (rows 6, 31, 102).

const CUSTOM_COLUMNS = [
  'member_id', 'first_name', 'email', 'joined', 'gifts_made', 'people_gifted', 'photos_added', 'times_opened',
  'favorite_occasion', 'favorite_style', 'first_gift', 'maker_badge', 'personal_note',
]
const OCCASIONS = ['Anniversary', 'Birthday', 'Valentine\'s Day', 'Mother\'s Day', 'Wedding', 'Just because']
const STYLES = ['Polaroid envelope', 'Love letter', 'Starry night', 'Photo journey', 'Memory box']
const MAKER_BADGES = ['Memory keeper', 'Storyteller', 'Big romantic', 'Gift giver']
const MAKER_NOTES = ['Your anniversary gift made our whole team smile.', 'Thank you for trusting us with your memories.']
const keep = tools(1402)
const customRows = Array.from({ length: 150 }, (_, n) => {
  const { rand, pick, int } = keep
  const i = n + 1
  const name = pick(FIRST_NAMES)
  const gifts = int(1, 14)
  return {
    member_id: `mem_${String(i).padStart(4, '0')}`,
    first_name: name,
    email: `${name.toLowerCase()}.${i}@example.com`,
    joined: `${int(2024, 2025)}-${pad2(int(1, 12))}-${pad2(int(1, 28))} ${pad2(int(7, 22))}:${pad2(int(0, 59))}:${pad2(int(0, 59))}+00`,
    gifts_made: gifts,
    people_gifted: int(1, gifts),
    photos_added: int(3, 160),
    times_opened: int(gifts, gifts * 9),
    favorite_occasion: pick(OCCASIONS),
    favorite_style: pick(STYLES),
    first_gift: `2026-${pad2(int(1, 9))}-${pad2(int(1, 28))}`,
    maker_badge: rand() < 0.6 ? pick(MAKER_BADGES) : '',
    personal_note: rand() < 0.1 ? pick(MAKER_NOTES) : '',
  }
})
customRows[5].gifts_made = 'three'                // not a number
customRows[30].first_gift = '14/02/2026'          // not YYYY-MM-DD
customRows[101].member_id = customRows[100].member_id // duplicate id
writeFileSync(join(outDir, 'sample-keepsake-150.csv'), toCsv(CUSTOM_COLUMNS, customRows))
// The template shows the idea: the two fields we need, then any columns of your own.
const CUSTOM_TEMPLATE_COLUMNS = ['customer_id', 'first_name', 'email', 'phone', 'visits', 'favourite', 'first_visit', 'personal_note']
writeFileSync(join(outDir, 'highreel-template-custom.csv'), toCsv(CUSTOM_TEMPLATE_COLUMNS, [
  { customer_id: 'c_001', first_name: 'Ana', email: 'ana@example.com', phone: '+44 7700 900001', visits: 24, favourite: 'The Saturday class', first_visit: '2025-03-14', personal_note: 'So glad you found us!' },
  { customer_id: 'c_002', first_name: 'Liam', email: '', visits: 9, favourite: 'Morning yoga', first_visit: '2026-01-08', personal_note: '' },
]))

console.log(`Wrote templates and samples for app, newsletter, shop, visit and custom to ${outDir}`)
