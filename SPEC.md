# Highreel — spec

*Named **Highreel** on 2026-10-12 (domain highreel.app, bought for one year on Cloudflare); "Recap" was the working name, and "recap" stays the word for what each customer gets. Written 2026-10-11. This is the source of truth for building the product: start every session by reading it, and update §12 (Status) before ending one.*

---

## 1. The product in one paragraph

A small business (a SaaS or app, a newsletter, an online shop) fills in our spreadsheet template with one row per customer and that customer's stats for the year. It uploads the sheet. Every customer gets their own animated recap page, "Ana, your 2026 with Habitly": a few full-screen story slides with their numbers, and at the end a share image and the business's call to action. The business sends each customer their link through its own email tool. When customers share their recap, the business gets free reach, and every recap carries a small "Made with Highreel" link back to us.

Spotify Wrapped for any small business: one recap **per customer**, not one video about the business.

**Example.** Habitly, a habit tracker with 3,000 users, uploads a CSV. User Ana opens her link on her phone and taps through: 212 active days → longest streak 41 days → 1,180 habits checked off → favourite: Morning routine → top 5% of Habitly users → a thank-you note from the founder → a share card and an "Invite a friend" button.

## 2. Why this, and when to stop

- **The gap.** Per-customer recaps are sold only to big brands: Storyly (needs its SDK in the app, 400+ companies such as Rossmann and GetYourGuide) and Idomoo (sales-led; Orangetheory). One gym platform (PushPress) built it into its own product, and Senja made one for its own users. Research on 2026-10-11 found no self-serve version for small businesses and no Shopify app for it.
- **The demand signal.** Spotify Wrapped 2025 got 500M+ shares on day one. Last December many small companies posted a company-level "2025 Wrapped" on X; per-customer versions need engineering time they don't have.
- **The moat (honest).** The code can be copied. What builds up: the "Made with" link on every recap seen by thousands of each business's customers, being the known name for this, and the templates and integrations library.
- **Season.** Recaps go out in the first two weeks of December, so businesses decide in November. Milestone recaps ("1 year with us", "your 100th order") are the year-round extension (M4).
- **Go/no-go.** Start outreach by about 2026-11-01 (50–100 founders of small SaaS, apps and newsletters on X, LinkedIn and Indie Hackers). **If fewer than 3 businesses pay by 2026-11-20, stop.**

## 3. Users and the core flow

| Who | What they do |
|---|---|
| **Business owner** (buyer) | Downloads the template, fills it from their own database or analytics export, uploads it, fixes flagged cells, sets brand (name, logo, accent colour) and copy, previews any customer's recap, publishes, exports the links CSV, sends it with their email tool. |
| **Recipient** (the business's customer) | Opens their link on a phone, taps through the slides, saves or shares the image, maybe clicks the business's call to action. |

Flow: **template → upload → grid (fix errors, preview rows) → brand & copy → publish → export links → (business emails them) → recipients view & share.**

~~We do **not** send emails ourselves (no deliverability work, no consent questions). The export is a mail-merge CSV.~~ Changed 2026-10-12 (M2.8, owner's pick): Recap sends each person their recap by email with one button; the links CSV stays for people without an email and for businesses that prefer their own tool.

## 4. The spreadsheet template (the contract)

The template drives everything: grid columns, validation, and which slides appear. Define templates in code once (`shared/templates/<key>.ts`) and import them on both client and server.

### 4.1 Template `app` (SaaS and apps) — M1

File for businesses: `public/templates/highreel-template-app.csv` (headers plus two example rows). Demo data: `public/templates/sample-habitly-200.csv` (200 rows, fictional habit tracker, with 5 planted errors). Both are written by `scripts/generate-sample.mjs` (`corepack pnpm sample`). Keep that script and this table in sync.

| Column | Type | Required | Rule | Used for |
|---|---|---|---|---|
| `customer_id` | text | yes | unique within the sheet, ≤ 64 chars | joining the export back to their email tool |
| `first_name` | text | yes | 1–30 chars | every slide |
| `email` | text | no | valid email if present | recap emails (M2.8) and the links file |
| `phone` | phone | no | 6–15 digits, + or 00 allowed (M2.9) | WhatsApp only; never on the recap |
| `member_since` | date `YYYY-MM-DD` | no | real date, not in the future | "With us since March 2025" |
| `active_days` | whole number | yes | 0–366 | "You showed up on 212 days"; ranking |
| `longest_streak_days` | whole number | no | 0–366, ≤ `active_days` (warning, not error) | streak slide |
| `sessions` | whole number | no | ≥ 0 | optional line on the active-days slide |
| `items_created` | whole number | no | ≥ 0 | volume slide; its label is set per campaign ("habits checked off", "invoices sent") |
| `top_feature` | text | no | ≤ 40 chars | "Your go-to: Morning routine" |
| `top_percent` | whole number | no | 1–100 | override; normally blank and computed (§4.3) |
| `personal_note` | text | no | ≤ 140 chars | per-customer note; else the campaign-wide founder note |

### 4.2 Validation behaviour

- Parse in the browser (PapaParse, `header: true`, trim cells). Header check first: missing **required** columns block the import with a list of what's missing; unknown columns are ignored with a notice.
- Validate per cell. Errors are stored per row as `{ column: message }`. Rows with errors are kept and shown (red cells) but are skipped at publish.
- Duplicate `customer_id`: every row after the first with that id gets the error.
- Messages are short and plain: "Needs a whole number", "Use YYYY-MM-DD", "Already used in row 58", "Must be 1–100".
- Same validators run on the server on import, on every cell edit, and at publish.

### 4.3 Derived values

- **Top percent:** among valid rows, rank by `active_days` (desc); `top_percent = ceil(rank / count * 100)`. Ties share a rank (1 + rows strictly ahead). A filled-in `top_percent` overrides it. The rank slide only shows when the value is **≤ 25** (only flattering ranks). Stored at publish as `data.computed_top_percent`; publishing again refreshes every rank. The preview computes it live.
- **Years with us:** from `member_since`.

### 4.4 More templates (built in M2e)

Same mechanics as `app`: defined as data in `shared/templates/<key>.ts` (columns, slides with their default copy and show rules, cover, note and "since" columns, rank column, share stats), with a template CSV and a sample written by `scripts/generate-sample.mjs`. Every column below also allows `email` (optional: recap emails and the links file), `phone` (optional, since M2.9: WhatsApp only, type `phone`, as typed minus spaces and punctuation, 6–15 digits with an optional + or 00) and `personal_note` (≤ 140). Neither email nor phone ever reaches a recap. Ranking (`top_percent`, an optional 1–100 override column) works like §4.3 on the named rank column.

| Template | Id column | Required | Other columns | Rank by | Sample (planted errors) |
|---|---|---|---|---|---|
| `newsletter` | `subscriber_id` | `first_name`, `issues_opened` (0–1000) | `subscribed_since` (date), `links_clicked`, `favorite_issue_title` (≤ 80), `reading_streak_weeks` (0–53), `referrals` | `issues_opened` | "The Weekly Bite", 200 rows (rows 5, 33, 77) |
| `shop` | `customer_id` | `first_name`, `orders` (0–10,000) | `first_order_date`, `items_bought`, `favorite_product` (≤ 60), `favorite_category` (≤ 40), `amount_saved` (whole €), `loyalty_points` | `orders` | "Bean & Leaf", 200 rows (rows 12, 45, 150) |
| `visit` | `participant_id` | `first_name` | `visit_date`, `days` (1–366), `activities_done` (0–1000, label per campaign, e.g. "classes taken", "activities tried"), `highlight` (≤ 60), `badge` (≤ 40) | none | "Sunny Hill Camp" (a summer day camp), 120 rows (rows 9, 40, 88) |

`visit` is for camps, daycares, gyms, studios and clubs. With kids' places the recipients are usually parents and the recap speaks to the child: cover "{first_name}, your days at {business}", slides "Days at {business}: 2", "Activities tried: 14", "Best moment: …", "You earned: …", the team's note with "Your visit: July 2026", then the group photos (M2c), and a share card titled "{first_name}'s days at {business}" with the lead "What a time, {first_name}!" (was "What a visit", changed 2026-10-11 so it also fits a gym member with 86 days).

Copy rules: the `{column}` placeholder of a slide is shown big; symbols right before it stick to it ("€{amount_saved}" → big "€42"); a line is capitalised ("{items_label}: {activities_done}" → "Animals fed: 14"). Businesses can override the cover and every slide line per campaign.

`.xlsx` import and column mapping are M2f. Since M2.7 a recap can add its own columns and slides on top of any template, and the `custom` template ("Your own sheet") starts with only an id and a first name (see M2.7).

### 4.6 Business-type templates (2026-10-12)

The four sheet templates are the columns; on top of them sit ten **business-type templates** ("starters", `shared/templates/starters.ts`), each a sheet template plus what that kind of business would write: the count label, slide wording (`copy`), the closing note, the button label, a suggested colour and theme.

| Template | Sheet | Colour · theme |
|---|---|---|
| Habit or fitness app | `app` | #4F46E5 · Stories |
| Software tool | `app` | #0F766E · Paper |
| Learning app or course | `app` | #7C3AED · Stories |
| Newsletter | `newsletter` | #C8341B · Stories |
| Online shop | `shop` | #1F6F4A · Paper |
| Café, bakery or restaurant | `shop` | #9A3412 · Stories |
| Gym or fitness studio | `visit` | #E2457A · Stories |
| Summer camp | `visit` | #F5C518 · Stories |
| Daycare or kindergarten | `visit` | #0EA5E9 · Stories |
| Dance, music or art school | `visit` | #8F66F6 · Stories |
| Your own sheet (M2.7) | `custom` | #4F46E5 · Stories |

- **New recap** shows them as a gallery (a tiny cover in each one's colour, `TemplateSwatch`) instead of the old dropdown of four sheet templates. `POST /api/campaigns { starter }` takes the sheet from the template, starts the settings with its wording and theme (`withStarter`), and, while the business still has the default colour (`DEFAULT_ACCENT` #4F46E5), sets the business colour to the template's. A business that picked its own colour keeps it.
- ~~**Brand panel** starts with a "Template" section:~~ (removed from Design in M2.8: the template is picked in New recap) the templates for this recap's sheet (other kinds need other columns, so a new recap). Picking one fills colour, theme, count label, note, button label and copy into the draft; the preview shows it at once and Save keeps it, like any other Brand edit. The one matching the draft is marked.
- The landing's example recaps are built from the same list (`app/data/examples.ts`), so what visitors tap through is what they can start from. Tests: `tests/starters.test.ts` (copy keys exist in the sheet template, placeholders are known, a count label where the sheet has one) and `tests/e2e/templates.mjs`.

### 4.5 Template `business` (M2.5 P4): the business's own recap

Not a sheet: one recap about the business itself, filled in with a form (`kind: 'business'` in the template, `campaigns.kind = 'business'`, exactly one recipient row with `customer_id = 'business'`). Columns: `stat_1`…`stat_4` (whole numbers ≥ 0) with `stat_N_label` (≤ 40; the first pair is required, and a number needs its label and the other way round: `Template.check`, which blocks like a cell error), `highlight` (≤ 80), `milestone_1`…`milestone_3` (≤ 80; "March: opened our second location" shows "March" as a label). The thank-you note is the campaign note (`founder_note`, default "Thank you for being part of our year. See you in the next one!") and the photos are the campaign photos. Cover "Our {year} at {business}"; share title the same, lead "Thank you for an amazing {year}.", link-preview text "A look back at {business}'s {year}." Slides: one count slide per number ("1,240" / "kids visited"), the highlight (word), the milestones (timeline), photos, the note, the share card with the numbers.

Customer templates carry `audience` and `totals` (column + label for followers, e.g. app: `items_created` → "{items_label}", visit: `activities_done` → "{items_label}") so the business form can suggest "195 customers got a recap" and "1,180 habits checked off" from the same year's published rows (`campaign_sums`, §7.4).

## 5. The recap (recipient side)

Route: `/r/[token]`. Mobile-first, full-screen, `noindex`, no third-party trackers (first-party counters only, §7.5). Only first name and stats are shown. Never the email.

### 5.1 Slides for template `app` ("Stories" theme)

| # | Slide | Shown when |
|---|---|---|
| 1 | Cover: logo, "{first_name}, your {year} with {business}" on the accent colour | always |
| 2 | "You showed up on **{active_days}** days." (+ "{sessions} sessions" small) | always |
| 3 | "Longest streak: **{longest_streak_days}** days in a row." | value ≥ 3 |
| 4 | "**{items_created}** {items_label}." | value > 0 and a label is set |
| 5 | "Your go-to: **{top_feature}**" | value present |
| 6 | "You're in the **top {top_percent}%** of {business} users." | value ≤ 25 |
| 7 | Note: `personal_note`, else the campaign founder note, plus "With us since {Month YYYY}" | a note or a date exists |
| 8 | Share: summary card, **Save image**, **Share** (Web Share API where it really works), the business CTA button, "Made with Highreel" link | always |

Copy for slides 2–6 is per-campaign editable with `{placeholders}`; the defaults are above.

Since M2.5 P1 each slide plays a **scene** (`SlideDef.scene` in the template, default by kind): app = days (year calendar) · streak · count · word · rank, then note, share. Newsletter: count · streak · word · count · rank. Shop: count · word · badge · count · count · rank. Visit: days (one page per visit day) · count · word · badge, photos as polaroids. Business (P4): count × up to 4 · word · timeline (a line draws down, milestones land on it; `SlideDef.list` names its columns). Scene code lives in `app/components/recap/scenes/`, its maths in `shared/utils/scenes.ts`. Since M2.7 the scenes are a library: Design lets any slide pick one that fits its data (number: count, days, streak; text: word, badge; date: the new calendar page), with options (count tokens, calendar span) and its show rule, and a recap can add slides for any column.

### 5.2 Player behaviour

Instagram-stories mechanics: segmented progress bar on top; tap right half → next, left half → back; press-and-hold pauses (and freezes the scene); auto-advance after the scene's duration, 5–7 s (cover 5 s; the share slide doesn't auto-advance); arrow keys and space on desktop; desktop shows the 9:16 frame centred (since M2.8 on a moving backdrop in the business's colours, with ‹ › beside it and a pause / play pill under it; pause freezes the scene like a hold, K or P toggles it, moving on plays again). Numbers count up when a slide enters. Slides enter with their scene's transition (wipe, push, zoom, colour flood, rise); going back crossfades; Paper only wipes. Respect `prefers-reduced-motion` (every scene shows its end state, instant transitions). CSS keyframes and Vue transitions; no animation library (decided in M2.5 P1).

### 5.3 Brand

Business name, accent colour, logo (PNG in Storage since M2c; without one, the initial letter; since 2026-10-12 it fills a circle or a rounded square, `businesses.logo_shape`, picked on Your brand, with no white frame, on slides, the share image and the link preview), website URL, CTA label + URL, theme (**Stories**: bold accent colours and soft circles; **Paper** since M2h: warm paper background, ink text, accent only for highlights and thin bars, numbers in Google Sans Code). Text colour on the accent is picked automatically (black or white, whichever passes WCAG AA contrast). Campaign-wide group photos (M2c) become photo slides.

### 5.4 Share image

1080×1920 PNG drawn client-side on a `<canvas>` (wait for `document.fonts.ready`): accent background, "{first_name}'s {year} with {business}", 3–4 headline stats, small "Made with Highreel" footer. **Save image** downloads it. **Share** uses `navigator.share({ files })` only where `navigator.canShare` confirms files; otherwise fall back to save. (Forevermore lesson: Brave advertises file sharing and never opens a sheet, so test it and offer save as the reliable path.)

The share wording comes from the template (`share.lead`, `share.title`; `visit` says "{first_name}'s days at {business}"). With "first photo on the share image" on, the photo fills the top and the stats sit in two columns below.

Link previews: `GET /api/r/:token/og.png`, 1200×630, server-rendered (M2g). Logos are stored as PNG because the renderer (resvg WebAssembly) can't decode WebP.

## 6. The workspace (business side)

Routes since M2.5 P3: `/app` is the business home ("Your year", §8 M2.5 P3), `/app/c/[id]` a campaign's workspace (old `/app?c=…` links redirect). A business recap (P4) opens at the same route with its form in place of the grid.

*Since M2.6 (2026-10-12) a recap has three tabs, Sheet · Design · Share, and the brand basics live on Your brand; the Brand panel and the top bar's Brand/Upload buttons below are history. See M2.6 for the current structure.*

**Decision:** an Airtable-style grid is the product, not a dashboard. The thing the owner works with *is* a spreadsheet, so show as many rows as fit, edit in place, and put the live recap preview next to it. No cards, no charts, no stat tiles, no sidebar navigation.

### 6.1 Layout (route `/app/c/[id]`)

```
┌ top bar 44px ──────────────────────────────────────────────────────────────┐
│ Habitly / 2026 recap ▾    200 rows · 195 ready · 5 need fixing   Brand  Upload  Publish  ⋯ │
├────────────────────────────────────────────────────────┬───────────────────┤
│ # ● first_name  customer_id  active_days  streak  …    │  ┌─────────────┐  │
│ 1 ● Kai         usr_10001          148      11         │  │  phone 9:16 │  │
│ 2 ● Arben       usr_10002          200      27         │  │  preview of │  │
│ 3 ● Clara       usr_10003           91       9         │  │  selected   │  │
│ … 32px rows, virtual scroll, sticky header + first cols│  │  row        │  │
├────────────────────────────────────────────────────────┤  └─────────────┘  │
│ search · filter: All | Needs fixing | Ready | Published│  ◀ slide 3/8 ▶    │
└────────────────────────────────────────────────────────┴───────────────────┘
```

- **Top bar:** home link, business / campaign name (inline-editable), counts (clicking "need fixing" filters to those rows), **Brand** (opens a panel docked on the right, not an overlay sheet, so the preview beside it shows unsaved edits live), **Upload**, **Publish** ("Publish N new" after the first publish), overflow menu (download template, export links CSV, dark mode, reset demo).
- **Grid** (left, flexible) and **preview** (right, 380 px default, resizable, toggle with `P`).
- **Bottom bar:** search across text columns; filter segmented control.

### 6.2 Grid behaviour

- TanStack Vue Table (headless) + TanStack Virtual; must stay smooth at 10,000 rows.
- 32 px rows, 13 px text, 1 px borders, header row with a type icon (Aa text, # number, calendar date) and the column name.
- Sticky: row number, status dot (grey draft, red needs fixing, green ready, filled green published), `first_name`.
- Numbers right-aligned, mono font, `tabular-nums`.
- Invalid cell: faint red background + red bottom border + tooltip with the message.
- Active cell with a ring; arrow keys move; **Enter** or double-click edits in place; **Enter** saves (PATCH → revalidate row); **Esc** cancels; **Cmd/Ctrl+F** focuses search.
- Click a row → preview shows that customer. Column widths resizable. No pagination.
- After publish: a **Link** column (short URL + copy button) and, later, **Viewed / Shared** columns.

### 6.3 States

- **Empty:** centred, three actions: **Download template**, **Upload CSV** (drag-and-drop anywhere on the page works too), **Use sample data**. Under them, the §4.1 column table, compact.
- **Uploading:** progress line in the top bar; then a toast "200 rows imported · 5 need fixing".
- **Publish dialog:** "Publish 195 recaps? 5 rows need fixing and will be skipped." → tokens assigned → Link column appears → toast with **Export links CSV**.
- Editing a published row keeps its token; the recap updates in place.

### 6.4 Visual rules

Changed 2026-10-11 at the owner's ask: past the landing the app "looked very industrial", so sign-in, the home and the workspace now share the landing's design language, without its stickers and illustrations. The grid stays dense.

- **Type:** Outfit for the whole app UI (set on `body.app-ui` by `layouts/default.vue`, so dialogs, menus and toasts get it too); Google Sans Code for column names, ids and numbers in tables; the landing's handwritten Caveat subset (`.note-hand`, 22 px and up) for a few asides only ("your 2026", "no sheet yet? try ours"). Recaps keep Geist: `RecapPlayer` sets it, so the preview matches the public page.
- **Colour** (`app/assets/css/main.css`): the landing's ink `#222222`, greys (`#6F6F6F` text, `#F2F2F2` surfaces, `#E7E7E7` lines) and its blue `#4560FF` as `--primary` (buttons, focus ring, active cell, selected row tint, the "did" icons). Status green `--ok` `#00A372` (text `--ok-text` `#00744F`), errors `#D2371F`. The shape palette (`--shape-green`, `--shape-marigold`, `--shape-poppy`, `--shape-blue`, `--shape-violet`) appears only as small accents: the two shape icons in the home's first-run choices and the attention dot. The preview panel's stage takes a 10 % tint of the business's accent (live while editing the brand).
- **Shapes:** pill buttons, inputs and tabs; 12–14 px radius on fields and menus; 24 px on dialogs and cards; the landing's springy press (`scale(0.97)`). Section titles in sentence case, not small caps. The top bar's home link is the "recap" wordmark.
- No gradients; shadows only on popovers, dialogs and the preview phone. Light by default, dark mode supported.
- Dense: everything fits at 1280×800 with ≥ 20 rows visible (demo banner 36 px, top bar 44, bottom bar 44).

## 7. Architecture

### 7.1 Stack (verified 2026-10-11)

- Nuxt **4.6.1** (`app/` directory), Vue 3.5, TypeScript strict.
- shadcn-vue via `shadcn-nuxt` **2.8.2** (style `reka-vega`, components in `app/components/ui`, reka-ui 2.11). Installed: button, badge, input, tooltip, separator, dialog, sheet, dropdown-menu, sonner (`vue-sonner` 2), toggle-group, label, textarea. `components.json` has no `font` key on purpose: with one, `shadcn-vue add` injects a Google Fonts `@import` into `main.css`, a third-party request on recap pages. Fonts stay self-hosted by `@nuxt/fonts`.
- Tailwind v4 via `@tailwindcss/vite`, `tw-animate-css`, `@nuxtjs/color-mode`, `@nuxt/fonts`, `@lucide/vue` icons.
- Added in M1: `@tanstack/vue-table` **9** (v9 API: `useTable` + `tableFeatures({ columnSizingFeature, columnResizingFeature })`; only sizing is used, filtering is done before the data reaches the table), `@tanstack/vue-virtual` 3, `papaparse`, `nanoid` 6, `@supabase/supabase-js` 2.117, `vitest` (`corepack pnpm test`).
- Supabase (Postgres, Auth, Storage), local in development via the Supabase CLI (2.107 installed; Docker is running on this Mac). Since M2a: `@nuxtjs/supabase` 2.0 for cookie sessions; workspace routes query as the signed-in user (`requireUser()` in `server/utils/auth.ts`), only token-addressed recap routes use the secret key (`tokenClient()`).
- Added in M2: `@nuxtjs/supabase`, `read-excel-file` 9 (`.xlsx`), `@resvg/resvg-wasm` 2.6 + `geist` (TTFs copied to `server/assets/fonts` for link previews).
- Since M2.5 P1: the module's eager client plugin is removed (`app:resolve` hook in `nuxt.config.ts`); `app/plugins/supabase-lazy.client.ts` loads it only off `/` and `/r/*`, so recap pages and the landing don't ship supabase-js or wait for `getSession()`. Toasts and tooltips live in `app/layouts/default.vue`; `/` and `/r/[token]` use `layout: false`. `nitro.compressPublicAssets` is on.
- Since M2.5 P2: no prefetch hints (`build:manifest` hook sets `prefetch: false`). The landing and recaps were prefetching supabase-js and workspace chunks they never use; on Slow 4G that cost Lighthouse ~8 points. Chunks still load when a route needs them.
- Payments: Whop (M3). Hosting: Cloudflare Pages + hosted Supabase (M3).
- Package manager: **pnpm via corepack** (`corepack pnpm …`; plain `pnpm` is not on PATH). Dev server port **3040**.

### 7.2 Code layout

```
app/
  pages/index.vue            landing (M2.5 P2, Sundrop-style): hero with shapes and stickers, "For any business with regulars" with the example phone, three steps, $99, questions, closing
  pages/example/[key].vue    an example recap full-screen ("Open it full screen"); data in data/examples.ts
  pages/terms.vue, privacy.vue   M2.12: terms of service and privacy policy (components/legal/LegalPage.vue; HighReel, hello@highreel.app in data/legal.ts)
  pages/login.vue, confirm.vue   magic link / Google / demo session; link landing page
  pages/app/index.vue        business home "Your year" (M2.5 P3), needs a session
  pages/app/brand.vue        Your brand (M2.6): name, logo, colour, website + an example recap in a phone
  pages/app/c/[id].vue       a recap (M2.6): top bar with the step tabs, the workspace store; its tabs:
  pages/app/c/[id]/index.vue   Sheet (grid, filters, upload, preview) or a business recap's Content (form + preview)
  pages/app/c/[id]/design.vue  Design (an editor since M2.8): rail (look, slides with drag/eye, add, the fixed end), inspector, phone; save bar
  pages/app/c/[id]/share.vue   Share: publish, send by email (M2.8) with the email's live preview, the links file, link preview, how it's going; a business recap's link and images
  pages/r/[token].vue        recipient recap (SSR, og: tags); on wide screens the RecapBackdrop and ‹ › / pause (M2.8)
  pages/unsubscribe/[token].vue  the email footer's unsubscribe page (M2.8; a form post, so it works before JavaScript)
  data/examples.ts           five example payloads built from business-type templates (§4.6): app, newsletter, online shop, fitness studio, summer camp (fictional businesses; camp photos in public/examples)
  components/landing/…       PhoneFrame (an iPhone 17 Pro frame: band, bezel, Dynamic Island, status bar; used for every phone on the landing), VignetteSheet, VignetteBrand, VignetteShare (how-it-works loops, CSS only); LandingShapes (SVG sprite) + LandingShape
  lib/shapes.ts              the landing's flower outlines (polar functions → Catmull-Rom paths), also used by og-landing.mjs; blobFrames() for the hero's morphing blobs
  components/home/…          RecapsTable, DuplicateDialog, AccountMenu
  components/grid/…          DataGrid, GridCell, StatusDot
  components/recap/…         RecapPlayer, RecapSlide, RecapShare, RecapMonogram, CountUp, Odometer,
                             GuessFirst, recap.css (units, easings, transitions, pause/reduced rules)
  components/recap/scenes/…  SceneCover, SceneDays, SceneStreak, SceneCount (tokens: shapes, dots, hearts, stars), SceneWord,
                             SceneBadge, SceneRank, SceneTimeline, SceneDate (M2.7), SceneNote (note + "since"), ScenePhoto,
                             SceneLine, SceneBackdrop
  layouts/default.vue        toasts + tooltips (workspace, sign-in), the app's font (Outfit on body.app-ui), handwritten notes, the shape sprite; recaps and landing go without
  plugins/supabase-lazy.client.ts   Supabase browser client only where it's used
  components/grid/ColumnMenu.vue   M2.7: type and Remove for the recap's own columns (in DataGrid's header)
  components/landing/LandingPlayer.vue   the landing's lazy recap player (lazy-importing RecapPlayer itself
                             put a bundler helper, and 21 KB of workspace code, on /r)
  components/recap/RecapBackdrop.vue   M2.8: the recap page's moving backdrop in the business's colours (lib/blobs.ts)
  components/workspace/PhoneStage.vue, PlaceholderField.vue   M2.8: the editors' phone with controls; a line with placeholder chips
  components/workspace/EmailConnectDialog.vue, MessagePreview.vue   M2.9: connect your email (SMTP presets); the email or chat on a phone
  components/workspace/Segmented.vue   M2.10: a pill-shaped single choice (shadcn ToggleGroup)
  components/recap/scenes/…  M2.10: SceneTally, SceneFill, SceneSlots, SceneBigNumber, SceneBubbles, SceneGauge, SceneClimb, SceneLetters,
                             SceneSticker, ScenePostmark, ScenePodium, SceneLeaderboard, SceneList
  composables/useSortable.ts   M2.8: drag to reorder by a handle (Design's rail)
  composables/useCanonical.ts  M2.11: canonical link + og:url on the public site (siteOrigin), siteHref()
  components/workspace/…     TopBar (step tabs), BottomBar (filters, Upload), CampaignMenu, EmptyState, PreviewPanel,
                             PhotosSection, TemplateSwatch, PublishDialog, ImportDialog, MappingDialog, NewRecapDialog,
                             BusinessForm, ConfirmDialog, DemoBanner, InlineEdit (the Brand panel went in M2.6)
  composables/useWorkspace.ts  all workspace state and server calls (provide/inject)
  composables/useApi.ts      $fetch that signs out on 401, error toasts, sign out (home + workspace)
  utils/csv.ts, media.ts, shareImage.ts   sheet parsing, image shrinking, share-image canvas (story 1080×1920, square 1080×1080)
  components/ui/…            shadcn-vue
shared/
  templates/{app,newsletter,shop,visit,custom,business}.ts   templates as data (types.ts); index.ts registry,
                             customerTemplates, templateFor (a template + the campaign's own columns and slides)
  templates/own.ts           M2.7: withOwn, slideEntries, the scene library (SCENES, scenesFor), cleanColumns/cleanSlides
  templates/starters.ts      business-type templates on top of the sheets (§4.6)
  utils/validate.ts          validateRow/validateSheet, duplicates, computeTopPercents
  utils/slides.ts            buildSlides, shareStats, shareTexts (template-driven)
  utils/scenes.ts            scene per slide, durations, transitions, Guess-first choices, layout maths
  utils/recap.ts             normalizeSettings, toRecapRecipient (only slide columns leave the server)
  utils/mapping.ts           column auto-matching for uploads; M2.7: the sheet's other columns (inferColumn,
                             sheetExtras, settingsForSheet)
  utils/color.ts             palettes for Stories and Paper; shiftHue (M2.8)
  utils/email.ts             M2.8: the recap email (subject, message, button, footer) for sending and the Share preview
  utils/smtp.ts, whatsapp.ts M2.9: email providers' presets (server, port, login, password help, daily limit); wa.me numbers and messages
  utils/home.ts              the home's sentences, attention lines, activity, timeAgo, Duplicate names
  utils/suggest.ts           business recap suggestions from customer campaigns' totals
server/
  api/…                      routes below
  utils/auth.ts              requireUser() (user session, RLS, the account's email) and tokenClient() (secret key)
  utils/mail.ts, send.ts, unsubscribe.ts   M2.9: SMTP through the business's account (nodemailer; SMTP ports only, no private addresses); who gets an email and today's count; the unsubscribe target
  utils/secrets.ts           M2.9: AES-256-GCM for the saved SMTP passwords (NUXT_SECRETS_KEY)
  utils/bounces.ts           M2.11: what a mail server's answer means (bounce, retry, stop), provider typos, MX checks, the pause rule
  routes/robots.txt.ts, sitemap.xml.ts   M2.11: prerendered; the sitemap lists the landing and the examples
modules/landing-first-paint/ M2.11: rewrites the prerendered landing's HTML at build time (CSS inline, fonts preloaded, scripts after the largest paint)
  utils/brand.ts             brand checks (name, colour, website, logo folder) for both brand routes; signedBusiness()
  utils/db.ts, media.ts, recap.ts, og.ts   queries, signed URLs, public payload, link-preview renderer
  assets/fonts/              Geist TTFs + OFL licence (link previews)
supabase/
  migrations/…               init, accounts_rls, media
  seed.sql                   empty since M2a (users create their own business)
public/templates/            template + sample CSVs per template
scripts/generate-sample.mjs, check-rls.mjs, perf-home.mjs (home under 300 ms at 100k rows), og-landing.mjs (public/og.png), subset-caveat.py (public/fonts/caveat-notes.woff2), icons.mjs (M2.11: favicon, icon.svg, touch and manifest icons, site.webmanifest)
tests/                       vitest: validators, templates, mapping, scenes; e2e/ browser checks
```

### 7.3 API (Nitro routes)

Workspace routes need a session (401 otherwise) and run as that user, so RLS limits them to the user's own business. The `/api/r/*` routes are public and token-addressed.

| Method & path | Does |
|---|---|
| `GET /api/workspace` | the user's business and campaigns (with row counts); creates the business on the first visit (campaigns start from the home since M2.5 P3) |
| `GET /api/home?year=` | the home: business, years, the year's campaigns with counts (`campaign_stats`), recent activity (`recent_activity`), campaigns in any year |
| `GET /api/business` | Your brand: `{ business (signed logo), anonymous }` (M2.6) |
| `PATCH /api/business` | Your brand `{ name, accent_color, website_url, logo_path }` (any of them; the logo must be in the business's folder); the home's first-run name too |
| `POST /api/campaigns` | new campaign `{ name, year, template_key, starter? }`; `kind` follows the template; a business-type template (§4.6) sets the sheet, wording, theme and, on a default-coloured business, the colour |
| `POST /api/campaigns/:id/duplicate` | `{ name, year }`: same template, kind, settings, photos copied in Storage; no rows (a business recap keeps its form) |
| `PUT /api/campaigns/:id/business` | a business recap's form `{ raw }` → its one row (validated; a published one only accepts a valid form and keeps its link) |
| `GET /api/campaigns/:id/suggestions` | business recap suggestions from the year's customer campaigns (`campaign_sums`) |
| `GET /api/campaigns/:id` | campaign + brand + settings, logo and photos with 1 h signed URLs |
| `PATCH /api/campaigns/:id` | name; settings (labels, copy, CTA, photos, theme, share-image toggle, `photos_consent`, `guess_first`, M2.7: `columns` (a column keeps its type here), `slides`; M2.8: `email { subject, body }`, `email_consent`); brand (name, accent, website, `logo_path`). Media paths must be inside the user's folders |
| `PATCH /api/campaigns/:id/columns` | M2.7, the Sheet's column menu: `{ key, type }` or `{ key, remove: true }` for one of the recap's own columns; slides keep what still fits (`changeColumn`), every row is validated again; returns `{ settings, recipients }` |
| `DELETE /api/campaigns/:id` | deletes the campaign, its rows and its photo folder |
| `DELETE /api/campaigns/:id/recipients` | clears a draft's rows |
| `POST /api/campaigns/:id/import` | body: parsed rows, and (M2.7) the recap's own `columns` and `slides` after this sheet, saved first; replaces all recipients of a draft campaign; server re-validates; returns `{ recipients, settings }` |
| `GET /api/campaigns/:id/recipients` | all rows with errors and status |
| `PATCH /api/recipients/:id` | one cell edit; re-validates that row and duplicates; returns the row |
| `POST /api/campaigns/:id/publish` | computes `top_percent`, assigns tokens (nanoid 12) to valid rows without one, sets status |
| `GET /api/campaigns/:id/export.csv` | `customer_id, first_name, email, recap_url` for valid published rows |
| `GET /api/campaigns/:id/send` | M2.8/M2.9: sending status (the connected account or none, pending, sent, failed, without email, unsubscribed, today, the account's limit) |
| `POST /api/campaigns/:id/send` | M2.8/M2.9: `{ test?, recipient_id?, retry? }` → emails up to 25 rows through the business's account `{ sent, failed, remaining, waiting }`, or a test to the owner; 400 without a connected account |
| `GET`/`PUT`/`DELETE /api/business/email` | M2.9: the business's email account without its password / connect or change it (login checked and a test sent first) / disconnect |
| `POST /api/campaigns/:id/whatsapp` | M2.9: `{ recipient_id, sent }` marks a person sent on WhatsApp (or Undo) |
| `GET`/`POST /api/r/:token/unsubscribe` | M2.8: the unsubscribe page's details / opt this address out of the business's recap emails (one-click or the page's form) |
| `GET /api/r/:token` | public recap payload (first name, the template's slide values, brand, copy, 24 h signed photo/logo URLs, no storage paths); 404 unless published |
| `GET /api/r/:token/og.png` | 1200×630 link-preview PNG; same checks |
| `POST /api/r/:token/event` | `{ type: 'view' | 'share' | 'save' | 'cta' }` → counters (`record_recap_event` RPC, one atomic update) |

`PATCH /api/recipients/:id` takes `{ column, value }` and returns `{ row, others }`: `others` are rows whose duplicate error changed (if row 2 takes row 3's id, row 3 becomes the duplicate and is returned in `others`). Editing a published row's id to one another published row uses returns 409.

### 7.4 Data model (Supabase migration)

```sql
create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id),          -- null for the M1 demo
  name text not null,
  accent_color text not null default '#111111',
  logo_url text,
  website_url text,
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,                                -- "2026 recap"
  template_key text not null default 'app',
  year int not null,
  settings jsonb not null default '{}'::jsonb,       -- items_label, slide copy, founder_note, cta_label, cta_url
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  row_index int not null,                            -- order in the uploaded sheet
  customer_id text not null,
  first_name text,
  email text,
  raw jsonb not null default '{}'::jsonb,            -- cells exactly as uploaded/edited (what the grid shows)
  data jsonb not null default '{}'::jsonb,           -- parsed, typed values (what the recap uses)
  errors jsonb not null default '{}'::jsonb,         -- { column: message }
  token text unique,                                 -- set at publish
  view_count int not null default 0,
  first_viewed_at timestamptz,
  saved_at timestamptz,
  shared_at timestamptz,
  cta_clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on recipients (campaign_id, row_index);
-- duplicates are allowed in drafts (so the grid can show them); never among published rows
create unique index recipients_published_customer on recipients (campaign_id, customer_id) where token is not null;

alter table businesses enable row level security;
alter table campaigns  enable row level security;
alter table recipients enable row level security;
-- M1: no policies (server uses the service role). M2: owner policies via businesses.owner_id = auth.uid().
```

The real migration (`supabase/migrations/20261011120000_init.sql`) also has an index on `(campaign_id, customer_id)`, the `record_recap_event(token, type)` function, and explicit `grant select, insert, update, delete … to service_role`: the current Supabase CLI no longer grants new tables to the API roles, and without it every query fails with "permission denied".

Since M2 (`20261011180000_accounts_rls.sql`, `20261011200000_media.sql`):
- `businesses.owner_id` is required (default `auth.uid()`, cascade on user delete), unique (one business per user); `logo_url` renamed `logo_path`.
- RLS policies: a user reaches their business → its campaigns → their recipients; nothing else. `authenticated` gets table grants; on `recipients` only these columns are updatable: row_index, customer_id, first_name, email, raw, data, errors, token, updated_at (counters are server-only). `anon` gets nothing.
- `bulk_update_recipients(jsonb)` (security invoker) writes publish results in one statement as the user.
- Storage bucket `media` (private, 5 MB, JPEG/PNG/WebP); policies require the first path folder to be a business the user owns.
- `campaigns.settings` also holds `photos`, `photo_in_share_image`, `photos_consent_at`, `theme`, and since M2.5 P1 `guess_first` (Brand panel checkbox, off by default).
- `corepack pnpm check:rls` signs in two demo users and checks 29 isolation rules (tables, RPCs, counters, Storage, the home and business-recap functions).

Since M2.8/M2.9 (`20261012150000_email.sql`, `20261012170000_email_connections.sql`): `recipients.emailed_at`, `email_error`, `whatsapp_at` (owner-updatable); `email_optouts` (owner reads, the token route writes); `email_sends` (append-only log, no addresses); `email_connections` (one per business: provider, host, port, secure, username, `password_enc` (AES-GCM by the server), from email and name, reply-to, daily limit, verified at; owner only).

Since M2.5 P3/P4 (`20261011220000_home.sql`, `20261011230000_business_recap.sql`):
- `campaigns.kind` (`customers` | `business`, default `customers`) and `campaigns.updated_at` (trigger on update).
- `campaign_stats(year)`: per campaign of the year: rows, need fixing, published (a link and no errors), opened, views, saved, shared, clicked, last change. `recent_activity(year, limit)`: first views, saves, shares and button taps with first names. `campaign_sums(year)`: per customer campaign, published count and the sum of every numeric `data` value over published rows. All `security invoker` (RLS applies), execute for `authenticated` only.

### 7.5 Privacy and security

- Recap URLs use unguessable tokens (nanoid 12 ≈ 71 bits); `/r/*` sends `X-Robots-Tag: noindex`, and so do `/unsubscribe/*`, `/login`, `/confirm` and `/app/**` (M2.11). robots.txt blocks `/app` and `/api/` but not `/r` or `/api/r/`: a blocked page can't say "noindex", and link previews need the recap and its image.
- Public payload contains first name, stats and brand only.
- Counters are first-party; no analytics scripts on recap pages.
- Recommend businesses omit emails (join on `customer_id`). Deleting a campaign deletes its rows (cascade).
- The secret key never reaches the client, and is only used on token-addressed routes.
- Every business sees only its own data: RLS on tables and Storage, workspace queries run as the user (M2). `requireUser()` checks the user with Supabase Auth on every call, so deleted users and signed-out sessions get a 401 and the browser is sent to sign in.
- Group photos: consent checkbox before the first upload; off the public share image by default; deleted with the campaign. Recap pages get signed URLs, never paths.

### 7.6 Local development

```bash
corepack pnpm install
corepack pnpm sample            # regenerate template + sample CSVs
supabase start                  # first run pulls Docker images
corepack pnpm dev               # http://localhost:3040 → "Try the demo"
corepack pnpm test              # vitest
corepack pnpm check:rls         # isolation checks against local Supabase
```

Other projects on this Mac (forevermore, trueroute) use local Supabase on 543xx. This one uses **544xx**: API 54421, DB 54422, shadow 54420, Studio 54423, Inbucket 54424, pooler 54429, analytics 54427 (realtime, edge runtime and analytics are switched off until needed). `.env` (see `.env.example`): `SUPABASE_URL=http://127.0.0.1:54421`, `SUPABASE_KEY` = the **Publishable** key, `SUPABASE_SECRET_KEY` = the **Secret** key (`sb_secret_…`), all from `supabase status`. `supabase db reset` re-applies the migrations (and wipes local users). Local auth: anonymous sign-ins on, email confirmations on (like production), email rate limit raised to 30/h; sign-in emails land in Mailpit at http://127.0.0.1:54424. Google sign-in is wired but off: create a Google OAuth client, set `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`/`_SECRET`, set `enabled = true` under `[auth.external.google]`, and `NUXT_PUBLIC_AUTH_GOOGLE=true`.

10,000-row check: `node scripts/generate-sample.mjs --rows 10000 --out /tmp/sample-10000.csv`, then upload it.

Recap emails (M2.9) go through the business's own SMTP account. Locally connect **Local test inbox (Mailpit)** on Your brand: Mailpit's SMTP is on 54425 (`smtp_port` in `supabase/config.toml`, so after changing it run `supabase stop && supabase start`), and every email lands in its inbox at http://127.0.0.1:54424; nothing leaves the machine. The saved passwords are encrypted with `NUXT_SECRETS_KEY` (required in production; locally a key is derived from the Supabase secret key).

Browser checks: `corepack pnpm e2e` runs `tests/e2e/*.mjs` (24 checks; M2.12 added `legal` (footer and sign-in links, title, canonical, description, HighReel and the address, the contents list, the two pages linking each other, no sideways scroll, no third parties); M2.11 added `unsaved` (leaving Design with edits asks: keep, discard, save and leave; the browser's prompt on close) and `bounces` (a fake SMTP server in the test answers like real ones: typo held, dead address remembered, busy retried, quota stops the run, too many bounces pause it), and `landing` checks canonical links, structured data, robots.txt, the sitemap, icons and noindex; M2.10 added `library` (every scene for numbers, words, top %, dates and lists in Design with the value showing, then played on a published recap); M2.9 added `whatsapp` and rewrote `send` for connected accounts; M2.8 added `editor` (no page scroll, the rail's drag/keys/eye/chips, Your brand, the recap page's backdrop and controls) and `send` (demo refused, test, unsubscribe with and without JavaScript, 193 sends in Mailpit with links and headers, nothing sent twice, the daily limit, deleting with a log): M1 done-when incl. 10k rows, recap player, scenes and Guess first, demo/404/reduced motion/link preview, the landing (P2), accounts and isolation, logo and photos, engagement, visit template, .xlsx mapping, Paper, stale sessions, the home (P3), the business recap (P4), templates, tabs (M2.6), own columns and the scene library (M2.7)) in headless **installed Google Chrome** via `playwright-core` (no browser download). It needs `corepack pnpm dev` and `supabase start`, generates its fixtures on first run (drawn images, a farm .xlsx via python3 + openpyxl, the 10k sheet) and writes screenshots to `tests/e2e/.out`. `node tests/e2e/run-all.mjs recap media` runs a subset. Claude in Chrome on the owner's Mac often has the window hidden, which freezes animation frames, so timing checks belong in these headless runs.

Recap budgets (M2.5 P1) need a production build, not the dev server: `corepack pnpm build`, then `PORT=3047 node --env-file=.env .output/server/index.mjs` (3041 is taken by another project), then `E2E_BASE=http://localhost:3047 node tests/e2e/budgets.mjs` (JS weight, first slide on Slow 4G + 4× CPU, frame times per scene at 4× CPU). Build a copy outside the repo (or stop `pnpm dev` first): `nuxt build` and the dev server share `.nuxt`. Lighthouse (P2 done-when) on the same production build: `npx lighthouse@12.8.2 http://localhost:3047/ --form-factor=mobile --throttling-method=simulate --chrome-flags="--headless=new"` and again with `--preset=desktop` (not a project dependency; set `CHROME_PATH` to the installed Chrome). Since M2.11 every category must be 100 on both; `budgets.mjs` also checks the landing's first paint (served compressed, CSS inline, two fonts preloaded, scripts after the largest paint). A copy built with a symlinked `node_modules` needs `buildDir` inside the copy (Nuxt's production build dir is `node_modules/.cache/nuxt/.nuxt`, and prerendering imports from it). `node scripts/perf-home.mjs` seeds 10 campaigns × 10,000 rows for a throwaway demo user and times the home's queries. `node tests/e2e/record.mjs` writes phone-size MP4s of an app and a visit recap to `tests/e2e/.out` (Chrome screencast + the system ffmpeg; point `E2E_BASE` at a production build to hide the devtools pill).

## 8. Milestones

### M1 — local demo (done 2026-10-11)

Goal: the full loop works locally with the sample data. No auth, no payments, no deploy.

1. Supabase: `supabase init` (custom ports), migration from §7.4, `seed.sql` with business "Habitly" (accent `#4F46E5`, CTA "Invite a friend") and one draft campaign "2026 recap" (items_label "habits checked off", a founder note).
2. `shared/templates/app.ts` + `shared/utils/validate.ts` from §4 (unit-test the validators against the 5 planted errors in the sample: rows 8, 24, 59, 92, 141).
3. Server routes from §7.3.
4. Workspace `/app`: empty state, upload + "Use sample data", grid (§6.2), filters, search, inline edit, Brand sheet (name, accent, CTA, items label, founder note), publish dialog, export CSV.
5. Recap player `/r/[token]` and the same player inside the preview panel (driven by the selected row, unpublished data allowed in preview only).
6. Share image (canvas) with Save and Share.
7. Landing `/`: one sentence and **Open the demo** → `/app`.

**Done when** (check with the `run` skill and a real browser):
- "Use sample data" loads 200 rows; exactly 5 rows show red cells with the right messages; fixing one in the grid turns it green.
- Clicking rows updates the preview; slides skip correctly (e.g. a row with streak < 3 has no streak slide).
- Publish → 195 links; the export CSV has 195 rows with working URLs.
- A recap URL works at 390×844 (phone) and desktop; tap, hold and keys work; Save image downloads a correct 1080×1920 PNG.
- Grid scrolls smoothly with a 10,000-row CSV (generate one with the script by changing the count).
- `corepack pnpm typecheck` passes.

### M2 — real accounts, media, more templates (done 2026-10-11)

Planned 2026-10-11. Built in this order; each step ends verified in a browser and with a §12 row, so a fresh session can pick up at the next one.

**Hard rule from here on: every business sees only its own data.** RLS policies on every table and on Storage. Workspace routes talk to Postgres with the signed-in user's session (`serverSupabaseClient(event)`), so the database refuses other businesses' rows even if route code has a bug. The secret key (`serverSupabaseServiceRole(event)`) is used only where a request is identified by an unguessable recap token: `GET /api/r/:token`, `POST /api/r/:token/event` and the link-preview image.

**M2a — Accounts and isolation**
1. `@nuxtjs/supabase` 2.0 (cookie sessions, SSR-aware). Env: `SUPABASE_URL`, `SUPABASE_KEY` (publishable), `SUPABASE_SECRET_KEY` (secret; replaces `SUPABASE_SERVICE_ROLE_KEY`). Our own `server/utils/supabase.ts` goes away.
2. `/login`: email magic link (locally the email lands in Mailpit, http://127.0.0.1:54424), Google (button shown only when `NUXT_PUBLIC_AUTH_GOOGLE=true`; needs a Google OAuth client in `supabase/config.toml` via env), and **Try it without an account** (Supabase anonymous sign-in). `/confirm` finishes the sign-in. `/app/**` needs a session; `/`, `/login`, `/r/*` don't.
3. Anonymous sessions get a thin banner: "Demo session. Add your email to keep this work." → `auth.updateUser({ email })`; the confirmation link makes the same user permanent, data stays.
4. First visit: `GET /api/workspace` creates the user's business ("My business") and a draft "2026 recap" (template `app`), then returns `{ business, campaigns }`. One business per user for now.
5. Migration: RLS policies (owner of the business → its campaigns → their recipients), grants to `authenticated`, unique `businesses.owner_id`. The owner-less Habitly seed goes; "Use sample data" stays. The demo-reset route goes (replaced by deleting a campaign or clearing a draft's rows).
6. ⋯ menu: Sign out.

**M2b — Several campaigns per business**
Top bar `Business / Campaign ▾` opens a switcher: campaigns with status and row count, **New campaign** (name, year, template), **Delete campaign** (confirm; deletes its rows and its photos). URL `/app?c=<campaign id>`; without it, the newest campaign opens. Drafts also get **Clear rows**.

**M2c — Logo and group photos (no per-customer photos)**
Decided 2026-10-11: photos are per campaign, the same for every recipient (a group photo from the farm visit, the team at the event). No photo column in the sheet.
- Private bucket `media` (5 MB per file; JPEG, PNG, WebP), created in a migration. Paths: `{business_id}/logo/{uuid}.webp`, `{business_id}/{campaign_id}/{uuid}.webp`. Storage policies: the first folder must be a business the user owns.
- The browser shrinks images before upload (logo 512 px, photos 2000 px long edge, WebP) and uploads straight to Storage with the user's session. The server only accepts paths inside the user's own folders when they're saved.
- `businesses.logo_url` becomes `logo_path`. `campaigns.settings.photos`: up to 6 × `{ id, path, caption, width, height }`, in order. `settings.photo_in_share_image` (default **off**: a group photo shows other people's children, so it stays out of the image parents post publicly unless the business turns it on). First upload per campaign asks for a consent checkbox ("I have permission to share these photos with the recipients; for children, their parents' consent"), stored as `settings.photos_consent_at`.
- Recap: one full-bleed photo slide per photo (slow zoom, caption on an accent band), placed before the note slide. The logo replaces the monogram on the cover, slide footers and the share image.
- Recap pages get Storage URLs signed by the server (24 h). The workspace gets URLs signed with the user's session.
- Brand panel gains **Logo** and **Photos** (upload, caption, move up/down, remove, share-image toggle).

**M2d — Engagement columns**
After publish the grid shows **Viewed** (count, first viewed date) and **Saved / Shared / Clicked** (icons from the counters). Top bar: "· N viewed".

**M2e — Templates as data, plus `newsletter`, `shop` and `visit`**
- Slides move out of code into each template: a list of `{ key, column, kind: number | text, copy, show rule, small line }`, plus the cover copy, the note and "since" columns, the rank column and the share-card stats. This is the step toward businesses defining their own columns later.
- `newsletter` and `shop` as in §4.4. New **`visit`** template for camps, farms, kindergartens and clubs (recipients are usually parents): `participant_id`, `first_name`, `email`, `visit_date`, `days`, `activities_done` (label per campaign, e.g. "animals fed"), `highlight` ("Best moment: feeding the baby goats"), `badge` ("You earned: Junior farmer"), `personal_note`. No ranking.
- New campaign picks the template; each has its own template CSV and sample.

**M2f — `.xlsx` and column mapping**
`.xlsx` via `read-excel-file` (first sheet; the npm `xlsx` package is stuck on a version with a known vulnerability). When headers don't match, a mapping dialog lists the template's columns with a select of the sheet's headers, auto-matched by name and common synonyms; required columns must be mapped.

**M2g — Link previews**
Per-recipient 1200×630 image for `og:image` (first name, business, accent, two stats), rendered on the server. Tooling picked when building; it must run on Cloudflare in M3.

**M2h — Second visual theme**
A light "Paper" theme (paper background, large type, accent as the highlight colour), chosen per campaign.

**Later (not M2):** businesses defining their own columns and slides; short uploaded video (one shared clip per campaign at most, because video traffic is what makes Supabase bills grow); the recap as a vertical video (M4).

### M2.5 — Landing, a richer recap, the business home (planned 2026-10-11, before M3)

The owner's ask (2026-10-11): before going live, (1) a short landing page that looks as good as a recap, (2) a usable product after sign-up, meaning a home that shows the year at a glance and a recap of the business itself to post on its own social media, and (3) recap animation closer to Spotify Wrapped. Built in four steps, roughly one session each (P1 may take two). Each step ends browser-verified with a §12 row.

**Order: P1 → P2 → P3 → P4.** P1 first because the landing's hero plays a real recap, and the home and the business recap reuse the same scenes, so the motion is designed once.

**Ground rules for every step**
- Read this spec and CLAUDE.md first. Load the `frontend-design` skill (and `design-taste`) before any UI work.
- The workspace (`/app`) stays dense (since 2026-10-11 in the landing's type and colours, §6.4). Motion and illustration live in recaps, the landing page and the business recap.
- No third-party scripts on `/` or `/r/*`; fonts stay self-hosted.
- Every business sees only its own data: new tables, views or RPCs come with RLS (security invoker) and a `check:rls` case.
- Templates stay data: new visuals key off template fields (`SlideDef.scene`, …), never template names.
- Before the §12 row: `corepack pnpm test`, `typecheck`, `check:rls` and `e2e` all green, plus new e2e checks for the new behaviour.

**P1 — Recap v2: scenes and motion**

Today every stat slide is the same layout (a sentence, a big counting number, two soft circles) with one crossfade. Goal: each moment gets its own composition, choreography and a visual of its number, like Wrapped.

1. **A scene per kind of moment**, chosen in template data (`SlideDef.scene`; default by `kind`). Scenes only visualise data we already have:
   - `cover`: title words rise one by one behind a mask; the mark pops in; background shapes assemble.
   - `days` (a count out of a year or a visit): a calendar grid (53×7 for a year, one tile per day for a visit) fills in to the value while the number counts.
   - `streak`: a chain of N segments lights up in sequence; the last one glows.
   - `count` (items, issues, orders, activities): odometer-style rolling digits; small tokens drop and stack (capped near 60, with "×N").
   - `word` (favourite feature, product or issue; best moment): the word scales in big while it repeats in marquee bands behind (Wrapped-style type wallpaper).
   - `badge`: a sticker or medal spins in with a shine sweep.
   - `rank` (top X%): 100 dots; the top X light up and one pulses, "you're here".
   - `note`: the text appears word by word; the quote mark draws itself.
   - `photo`: a polaroid drops and settles, slow zoom, caption types in.
   - `share`: stat tiles fly in and assemble the card; a small confetti burst.
2. **Backgrounds.** Stories: slow drifting colour blobs from the palette and a fine grain (static SVG noise). Paper: paper grain and ink rules, calmer motion.
3. **Transitions** vary by scene (wipe, push, zoom, colour flood). Durations per scene, 5–7 s; cover and share behave as today.
4. **"Guess first"** (campaign setting, off by default): before a number reveals, three choices (the real one and two decoys); tapping one reveals the answer. Auto-advance waits for the tap. Wrapped and Duolingo use quizzes like this to keep people tapping.
5. The share image and the link preview pick up the new look.

Tech decisions:
- Animation library: planned as **`motion`** (motion.dev, MIT). **Changed while building P1 (2026-10-11): scenes are plain CSS keyframes, no library.** Every scene animates only transform and opacity, so CSS runs it on the compositor (smooth even when the main thread is busy), the cover plays from the server-rendered HTML before JavaScript arrives (first slide on 4G), hold-to-pause is one rule (`animation-play-state`), and it costs 0 KB of JavaScript. Timing comes from data through CSS variables (`--t`, `--d`); springs are generated `linear()` easings in `recap.css` (with cubic-bezier stand-ins for Safari < 17.2). Motion is still a fine pick for P2's scroll reveals if CSS scroll-driven animations aren't enough. GSAP is free for commercial use and would be fine (its licence only excludes no-code animation builders that compete with Webflow). Spotify built Wrapped 2025 in **Rive** (designer-made animations driven by data); that needs a designer's files, so revisit if a designer joins.
- DOM/SVG, transforms and opacity only; dot grids up to ~400 nodes in the DOM, larger ones drawn on one canvas.
- Every scene has a static end state (reduced motion) and is a function of (slide data, progress), so the M4 video recorder can redraw it on a canvas. In practice: an element's base style is its end state and keyframes only say how it gets there, so `animation: none` shows the finished scene; jitter (tokens, confetti) and Guess-first decoys are seeded from the slide's data.
- Guess first asks on the first two number slides only (`GUESS_LIMIT`), so a recap never turns into a quiz. Decoys keep the value's roughness and range; the real one isn't always in the middle. Tapping the right half without picking reveals the answer.
- Budgets: 60 fps on a mid Android (DevTools 4× CPU throttle), `/r` JavaScript ≤ 150 KB gzipped, first slide visible < 1.5 s on 4G.

Done when: every template's recap uses at least 4 different scenes; reduced motion shows the end states; the budgets are measured and met; e2e green with new checks (scene per slide, guess-first); a phone recording of an app recap and a visit recap for the owner.

**P2 — Landing page** (done 2026-10-11; see §12)

As built: headline **"Give every customer their year recap."** (the owner's pick), the **$99** price shown in the hero line and the pricing section ("Founding price for our first businesses. Later $199."). The hero is the example recap's accent colour, and switching examples floods the hero from the pressed button (a scaled circle, compositor-only); sections follow the recap's tones (accent → dark → light → accent), so the whole page takes the playing business's colours. The phone plays in preview mode, pauses off screen, and after the share slide moves to the next example until someone picks one. Examples: Habitly (app), The Weekly Bite (newsletter), Bean & Leaf (shop, Paper theme), Green Valley Farm (visit, two illustrated SVG photos); their last-slide button is "Make one for your customers" → the demo. How it works: three CSS-loop vignettes on a sticky stage (stacked on phones), scroll reveals with CSS scroll-driven animations where supported. Motion is CSS only (no `motion`). Terms and privacy say "at launch" until M3.

**Restyled 2026-10-11 after [trysundrop.app](https://trysundrop.app/)** (the owner's ask: "the same look"). White page, Outfit for type (the closest free match to Sundrop's paid Polymath; via `@nuxt/fonts`, landing only), handwritten notes in a Caveat subset (`public/fonts/caveat-notes.woff2`, 16 KB instead of 74 KB, `python3 scripts/subset-caveat.py`, OFL), a blue pill **Try the demo** that also sticks to the top right once the hero's is off screen. Flower shapes are our own (polar outlines in `app/lib/shapes.ts`, one SVG sprite `LandingShapes.vue`, drawn with `LandingShape`); in the hero and the closing they pop out from the middle with recap stickers (212 days with Habitly, Top 6 %…), a farm polaroid and two inbox bubbles ("Ana, your 2026 with Habitly"). No "real text messages" section like Sundrop's: we have none, and made-up ones would be fake testimonials. Sections, all centred: hero → **Tap through one.** (the example phone on a big shape in the playing business's colour, the shape changes per example; this replaced the colour flood) → three steps, each a heading with a handwritten "step one" and its vignette in a white window on a shape (no sticky stage any more) → **$99 per campaign.** with four grey cards → Questions (chevron accordion) → closing with shapes. **Open it full screen** replaces "See an example". Sections below the fold pop in when they scroll into view (IntersectionObserver adds `.gate`/`.in`; the server HTML shows everything in place). The phone's recap and the step vignettes render only once near the screen (`near` in `pages/index.vue`, lazy components): server-rendering them made the first paint wait on the player's code and on Geist and Google Sans Code (Lighthouse 87 → 93). `public/og.png` redrawn in the same look (Outfit TTFs in `scripts/fonts`, OFL).

**Made general 2026-10-11** (owner: the farm had become a running theme, and "if I reached out to Spotify I wouldn't make the landing page about Spotify"). No example business is named outside the phone: hero stickers say "212 days in the app", "Top 6% of all readers", "14 orders this year", "86 classes at the studio"; the closing has "3 days at summer camp" and "Top 5% of all members"; the inbox bubbles come from "Your business" ("Ana, your 2026 recap is here", "Leon, here's your year with us"); the step-two picture says "Your business · 2026". The examples section is headed **For any business with regulars.** ("Apps, newsletters, online shops, gyms, studios, camps and daycares…") and plays five examples: App (Habitly), Newsletter (The Weekly Bite), Online shop (Bean & Leaf, Paper), Fitness studio (Forma Studio, visit template, 86 days, "classes taken"), Summer camp (Sunny Hill Camp, visit template with two illustrated photos: `camp-lake.svg`, `camp-evening.svg`). The farm illustrations are gone. The landing e2e checks that no example business is named outside the phone.

**Reworked 2026-10-12** (owner: the hero looked "too much like a copy" of the reference; phones should look like real iPhones; step three was confusing; pricing unclear past 1,000):
- **Hero motion of its own.** The flowers left the hero (they stay below, as stages for pictures). Instead: five soft blobs in the shape palette that keep changing shape (`blobFrames()`, SMIL `<animate>` on the path so Safari morphs too, plus a slow turn), four hand-drawn lines that draw in, rest and let go (`stroke-dashoffset`, one dashed arc marching), and small dots, rings, pills and pluses floating. It all pauses when the hero is off screen (IntersectionObserver; SMIL via `pauseAnimations()`) and for reduced motion. The stickers and inbox bubbles stay.
- **iPhone frame** (`PhoneFrame.vue`): iPhone 17 Pro proportions (402 × 874 pt screen), a titanium band, thin bezel, side buttons, the Dynamic Island and status bar drawn over the screen, home indicator. The recap fills the whole screen edge to edge; the player reads `--recap-inset-top` (0 by default, so `/r` and the dashboard preview are unchanged) to start its progress bar and content below the status bar while its colour runs behind it. Screen corners are a little tighter than Apple's (10.7 % of the frame width). The status bar follows the slide's text colour (`RecapPlayer` exposes `tone`). Used for the example phone and every phone in the step pictures.
- **Steps:** more room between the text and the shape (`.step .stage` margin). Step two's mini recap sits in the iPhone frame. Step three is now **Share it with your members.**: three phones get a notification from "Your business" ("Ana, your 2026 recap is here"), it's tapped and each person's recap floods open in a different colour (`VignetteShare`, replacing the CSV-to-phones loop).
- **Pricing:** "One price for the whole campaign." Three cards: up to 1,000 customers $99 (founding price, ~~$199~~), up to 10,000 $399, up to 50,000 $799, each "for the whole campaign"; then what every campaign includes; a fourth question, "What counts as a campaign?". The hero line and the link preview say "from $99 per campaign".

One scroll that says what it is, shows it, and gets people into the demo. It should feel like a recap: bold colour, big type, motion. At most four sections.

1. **Hero:** headline, one supporting line, **Try the demo** (the anonymous session that exists) and **See an example**. Next to it (below on phones), a phone playing a real example recap, with a switcher underneath: App · Newsletter · Shop · Farm visit. The page's accent follows the example that's playing. Headline candidates: "Give every customer their year." / "A year-in-review for every customer." Mentioning Spotify Wrapped in the copy is fine; don't use "Wrapped" as a name.
2. **How it works**, three steps, each a small animated vignette: a sheet's rows slide in and turn green → a colour swatch recolours a recap → links go out and phones light up. Sticky scroll on desktop, stacked on phones.
3. **Pricing:** one plan, founding price $99 per campaign up to 1,000 recipients (§10), and at most three FAQs: "Do you email my customers?" (no: you send the links CSV with your own tool) · "What data do you need?" (the template's columns; leave emails out) · "Can I try it first?" (yes, the demo).
4. **Footer:** closing call to action, terms and privacy (placeholders until M3), "Made in Kosovo".

Build notes: example recaps are static payloads in `app/data/examples.ts` (the `RecapPayload` shape, photos in `public/examples/`, illustrated, never real people); `/` is server-rendered; motion from the same library (inView reveals, a kinetic headline); an OG image for the landing; no third-party scripts.

Done when: Lighthouse mobile performance ≥ 90 and accessibility ≥ 95; no horizontal scroll at 390 px; all four examples play; Try the demo lands in the workspace; reduced motion respected; an e2e check for the landing.

**P3 — The business home ("Your year")** (done 2026-10-11; see §12)

As built: also a first-visit empty state with the two kinds and **Try it with sample data** (creates a campaign and loads the sample); "Try the demo" lands on `/app?start=demo`, which opens a first draft for a new demo account, so the demo still starts in the workspace. Deleting a campaign goes back to the home. Activity lines never guess pronouns ("Ana opened", "Someone opened" for a business recap). Duplicate asks for name and year (next year by default, "2026 recap" → "2027 recap").

After signing in, a page that shows the year at a glance and is the hub for everything, without dashboard cards or charts.

- Routes: `/app` becomes the home; a campaign's workspace moves to `/app/c/[id]`, and old `/app?c=…` links redirect.
- Layout (dense, typographic):
  1. Top bar: business mark and name, a year switcher (years that have campaigns, plus the current one), **New recap**, account menu.
  2. A year summary written like a recap, numbers in mono: "In 2026 you sent 195 recaps in 2 campaigns. 132 were opened (68%), 41 saved, 18 shared, and 9 tapped your button." Then one line per draft that needs attention ("Summer farm days: 3 rows need fixing · not published").
  3. A recaps table (Airtable-style): name · kind (customers / your business) · template · status · rows · published · opened % · saved · shared · clicks · updated. A row opens it; the row menu has **Duplicate** (brand, copy and photos, no rows: "run it again for 2027") and **Delete**.
  4. Recent activity: latest opens, saves, shares and clicks ("Ana opened her recap · 2 h ago"), from the timestamps we already store.
  5. Empty state for new accounts: "A recap for each customer" (sheet) or "A recap of your business year" (P4), plus "Try it with sample data".
- Data: one SQL function or view (security invoker, so RLS applies) with per-campaign counts for a year; `GET /api/home?year=2026`; under 300 ms with 10 campaigns × 10k rows.
- §6's "no dashboard cards, charts or stat tiles" still holds: sentences and a table instead.
- Payments (M3) attach here later (paid state per campaign); not in this step.

Done when: the home's numbers match the grids; the year switcher works; Duplicate copies photos too; old links redirect; `check:rls` covers the new function; an e2e check for the home.

**P4 — The business's own recap ("Our year")** (done 2026-10-11; see §12)

As built: template and suggestions as in §4.5. The workspace route shows `BusinessForm` (numbers with suggestion chips, highlight, milestones, thank-you note, logo and photos, then the link, story/square image downloads and the link preview); the Brand panel keeps colour, theme, copy and the button. Top bar **Publish** saves and publishes in one go; **Save** afterwards updates the live recap. Only the business recap has a square image for now (the share slide still saves the story image).

This answers §11 question 3 with yes: one recap about the business itself, for its own Instagram, Facebook or LinkedIn, e.g. "Our 2026 at Green Valley Farm".

- `campaigns.kind`: `customers` (today) or `business`. A business recap has exactly one recipient row and gets its token when published, so `/r/[token]`, the player, the share image and the link preview work unchanged.
- Template `business` (data, like the others): up to 4 headline numbers with labels ("1,240 kids visited", "52 baby goats born"), the highlight of the year, up to 3 milestones ("March: opened the new barn"), a thank-you note, and the campaign's group photos. Copy speaks to followers ("Thank you for an amazing year").
- Editing is a form with the live preview beside it (no grid), with suggestions from that year's customer campaigns as chips ("195 customers got a recap", "1,180 habits checked off").
- Outputs: the link, the 1080×1920 story image, a new 1080×1080 square for feeds, and the link preview.

Done when: created from the home; form and live preview; publish; public page; both image sizes; listed on the home; an e2e check.

**Not in M2.5:** payments and what's free (M3), music on recaps (licensing), businesses defining their own columns, video export (M4).

**Questions for the owner** (ask when the step starts if still open): P1, should "Guess first" be on by default (built off by default, as planned; a one-line change in each template's `defaultSettings`), and is background music wanted later? ~~P2, which headline, and show the price before the Whop checks are done?~~ Answered 2026-10-11: "Give every customer their year recap.", and show $99. P2/M3, what's free (e.g. publishing up to 10 recaps)? (The landing doesn't promise anything free beyond the demo.) P4, which numbers a farm or camp would want suggested: built from the templates' `totals` (visits: activities with their label, visit days); check with a real farm.

### M2.6 — A manageable dashboard (planned and built 2026-10-12; see §12)

The owner's ask (2026-10-12): the workspace started as a demo and does everything on one page (sheet, Brand panel, photos, copy, preview). Make it a usable product: set things up in their own places, and let the sheet page be only data and a preview. **Not** a traditional dashboard (no sidebar, cards or charts); keep the landing's design language (§6.4). Owner's pick: business-wide basics get their own "Your brand" page.

**Structure**

```
/app                 Your year (home): sentences, recaps table, activity; "Your brand" in the header
/app/brand           Your brand: business name, logo, colour, website (shared by every recap) + a phone preview
/app/c/:id           a recap, three steps as pill tabs in the top bar (the landing's steps):
  (index)            Sheet   the grid, filters, upload, live preview. Nothing else.
  /design            Design  template, theme, Guess first, then slide by slide: each slide's line (and count label),
                             group photos, the note, the closing button; a big iPhone preview that jumps to the slide
                             being edited; a save bar (draft until saved, like the old Brand panel)
  /share             Share   publish (what goes out, what's skipped), how to send (export links CSV, a sample email
                             with {recap_url}), how a link looks (link preview), who opened/saved/shared (sentences)
```

A business recap (kind `business`) has **Content** (the form: numbers, highlight, milestones, note) · **Design** · **Share** (link, story/square images, link preview).

- Top bar: wordmark (home), business name (→ Your brand), recap name (rename) with the switcher, the three tabs, **Publish**, ⋯. Row counts move to the sheet's bottom bar (its filters already count). Upload sits in the bottom bar.
- The Brand panel goes away: brand basics → `/app/brand`, everything about one recap → Design. Logo upload moves with the brand; group photos move to Design.
- Templates in Design (§4.6) apply wording and theme only; the colour belongs to Your brand, so Design's swatches show the template in the business's own colour.
- API: `GET /api/business` (signed logo) and `PATCH /api/business` with name, accent colour, website and logo (same checks as the campaign route, shared in `server/utils/brand.ts`).
- Design previews a real row (the sheet's selected one); with no rows yet, the landing's example person for that sheet template.
- Nested routes: `pages/app/c/[id].vue` keeps the workspace store (provide/inject) and the top bar; `index.vue`, `design.vue`, `share.vue` are its children, so rows load once and switching tabs keeps edits in memory.

Done when: each tab works for both kinds; nothing about design lives on the sheet page; Your brand saves and every recap's preview follows it; e2e checks updated (Brand panel flows → Design / Your brand) and new ones for Design and Share; `check:rls` covers the new business route.

### M2.7 — Your own columns and a scene library (planned 2026-10-12)

The owner's ask (2026-10-12): don't limit businesses to our columns or our slides. They pick a template, bring their own sheet with the columns they find important, and every row still gets a good recap; our template sheets stay as a way to start. And a library of animations (the calendar and the rest) that any slide can use, with a few options each. The first real user is the owner's own product, Forevermore (members who make digital gifts): if nobody else buys, it should still be able to send its members a recap of their gifts.

**What others do** (researched 2026-10-12). Tools for small businesses are fixed: PushPress's member recap shows five stats from its own check-in data, "no setup or configuration", only the logo changes. The flexible ones are enterprise: Storyly (needs its SDK; the business defines "user properties" from a CSV or its CRM and picks one from a dropdown for any text or image), Idomoo (sales-led; "each column is a parameter you defined in your storyboard", and its CSV template is generated from the storyboard), Blings (CRM-connected), Canva Bulk Create (static images: link each text box to a column). They go design first, sheet second. We do both: the sheet's columns can become slides, and a slide can ask for a new column that the downloadable sheet then includes.

**Model: a campaign adds to its template, it doesn't replace it**

- `settings.columns`: the business's own columns, `{ key, label, type }`. `key` is the header normalized (`Gifts made` → `gifts_made`), `label` the header as written, `type` `int` | `decimal` | `text` | `date`. Up to 30. They're optional cells with lenient rules (sheets exported from other tools): numbers may carry a currency sign or % (stripped: the slide's line adds "€"), thousands separators and decimal commas ("1.204,50 €" → 1204.5; a single "24.999" is a decimal); whole numbers round, decimals keep two places; dates may carry a time (`2026-02-14 10:22:01+00` → `2026-02-14`); text ≤ 140 characters. A key can't reuse a template column, a placeholder name (`first_name`, `year`, `business`, `items_label`) or start with `top_`.
- `settings.slides`: the recap's slide list, in order, or `null` for the template's own. Each entry is a template slide (`{ key, hidden?, scene?, tokens?, span?, min?, max? }`), one the business added (`{ key: 'c_<column>' | 'top_<column>', column, show: 'value' | 'top', label, … }`) or a list (`{ key: 'list_<n>', show: 'list', columns: [up to 5] }`). Template slides missing from the list (a template that gained a slide) come at the end.
- `templateFor(template_key, settings)` (shared) turns a template plus those settings into the effective `Template` that everything already reads: the grid, validation, import, cell edits, publish, the recap, the share image and the link preview. The recap payload carries `settings`, so `/r` resolves it the same way. Template code is unchanged; hiding a template slide also drops its share-card stat.
- A new sheet template **`custom` ("Your own sheet")**: only `customer_id` and `first_name` are required (`email`, `personal_note` optional), no slides of its own. Its downloadable sheet has a few example columns to show the idea; its sample is "Keepsake", a made-up gift-making site (150 rows, planted errors in rows 6, 31 and 102) that reads like Forevermore's member export. It's the eleventh card in New recap.

**Upload** (extends M2f). The mapping dialog gains **Your other columns**: every header that isn't one of the template's fields, with the type we detected (≥ 80 % of filled cells are numbers or dates, else text; a number with cents anywhere makes the column a decimal), its first value and an **Add** checkbox: added columns are imported and each gets a slide. Checked by default, except columns that look private (emails, phone numbers, addresses, by header or values) and except when a sheet brings more than 12 new columns (the business picks). The dialog now opens when headers need matching *or* the sheet has new columns. A re-upload keeps the recap's own columns that are in the new sheet, or that a slide uses; the rest go. Cells that don't fit a column's type turn red like any other error ("Needs a whole number"), and those rows are skipped at publish: that's what "a sheet that's prepared nicely" means here (a header row, one row per customer, a unique id, one type per column).

**Design: the slide list becomes editable.** Each slide card has its line (as before), its **animation** from the library (the ones that fit its data), the animation's options, its show rule, move up/down, and hide (template slides) or remove (added ones). **Add a slide** at the end of the list: pick a column (the business's own, or a template column) to show its value or a "top X %" for it, a **list** of up to five columns (one timeline slide, each line labelled with its column's name: "Favourite occasion · Anniversary", numbers and dates formatted; a new list starts with three word and date columns, and columns come off and on as chips), or type a new column (name and type) that the grid and the downloadable sheet then include. Every line accepts any of the recap's columns as a placeholder (`{people_gifted}` inside the gifts slide), except the id and email; dates read "February 14, 2026". The draft, Save and Discard work as before; the phone jumps to the slide being edited.

**The scene library.** Our own scenes, data-driven (M2.5 P1): no third-party animation library. Lottie-style players add ~60 KB gzipped to `/r` (budget 150 KB, now ~115 KB) and their animations can't count to a person's number.

| Data | Scenes (first = default) | Options |
|---|---|---|
| Number | Count up (odometer + tokens pile up) · Calendar (days light up across a year, or tear-off pages for a short visit) · Chain (links light up). A decimal only counts up | Count: tokens as shapes, dots, hearts or stars. Calendar: a year or a short visit. All: shown from a minimum value (default 1 for added slides) |
| Text | Big word · Badge | |
| Date | **Calendar page** (new: a tear-off page drops in on the date) · Big word | |
| Top X % of a number column | Top % (100 dots) | shown to the top N % (default 25) |
| Several columns | Timeline: the business recap's milestones, and lists the business makes (up to 5 columns) | which columns, in order |

Defaults by header for added columns: a number named like "…days…" gets the calendar, "…streak…" the chain; text named like "badge", "award", "level", "title" gets the badge.

- **Ranks** for added "top X %" slides: at publish, for every number column, among valid rows, like §4.3 (`data.computed_ranks`), live in the preview. Only the percentage reaches the recap, not the column it ranks by.
- **Share card**: the template's stats (minus hidden slides), then the added slides in order; the first four that show.
- **Download your sheet**: when a recap has its own columns, the sheet download (top bar, empty state) is generated from the recap's columns.
- **The Sheet's column menu** (a chevron on each of the recap's own columns; data, so not in Design): change its type (Number, Decimal, Text, Date; every row is checked again, and when cells won't fit it says how many first) or remove it with its slides. An open Design draft follows the change, so saving it can't bring the old column back.
- **Forevermore's export**: `~/Desktop/Code/Personal/forevermore/supabase/snippets/recap-members-export.sql` (read-only; run in the Supabase SQL editor or `psql --csv`) writes one row per member who published a gift in the year, shaped like the Keepsake sample plus `busiest_month` and `badges_earned`: member_id, first name (profile, else the sign-up name), email, joined, gifts made, people gifted, photos added, times opened, favourite occasion and style (Forevermore's own labels), first gift, latest badge. Checked against the local Forevermore database: all 11 own columns detected with the right types, no errors, the recap plays.

Not in this milestone: per-customer sums from raw exports (one row per order or visit); the sheet stays one row per customer.

Done when: a "Your own sheet" recap imports the Keepsake sample with its columns detected and the planted errors flagged; Design can switch scenes and options, hide, reorder, add (value, top %, new column) and remove slides, live in the preview, saved with Save; a template recap (e.g. the summer camp) takes an extra column as a slide; published recaps show the added slides, the calendar page and heart tokens, and their payload has no id or email; the farm .xlsx check still passes; vitest for detection, `templateFor`, slides and ranks; e2e `custom.mjs`; budgets on a production build.

### M2.8 — An editor, sending from Recap, a livelier recap page (planned and built 2026-10-12; see §12)

The owner's asks (2026-10-12, after trying the dashboard): (1) Design scrolls the whole page into a blank area; only the left side should scroll. (2) Design has too much in one long column: make it a proper editor; the Template section is pointless there (the template is picked in New recap); reorder slides with a drag handle (⠿) and hide them with an eye, without opening each card. (3) Your brand should feel like the same editor. (4) After publishing, sending is left to the business one link at a time: **one button should send everyone their recap** (owner's pick 2026-10-12: Recap sends the emails, reversing "we never email your customers"). (5) The public recap page is a dark page with the phone in the middle: make it playful like the landing, with previous, next and pause.

**1. The overflow.** Screen-reader-only labels (`sr-only`, absolutely positioned) inside Design's scrolling column had no positioned ancestor, so they were placed against the page and stretched it by the list's height (2,642 px at 900). Scroll areas are `relative`; an e2e check asserts the document never scrolls on the workspace tabs and Your brand.

**2. Design as an editor** (`pages/app/c/[id]/design.vue`)

```
┌ top bar ───────────────────────────────────────────────────────────────────────────┐
├ rail 272 ───────────┬ inspector (the selected slide) ─────────┬ stage ─────────────┤
│ Look  [Stories|Paper]│  ⊞ Longest streak        ↑ ↓  👁  🗑     │                    │
│ ☐ Guess first        │  Shows when the number is 3 or more.    │     ┌────────┐     │
│ SLIDES       + Add   │  Line  [Longest streak: {…} days…]      │     │ phone  │     │
│   Cover              │        {first_name} {business} {year} … │     │        │     │
│ ⠿ Active days     👁  │  Animation  [Count up][Calendar][Chain] │     └────────┘     │
│ ⠿ Longest streak  👁  │  Shows from [3]                         │    ‹  3/8  ›  ▶    │
│ ⠿ Habits (hidden) ⊘  │                                          │                    │
│ ALWAYS AT THE END    │                                          │                    │
│   Group photos  2    │                                          │                    │
│   Founder note       │                                          │                    │
│   Last slide         │                                          │                    │
├─────────────────────┴──────────────────────────────────────────┤                    │
│ Unsaved changes                              Discard  Save     │                    │
└────────────────────────────────────────────────────────────────┴────────────────────┘
```

- **Rail** (left, scrolls on its own): Look (Stories · Paper) and Guess first at the top, then the slides as compact rows: the cover, the slides that can move (drag handle ⠿, scene icon, name, eye to hide/show, a small person-crossed-out icon when the previewed person doesn't get it), **+ Add a slide**, then "Always at the end" (group photos with their count, the note, the last slide). Rows drag with the pointer (`useSortable`: rows measured once, transforms only, others slide aside); the handle also takes ↑/↓ from the keyboard and keeps focus. Selecting a row opens it in the inspector and jumps the phone to it. Test hooks: rail rows `[data-slide]`, movable ones `[data-sort-key]`, the inspector `[data-inspector]` (e2e helper `designItem`).
- **Inspector** (middle, scrolls on its own): the selected item only. Header: its name, move earlier/later, Hide/Show, remove (added slides), and a status line ("Slide 3 of 8 in Emma's recap. Shows when the number is 3 or more." / "Emma doesn't get this slide." / "Hidden: nobody gets this slide."). Then the line (`PlaceholderField`: chips for the slide's own column, `{first_name}` `{business}` `{year}` (`{items_label}`) and "Another column…", inserted at the cursor; on a blank line a chip starts from the default wording; "Default" clears it), the count label, the animation as tiles with their hints, and its options (tokens, calendar span, shows from, top %, share-card name, list columns). The cover, photos, note and last slide have their own inspectors; "Add a slide" shows four cards (a column's value, top % by a number, a list, a new column).
- **The Template section is gone** from Design (picked once in New recap; wording is edited per slide). The brand chip moves to the rail's foot.
- The save bar spans rail + inspector. Below 1024 px the phone hides (as before); below 768 the rail stacks above the inspector.

**3. Your brand in the same shell** (`pages/app/brand.vue`): a fixed-height page (no page scroll) with settings rows, each with a line on where it shows (name, logo with a drop zone and Circle | Square, colour with quick picks, a hex field and its contrast, website), and the same phone stage as Design (`PhoneStage`: ‹ slide n/N › ▶). Changing the name, logo or colour takes the phone to the cover. The website isn't shown on recaps; it links the business's name in the emails Recap sends.

**4. Sending from Recap** *(superseded the same day by M2.9: emails go through the business's own email account; Recap never sends from an address of its own. The routes, the log, opt-outs, the email itself and the Share flow below stay; the Resend/Mailpit "from Recap" sender and its settings went.)*

- **Who and what.** Customer recaps only (a business recap is for social media). Rows that are published, valid and have an `email` get one email each; rows without one stay in the links export. Demo (anonymous) sessions can't send: they have no address for replies ("Add your email to send"). Before the first send the business ticks "These are my customers and they expect to hear from me" (`settings.email_consent_at`, like photo consent). People who unsubscribed from this business are skipped.
- **The email** (`shared/utils/email.ts`, used for sending and for the live preview in Share): subject and message per campaign (`settings.email = { subject, body }`, placeholders `{first_name}` `{business}` `{year}`; defaults "{first_name}, your {year} with {business}" and a three-line note), a button "Open your recap" in the business's colour (text colour by contrast), a footer "You're getting this because you're a customer of {business}. Unsubscribe · Sent with Recap". From `"{business name}" <MAIL_FROM>`, Reply-To the owner's account email. `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (Gmail/Yahoo bulk rules).
- **Providers** (`server/utils/mail.ts`, plain `fetch`, so it runs on Cloudflare later): **Resend** when `NUXT_RESEND_API_KEY` is set (batch API, 100 per call, permissive validation so one bad address fails alone), else **Mailpit**'s HTTP API (`NUXT_MAILPIT_URL`; in development it defaults to the local Supabase one, http://127.0.0.1:54424, so every email lands in a local inbox); otherwise sending is off (503 "Email sending isn't set up"). `NUXT_MAIL_FROM` (default `recaps@recap.local`), `NUXT_MAIL_DAILY_LIMIT` (default 2000). Resend never gets reserved addresses (example.com and the like, which the samples use): they fail as "An example address: not sent" instead of bouncing and hurting the sending domain.
- **Routes.** `GET /api/campaigns/:id/send`: whether sending is on, from and reply-to, how many are pending / sent / failed / without an email / unsubscribed, today's count and the limit. `POST /api/campaigns/:id/send { test?, recipient_id?, retry? }`: as the user (RLS; someone else's recap is a 404 first, then a demo session gets 403), sends up to 200 unsent rows per call and returns `{ sent, failed, remaining, waiting }` (`waiting`: cut off by the daily limit until tomorrow); the Share tab calls it until `remaining` is 0 and shows "Sending… n of N". A failed row waits for **Try again** (`retry`), so a bad address can't loop. `test: true` sends the previewed person's email to the owner with "[Test]" in front (30 tests a day). `GET`/`POST /api/r/:token/unsubscribe` (token routes, secret key): the page's details, and the opt-out itself; the POST takes mail apps' one-click POST (JSON back) and the page's form (`page=1`, redirected back to the page), so the button works before JavaScript. `/unsubscribe/:token` is the page (noindex, no Supabase client).
- **Data** (migration `20261012150000_email.sql`): `recipients.emailed_at`, `recipients.email_error` (updatable by the owner); `email_optouts (business_id, email)` (owner reads; only the token route writes, so owners can't resubscribe anyone); `email_sends` (append-only log per email: business, campaign, recipient, kind recap|test, ok, error, provider id, time; **no addresses**, so deleting a recap's rows removes them everywhere; campaign and recipient go to null on delete; owners read and insert, never update or delete) for the daily limit (2,000 ok sends per business per 24 h, until payments in M3 decide who can send; clearing `emailed_at` doesn't reset it) and for bounce handling later. `check:rls` covers all three (14 new cases).
- **Share tab**: Publish → **Send** (who has an address; From "{business}" <MAIL_FROM> · replies go to the owner; subject and message, saved on blur; the customers checkbox before the first send; "Send N emails" with a confirm, "Send a test to me"; after: "194 sent on 12 October." with failed (Try again), unsubscribed and without-an-email counts; a demo session is told to add its email in the banner; then "Everyone else: the links file" with the CSV and a message to copy) → How it's going. Beside it, the email as the previewed person gets it (subject, sender, the HTML in a sandboxed iframe). The publish toast's action is now "Send them" (to Share). The Sheet's `did` column starts with an emailed icon.

**5. The recap page** (`pages/r/[token].vue`): on screens where the phone frame sits in the middle, the page behind it gets the landing's motion in the business's colours: a light tint of the accent, soft blobs that morph (SMIL) and turn, a few hand-drawn lines and floating pieces (all CSS/SVG, no JS; still for reduced motion). Round **‹ ›** buttons beside the frame and a **pause / play** pill under it with the slide count (`RecapPlayer` exposes `paused`, which stops the timer and freezes the scene like a hold). Phones keep the full-screen recap with tap and hold. `/r` stays within its JS budget (§M2.5 P1).

Done when: no page scroll on the workspace tabs or Your brand; Design is the rail/inspector/phone editor with drag, keyboard reorder, eye, add and remove (e2e drags a slide and checks the saved order); Your brand in the same shell; a published sheet's recaps send to Mailpit with the right subject, link, unsubscribe link and headers, a test send, opt-outs skipped, a demo session refused, the daily limit enforced; unsubscribe page works; `check:rls` covers the new tables; the recap page's backdrop and controls (pause freezes, next/prev move) checked in e2e; budgets on a production build. **All met 2026-10-12** (see §12).

Before sending real email in production (M3): a sending domain verified in Resend (SPF, DKIM, DMARC), `NUXT_RESEND_API_KEY` and `NUXT_MAIL_FROM` on it; a bounce/complaint webhook into `email_sends` (and opt-outs for complaints); terms that say the business confirms its customers expect its email; decide whether sending needs a paid campaign (the daily limit is the only brake until then).

### M2.9 — Send from your own email, WhatsApp one tap at a time, plain slide names (planned and built 2026-10-12; see §12)

The owner's asks (2026-10-12, after M2.8): (1) the slide names in Design ("Longest streak", "Items") read like titles the wording has to match; call them Slide 2, Slide 3… and leave the wording free. (2) Forevermore's members won't know an email from "Recap", and mail from Recap's own domain is likely to land in spam: emails must come from the business's own address, and not everyone uses Resend. (3) Pick email or WhatsApp on Share. (4) The email preview broke when its button was clicked (the recap loaded inside the preview); show it in the iPhone frame with nothing clickable.

Researched 2026-10-12 (owner's picks marked ✓):
- ✓ **The business's own account over SMTP.** Nearly every mail service supports it: Gmail and Google Workspace (an app password, since 2-step verification is required), Outlook and Microsoft 365, iCloud, Zoho, a web host's mail, and every sending service (Resend, Postmark, SendGrid, Mailgun, Brevo, Amazon SES). The email goes through their server from their address. Their provider's limits apply (Gmail about 500 a day, Workspace 2,000). Microsoft turns SMTP basic auth off by default for Exchange Online at the end of December 2026 (admins can turn it back on; removal announced for H2 2027), after which Microsoft accounts need OAuth.
- Later: **Sign in with Google / Microsoft** (Gmail's `gmail.send` is a sensitive scope: Google's brand verification and a demo video, no security assessment; fewer than 100 accounts can use it unverified with a warning screen). **Email marketing tools** (push each person's link into Mailchimp, Klaviyo, Kit, Brevo, MailerLite or Beehiiv and send from there; one integration each; the links file covers it by hand today).
- ✓ **Recap never sends from its own address.** No connected email: WhatsApp or the links file. M2.8's Resend/Mailpit sending from `recaps@…` goes away, so Recap's domain never collects spam reports.
- ✓ **WhatsApp, one tap per person.** A real one-button WhatsApp send needs Meta business verification and App Review for Recap (weeks), each business's own WhatsApp Business account, number and approved template, and Meta's per-message fees (marketing templates are always billable). Not now. Instead each person's chat opens with their message and link already typed (`https://wa.me/<number>?text=…`), from the business's own WhatsApp.

**1. Plain slide names.** Design's rail and inspector call the slides that move "Slide 2", "Slide 3"… by their place in the list (the cover is slide 1; group photos, the note and the last slide keep their names: they're kinds of slides, not titles). Under each, its line as this person reads it, filled in ("Longest streak: 5 days in a row."), or as written when this person doesn't get it. Accessible names follow ("Hide slide 3").

**2. Connect your email** (Your brand, and from Share when nothing is connected; `EmailConnectDialog`): pick the provider (presets fill host, port and security, and say what the password is: "an app password" for Gmail with a link, "your API key" with username `resend` / `apikey` for the services, "Other" for anything), the address and the name it comes from (default the business name), the password. **Connect** checks the login with the server and sends a test to that address; only then is it saved. Shows "Sending as Forevermore <forevermore@getforevermore.co> through Resend · Change · Disconnect". One connection per business (`email_connections`), for every recap. Demo sessions can't connect (no account to keep it in). Locally the preset **Local test inbox** is Mailpit's SMTP (127.0.0.1:54425, `smtp_port` in `supabase/config.toml`).
- Passwords are encrypted on the server (AES-256-GCM with `NUXT_SECRETS_KEY`; in development, without it, a key derived from the Supabase secret key) and never go back to the browser.
- The server only connects to SMTP ports (25, 465, 587, 2525) and, outside development, never to private, loopback or link-local addresses (so a form can't make it probe our network).
- Sending: nodemailer over SMTP from the business's address, Reply-To the same unless set, 25 per call (SMTP is slower than an API; the Share tab loops with progress). Limits per connection from the preset (Gmail 450, Workspace 1,900, Outlook.com 250, iCloud 900, Zoho 450, others 2,000 a day; editable), counted in `email_sends` as before. Reserved addresses (example.com and friends, which the samples use) are never sent to a real server, only to a local one.
- On Cloudflare (M3) nodemailer doesn't run: use a Workers SMTP client over `cloudflare:sockets` or send from a small Node worker.

**3. WhatsApp** (Share: **Email | WhatsApp | Links file**):
- Every sheet template gains an optional `phone` column (type `phone`, like `email`: never in the recap payload; header synonyms phone, mobile, tel, telefon, whatsapp, numri). Samples get fictional numbers (UK drama range +44 7700 900xxx) on most rows.
- A message (`settings.whatsapp = { body, country }`, placeholders `{first_name}` `{business}` `{year}` `{recap_url}`; the link is added at the end when it isn't in the text) and a country code for numbers written without one (a leading 0 is dropped). The iPhone frame shows it as a WhatsApp chat with the link preview card.
- **Send next: Ana** opens the next person's chat; a dense list shows everyone with a phone, a Send button each, and "Sent 2 min ago" (`recipients.whatsapp_at`, set when their chat is opened; Undo). The Sheet's `did` column gets a WhatsApp mark.

**4. Previews in the iPhone frame.** Share's right side is a `PhoneFrame`: the email in a mail app (sender, subject, the message, the button; links don't respond) or the WhatsApp chat.

Done when: Design shows Slide N with each line filled in; a business connects an SMTP account (the local Mailpit in e2e), a wrong password is refused with the server's message, the password never reaches the browser, sends go from the business's address and nothing goes out without a connection; WhatsApp opens each chat with the right number and text and marks it sent; previews in the iPhone frame with nothing clickable; `check:rls` covers `email_connections`; vitest for phone numbers, presets, host checks and encryption. **All met 2026-10-12** (see §12; encryption is checked end to end in `send.mjs`, the stored value starts `v1:` and never holds the password).

As built, beyond the plan: the email and the unsubscribe page carry no Recap branding (they come from the business); the connect form is on Your brand (the Email row: "Sending as … through Gmail · up to 450 a day", Change, Disconnect) and opens from Share when nothing is connected; the routes are `GET`/`PUT`/`DELETE /api/business/email` (connect = check the login, send "{name} is connected to Recap" to the address, then save) and `POST /api/campaigns/:id/whatsapp { recipient_id, sent }`; a refused server reads "Can't reach smtp.x: check the server name" / "Use an SMTP port: 465, 587, 25 or 2525" / "The mail server said no: 535 …"; Share keeps the tab you picked (it opens on WhatsApp only when no email is connected and the sheet has numbers); in Design a slide this person doesn't get shows its line with the shared words filled in and their numbers as "…".

### M2.10 — shadcn controls everywhere, a much bigger scene library (planned and built 2026-10-12; see §12)

The owner's asks (2026-10-12): (1) the editor must use the shadcn-vue components throughout: the native dropdowns ("Pick a column…", "Another column…", the column type, the email provider) don't look like the library's Select. (2) The animation library is too slim: offer many more, so every slide has several that fit.

**1. Controls.** Installed (`shadcn-vue add`, `components.json` unchanged, no font key): Select, Checkbox, Switch, RadioGroup, Tabs, NumberField. Tabs are pills and Select menus round like the dropdown menus (§6.4). In Design, Your brand, Share, the connect dialog and the photos: every dropdown is a Select (or a DropdownMenu where it's an action: "Insert another column", "Add a column to the list"), every checkbox a Checkbox (on/off settings like Guess first a Switch), choices a RadioGroup (the animation cards: each a label with its radio, icon, name and hint) or a ToggleGroup (Look, tokens, calendar span, logo shape), Share's Email | WhatsApp | Links file a Tabs, numbers (shows from, top %, port, daily limit) a NumberField, icon buttons Buttons with a Tooltip. No native `<select>` or `<input type=checkbox>` left in the editor.

**2. The scene library: 8 → 27 scenes.** Same rules as M2.5 P1 (transform and opacity only, base style = end state, timing from data, seeded jitter, no Tailwind utility class names; prefixed classes). Each data kind gets several:

| Data | Scenes (first = default) |
|---|---|
| Whole number | Count up · Calendar · Chain · **Tally** (marks in fives, "𝍸 = 10" above 50) · **Fill up** (a glass fills, a wave on top) · **Slot machine** (reels stop one by one) · **Big number** (poster type with outlined echoes) · **Bubbles** (one per unit rises and bobs) · **Gauge** (a needle swings to the number on a dial to the next round number) · **Climb** (a trail up a mountain lights step by step; a flag with the number) |
| Decimal | Count up · Fill up · Slot machine · Big number · Gauge |
| Text | Big word · Badge · **Sticker** (slaps on, peeled corner) · **Typewriter** (letter by letter on a sheet) · **Departure board** (split-flap tiles flip in) · **Neon** (a sign flickers on) · **Letters fly in** (scattered letters assemble) · **Spotlight** (a beam sweeps and lands on the word) |
| Date | Calendar page · **Postmark** (a stamp thumps down) · Big word · Departure board · Typewriter · Neon |
| Top X % | Top % (100 dots) · **Podium** (three blocks rise, theirs is the tallest) · **Leaderboard** (rows slide in, theirs near the top) · Big number · Gauge |
| A list | Timeline · **Receipt** (prints out, one line per column) · **Cards** (dealt one by one) · **Checklist** (items tick off) |

- A "top X %" slide is marked (`SlideDef.top`), so picking Podium for it doesn't turn it into a plain number.
- Design shows the animations as cards (RadioGroup), grouped by what fits the slide; the phone plays the picked one at once.
- Weight on `/r`: the new scenes are plain components like the old ones (~0.8 KB gz each); the budget stays ≤ 150 KB (M2.5 P1). If it doesn't, they load as one chunk after the first slide (only when a recap uses them).
- Checks: vitest (every scene has timing, every data kind lists only scenes it can draw, cleanSlides keeps the new keys); e2e: every scene renders for a real slide in Design, its reduced-motion end state shows its value, and a published recap that uses them plays at 60 fps (budgets on a production build).

As built: 13 new components in `app/components/recap/scenes/` (SceneTally, SceneFill, SceneSlots (the count scene's odometer in windows), SceneBigNumber, SceneBubbles, SceneGauge (scale to `niceMax()`), SceneClimb, SceneLetters (typewriter, flap, neon, scatter, spotlight: one row of letters, the scene name picks the look; the word is also in screen-reader text), SceneSticker, ScenePostmark, ScenePodium, SceneLeaderboard (brackets Top 1 %… Everyone, theirs slotted in), SceneList (receipt, cards, checklist)); helpers `niceMax`, `tallyPlan`, `letters` in `shared/utils/scenes.ts`. They load with the rest (no lazy chunk needed): `/r` JS 122 → 128.5 KB gz, first slide 752 ms, every scene 60 fps at 4× CPU. Design's animation cards are a RadioGroup of labels (icon, name, its radio, the hint); Look, tokens, calendar span and logo shape use `Segmented` (`components/workspace/Segmented.vue`, shadcn ToggleGroup as a pill); Guess first and the share-image photo are Switches; consents and the mapping dialog's "Add" are Checkboxes; every dropdown (add a slide, column type, mapping, email provider) is a Select, actions ("Another column", "Add a column" to a list) are DropdownMenus; numbers are NumberFields; icon buttons are Buttons with Tooltips; Share's channels are Tabs; New recap's kinds and templates are a RadioGroup.
- Found on the way: the installed shadcn-vue style marks state with `data-checked`, `data-active`, `data-open`…, but reka-ui 2.11 sets `data-state="checked"` etc., so checked boxes, switches, radios, active tabs and menus' open animations never showed. `main.css` now maps those variants to either attribute (`@custom-variant data-checked …`).
- Nuxt's dev server keeps serving a component's old stylesheet link after its `<style>` block is removed (404 in the console); restart `pnpm dev` after removing one.

### M2.11 — The landing at 100, airtight search, unsaved edits, bounces (planned and built 2026-10-12; see §12)

The owner's asks (2026-10-12): the small gaps left after M2.10 except Microsoft 365 sign-in, "especially the landing page scores"; the landing "airtight for SEO"; "100% out the gate".

**1. Lighthouse 100 on the landing, mobile and desktop.** Before: mobile performance 93 (FCP and LCP 2.6 s on Lighthouse's simulated 4G; the headline's render waited on the CSS file and then on 300 KB of scripts the page doesn't need to paint). Changes:
- `/` is **prerendered** (`routeRules`): one static file, served compressed (Nitro's `compressPublicAssets` makes `.br`/`.gz`; Cloudflare compresses on its own), no server work per visit.
- `modules/landing-first-paint/` rewrites that HTML at build time (`prerender:generate`): the stylesheets inline (`url(../_fonts/…)` made absolute), no `modulepreload` or payload preload links, the two latin fonts it declares preloaded (Outfit's latin file and the Caveat subset), and the app's entry `import()`ed only after the largest paint (a `largest-contentful-paint` observer, then a frame; `load` + 2 s where browsers don't report it, at once in a background tab). The page shows everything without scripts; scripts add the playing phone, the sticky button and scroll effects. It fails the build if Nuxt changes the entry tag.
- The hero's lede no longer fades in (it became the largest paint 120 ms later than the headline, after the scripts had started); the headline and lede are there in the first frame, the button and price still rise.
- Result (Lighthouse 12.8.2, production build, several runs): **mobile 100 / 100 / 100 / 100** (FCP 0.8 s, LCP 1.4–1.5 s, TBT 0, CLS 0), **desktop 100 / 100 / 100 / 100** (FCP 0.2 s, LCP 0.4 s). Recap pages are untouched (`/r` budgets as before).

**2. Search.**
- `runtimeConfig.public.siteOrigin` (default `https://highreel.app`, `NUXT_PUBLIC_SITE_ORIGIN`) for canonical links, og:url, og:image, the sitemap and robots.txt: the landing is built once, and local or preview hosts mustn't compete with it. `useCanonical(path)` / `siteHref(path)`.
- The landing: canonical, a 70–160 character description, og (site name, locale, image size/type/alt), Twitter card with alt, and JSON-LD (`@graph`: Organization with logo, WebSite, SoftwareApplication with the three prices as Offers, FAQPage with the four questions exactly as shown). No ratings (we have none; not invented). One `h1`.
- `/example/:key`: canonical, og tags, "← highreel" (was "← recap").
- `robots.txt` (prerendered): `Disallow: /app`, `Disallow: /api/`, `Allow: /api/r/`, the sitemap. `sitemap.xml` (prerendered): the landing and the five examples, `lastmod` = build day.
- `X-Robots-Tag: noindex` on `/login`, `/confirm`, `/app/**` (besides `/r/**`, `/unsubscribe/**`, `/api/r/**`).
- Icons (`scripts/icons.mjs`): `icon.svg` and `favicon.ico` (16/32/48) are a blue scallop (the landing's shape) with a white "h" from Outfit Bold's outline; `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` the "h" on a full blue square (safe for masks); `site.webmanifest`. Linked app-wide.
- The landing's copy said "You export a CSV … send it with the email tool you already use" and "Leave emails out": out of date since M2.9. Step three and two questions now say recaps go out from the business's own email address or WhatsApp (or the links file), and that an email or phone column is only needed to send from here and never appears in a recap.

**3. Unsaved Design edits.** They survive switching tabs (as before); leaving the recap (the home, Your brand, another recap, back/forward) with edits opens "Save your design changes?": Keep editing · Discard changes · Save and leave. Closing or reloading the page gets the browser's own prompt. Signing out, or a session that ended (a 401 sends you to sign-in), isn't held up: nothing could be saved after it (`session.mjs` caught the dialog blocking that redirect). Saving moved into the store (`ws.saveDesign()`), used by Design's Save too.

**4. Bounces and complaints.** Recaps go out through the business's own account (M2.9), so bounces hurt *their* sending: providers limit accounts with many. What Highreel can see is the SMTP conversation, not the business's inbox. So (`server/utils/bounces.ts`):
- **Before sending** each batch: a domain one keystroke from a big provider (gmial.com, gmail.con, hotmial.com…; real near-neighbours like mail.com, ymail.com, yahoo.ca allowed) is held back ("Looks like a typo of gmail.com: fix the address in the Sheet"); a domain with no mail server (NXDOMAIN, a null MX, no MX and no address record) is a bounce. DNS that doesn't answer holds nobody back. The local test inbox skips DNS for the samples' example.com.
- **The server's answer** (nodemailer's error): 5.1.x (except 5.1.7/5.1.8, the sender), 5.2.1, 5.4.1, 5.4.4, or a 5xx to RCPT TO = **bounce**; 5.2.x and other 4xx = **try again**; a login error, 5.7.x (policy, spam), 5.4.5 / 4.7.x (quotas, throttling), 5.3.x/5.6.x (the message), or the server unreachable = **stop the run**: nothing after it is tried, it stays pending, and Share shows the server's words ("Your mail server said: 550 5.4.5 Daily user sending limit exceeded").
- Bounced addresses go into `email_bounces` (per business, like opt-outs; the owner reads and inserts, nobody updates or deletes; migration `20261012190000_email_bounces.sql`) and are skipped in every recap of the business from then on. A row's `email_error` keeps the reason; the Sheet's mail mark turns red with "Not emailed: …". Editing a row's email clears its error (a new address gets a fresh try).
- **Pause**: a batch where 5 or more (and at least a fifth) bounce stops the run: "6 of the last 6 addresses bounced. Check the email column in your Sheet, then send the rest."
- Share: "N bounced" next to "didn't go out" and "unsubscribed", with a tooltip; the send toast says what bounced, what didn't go out and why it stopped.
- **Complaints**: the one-click `List-Unsubscribe` (M2.8) is what Gmail and Yahoo's bulk-sender rules ask for, and opt-outs apply at once to every recap of the business. A "spam" click that doesn't unsubscribe isn't visible to us (no feedback loop reaches a personal mailbox), and neither are bounces that come back later as a message in the business's inbox: reading their mail (IMAP) would cover those; not built.
- On Cloudflare (M3) the DNS checks need `node:dns`, which Workers don't have; they run with the SMTP sender wherever that runs (M2.9's note: a Node worker or a Workers SMTP client).

Done when: Lighthouse 100 in all four categories on the landing, mobile and desktop, on a production build, run more than once; budgets pass; canonical, structured data matching the page, robots.txt, the sitemap, icons and noindex checked in e2e; leaving Design with edits asks (e2e); typos held, bounces remembered and skipped, retries, a stop in the server's words and a pause, against a fake SMTP server (e2e) and in vitest; `check:rls` covers `email_bounces`. **All met 2026-10-12** (see §12).

### M2.12 — Terms and privacy (built 2026-10-12; see §12)

The owner's details (2026-10-12): legal name **HighReel**, contact **hello@highreel.app** (`app/data/legal.ts`, with the "last updated" date). Two pages, `/terms` and `/privacy`, written for how Highreel actually works, in plain words:
- **Terms of service**: who we are; what it does (the demo too); accounts (businesses, 18+, sign-in links); your data and your customers (yours; we process it only to run Highreel; you need the right to use it; no special-category data, ID numbers, card details or passwords; photo permission, parents' consent for children; what a recap shows and never shows); sending (from your own account, you are the sender, anti-spam rules, unsubscribes can't be overridden, we may hold back typos and bounces and stop or pause a send; WhatsApp sent by you; the SMTP password encrypted); fair use; **prices, payment and refunds** (one price per campaign by list size, no subscription, payments through Whop, price changes don't touch paid campaigns, **a full refund within 14 days if no recap from the campaign has been sent or shared**, after that fixes, refunds only where the law requires or we failed to deliver); what's ours; changes and availability (30 days' notice before removing something relied on or closing); ending (account deletion by email); warranties and liability (capped at 12 months' fees, no indirect losses); **the laws of the Republic of Kosovo, courts in Prishtina**; changes to the terms (14 days' notice by email for ones that matter); contact.
- **Privacy policy**, for both sides: the short version; controller for account data, processor for customer data; Kosovo's Law No. 06/L-082 and the GDPR; what we collect from businesses and on which basis; the demo (deleted after 30 days if never kept); customer data used only for their recaps (not combined, sold or used to train AI); for people who got a recap: what the page shows, what we record (views, saves, shares, button taps: no IP, no cookies, no third-party scripts), link previews, emails from the business with one-click unsubscribe, bounced addresses remembered, rights through the business or us; cookies (sign-in only, a display setting; none for recap or home page visitors, so no banner); providers (Supabase, Cloudflare, Whop, the sign-in email provider; SCCs where data leaves Kosovo and the EEA); security; retention (deleting a campaign deletes its rows, recaps and photos at once; opt-outs and bounces per business while the account exists; accounts within 30 days of a request; backups expire within 30 days); rights and the Information and Privacy Agency; children; **data processing terms** (Article 28: instructions, confidentiality, security, subprocessors with notice, assistance, breach notice, deletion, information); changes and contact.
- `LegalPage` (`components/legal/`): the landing's look, one 44 rem column, "On this page" with numbered anchors, footer with Terms · Privacy · the address. Text links in a deeper blue (#3B4FE6) than the buttons' so they pass 4.5:1 on the grey boxes (Lighthouse caught 4.36:1).
- Prerendered and rewritten like the landing (`FIRST_PAINT_ROUTES`), canonical links and descriptions, in the sitemap. Linked from the landing's footer (which said "Terms and privacy: at launch") and the sign-in page ("By continuing you agree to our terms and privacy policy"). The landing's Organization data gains `legalName` and `email`.
- Lighthouse on a production build: `/terms` and `/privacy` **100 / 100 / 100 / 100** on mobile and desktop; the landing still 100 everywhere.
- What the policy promises that launch must keep true: delete demo sessions never kept after 30 days (M3 below), delete accounts within 30 days of a request, name the sign-in email provider once chosen, and turn off Cloudflare's Email Address Obfuscation (it rewrites the mailto links with a script).
- **Revised the same day (owner's review):** the pages call what each customer gets a **highlight reel**, never a "recap" (`legal.mjs` checks the word stays out); no "Made in Kosovo" in their footer (the landing's footer keeps it for now); photos and children cut to one line each: the business adds only photos it's allowed to share ("many camps, clubs and schools already collect a photo release"), and is responsible for reels about children like any customer data, a parent can ask for one to be taken down. The owner asked whether photo consent needs that much attention for group photos: it doesn't need per-person work, but a recognisable photo is personal data, so one line keeps the responsibility with the business (and the in-app photo checkbox stays). The owner confirmed the two promises: demo data never kept is deleted after 30 days, accounts within 30 days of a request.
- Not legal advice: written from the product's behaviour, worth a lawyer's read before the first paid campaign. The refund rule and Kosovo law/Prishtina courts were defaults picked here; change them in `terms.vue` (and the date in `data/legal.ts`) if the owner decides otherwise.

### M2.13 — Save any slide as an image (built 2026-10-12; see §12)

The owner's ask (2026-10-12): "Save image" on the last slide only saved the summary card. Instead, open a picker: shrink the story up, bring a sheet up from the bottom with every slide as a card, let people tick several and save them together; a nice hover effect on laptops to see which card is which; on phones tap to tick and press-and-hold to see it bigger.

- **Opening**: "Save image" (`RecapShare`, `data-save-image`) emits `pick`; `RecapPlayer` sets `picking`: the story (now inside a `.stage`) moves up and shrinks to 55.5 % (`translateY(2.6cqh) scale(0.555)`, rounded, shadowed) over the business's dark tone deepened (`.pick-bg`), the progress bar fades, and `RecapSaver` slides up from the bottom (39cqh). Tapping the shrunken story, Escape, × or moving to another slide closes it; focus goes back to Save image. Tap navigation and arrow keys are off while it's open.
- **Cards**: every slide in order, each a `RecapStill` (the slide's end state, `is-reduced`, count-ups at their final value, no guess prompt, no status-bar inset) in a 9:16 card with a round tick and its number (★ for the summary card, whose card is its drawn share image). The summary card is ticked to start with; "Select all" / "Clear"; ticked cards get an ink ring and a filled tick.
- **Laptops** (`hover: hover` and `pointer: fine`): the card under the pointer rises 1.4cqh and grows 12 % from its foot, its two neighbours 5 % (a dock, CSS `:hover + .card` and `:has(+ .card:hover)`), a light sweeps across it, and the shrunken story shows that slide (`peek`, a `RecapStill` over the stage). Keyboard focus peeks too.
- **Phones**: a tap ticks or unticks; press and hold (380 ms, a tiny vibration where supported) shows the slide in the story until you let go, and never ticks; moving the finger (scrolling the strip) cancels it.
- **Images**: each ticked slide is drawn while the viewer chooses, one at a time: the summary card with `renderShareImage` as before, the others by rendering a `RecapStill` at 360×640 in a hidden host and capturing it with **modern-screenshot** (`domToBlob`, scale 3 → 1080×1920 PNG, fonts and the logo embedded). The library (14 KB gz) is imported only when the picker opens; `/r` initial JS went 129.4 → 132.0 KB gz for the picker itself. The button reads "Getting them ready…" until every ticked image exists, then "Save 3 images", then "Saved".
- **Saving**: on touch devices with file sharing, one `navigator.share({ files })` inside the tap (iOS: "Save 3 Images" to Photos); elsewhere one download per image, 250 ms apart. Names: the summary card keeps `business-2026-first.png`, slides add their number (`…-03.png`). One `save` event per save (the business's "saved" column).
- **Found on the way**: modern-screenshot read the literal `url(%23n)` inside the grain backdrop's SVG data URI as a file and requested `/r/%23n` (404); the data URI now says `url%28%23n%29` (same SVG once decoded). The first build scrolled the whole story frame when centring the ticked card (`scrollIntoView` while the sheet slid up); it sets the strip's `scrollLeft` instead, and the capture host is anchored at the bottom so it can't make the frame scrollable.
- **Calmer hover (owner, same day: "a bit too snappy… looks a bit jittery")**: cards ease over 560 ms with no overshoot (`--hover-ease`, a 40 ms delay), ticks and rings 260–360 ms, the light sweep 1.2 s; the reel above switches only after the pointer rests on a card for 140 ms and keeps the last one through the gaps (260 ms), and one preview crossfades into the next (300 ms).
- **Layout B tried and dropped (same day)**: the owner compared a picker docked as a centred 880 px panel on the page, with the whole reel shrunk above it (`?picker=page`), and kept the sheet inside the frame; B's code was removed. Then: cards sat too close once one swelled or got its tick ring, so the strip's gap went from 2.6u to 4.8u (room for a hovered card's +6 % a side next to a neighbour's +2.5 %, and for two rings side by side; `saveimages.mjs` measures it).
- **Checks**: `saveimages.mjs` (17 steps, laptop, phone and reduced motion: cards keep clear of each other when hovered or ticked; every slide a card with the summary ticked, the story shrinks, dock hover and peek, three 1080×1920 PNGs with real pictures and the right names, the save counted, Escape and a tap on the story close it, tap ticks, hold peeks without ticking, the phone's share sheet gets both files, the story and the sheet don't overlap, nothing animates with reduced motion; also on a production build); `recap`, `engagement`, `paper`, `media` save through the picker (`saveSummaryImage` in `lib.mjs`); budgets.

### M2.14 — Off Supabase: database, files and sign-in on Cloudflare (planned 2026-10-12)

The owner's ask (2026-10-12): Cloudflare already has the domain (and hosts Forevermore and the portfolio); use it for the rest too: database, file storage, sign-in. Decided after comparing the two (2026-10-12):
- **Cost.** Workers Paid ($5/month) is a minimum per Cloudflare account, and Forevermore's account has paid it since 2026-07-24. Highreel goes into that account and adds no base fee; its usage shares the account's included amounts (10 M Worker requests and 30 M CPU-ms a month; D1 25 B rows read, 50 M rows written, 5 GB; R2 10 GB with free downloads; Email Sending 3,000 emails; static files are free). Supabase would have meant Pro at $25/month once live: the free plan pauses a project after a week without activity (every shared reel breaks until someone restores it, and Highreel is seasonal), includes 5 GB of downloads a month (one 10,000-customer campaign with two photos is about 10 GB) and a 500 MB database.
- **Given up, and made up for.** RLS (the database refusing other businesses' rows) → one data layer that scopes every query to the signed-in user's business, and an API-level isolation check (P1). Postgres running many queries at once → D1 runs one query at a time per database, so heavy reads go through narrow indexes (P1). Supabase Auth → Better Auth, a library running inside our Worker with its tables in D1 (P3).
- **Better than today.** The browser no longer talks to the database at all: today a session can call PostgREST directly within RLS (skipping our validation, writing its own send log); afterwards every read and write goes through our routes. Photos and logos come from our own domain (no `*.supabase.co` request on reels). Scheduled jobs are built in. Local development needs no Docker.
- **Nothing is live**, so no data moves: local data is disposable (`supabase db reset` wipes it anyway) and no hosted Supabase project exists.
- **Not chosen:** NuxtHub (adds Drizzle and its own conventions; Nitro 2.13 already emulates the bindings in dev), Hyperdrive + a hosted Postgres (a second vendor again), a database per business on Durable Objects (the next step if one database ever gets too busy, not needed at this size), nuxt-auth-utils (no demo sessions or email links built in).

**Target: one Worker, `highreel`, in the Forevermore account.**

| Piece | Today | After M2.14 | Binding / config |
|---|---|---|---|
| Hosting | planned: Cloudflare Pages | Workers with static assets, Nitro preset `cloudflare_module` (Pages has no Cron Triggers or Workers Logs) | `wrangler.jsonc` at the root |
| Database | Supabase Postgres + RLS | D1 `highreel`, EU jurisdiction, Time Travel keeps 30 days | `DB` |
| Files | Storage bucket `media` + policies + signed URLs | R2 `highreel-media`, EU jurisdiction, private; our own signed URLs | `MEDIA` |
| Sign-in | Supabase Auth: email link, demo, Google (off) | Better Auth 1.7: magic link, anonymous, Google (off) | `/api/auth/*` |
| Bot check on sign-in | planned: Supabase's CAPTCHA | Turnstile through Better Auth's captcha plugin | `NUXT_TURNSTILE_*` |
| Sign-in emails | planned: custom SMTP | Email Sending (beta) from hello@highreel.app; SMTP to Mailpit locally | `EMAIL` |
| Demo cleanup, expired sessions, account deletions | planned: a job somewhere | Cron Trigger → Nitro tasks | `triggers.crons` |
| Highlight reel emails | the business's SMTP via nodemailer | unchanged: nodemailer on Workers with `nodejs_compat`; port 25 is blocked (providers use 465/587) | — |

Each phase is sized for one session. P0 comes first because it can change the rest.

**P0. Prove the runtime (a spike, before rewriting anything).**
- `nitro.preset: 'cloudflare_module'`, `wrangler` and `@cloudflare/workers-types` as dev dependencies, `wrangler.jsonc` with `nodejs_compat`, `DB`, `MEDIA`, `EMAIL` and assets from `.output/public`. `corepack pnpm dev` still serves on 3040, with `event.context.cloudflare.env` from Nitro's built-in emulation (wrangler's `getPlatformProxy`, state in `.wrangler/state/v3`).
- resvg (carried from M3): load the wasm with an ESM import (the preset sets `wasm.esmImport`) instead of `serverAssets`; link previews render on `wrangler dev`.
- Gaps in our code on Workers: `node:dns` `lookup` isn't implemented there (`server/utils/mail.ts`, the private-address guard): resolve with `resolve4`/`resolve6` (DNS over HTTPS) instead. Check that `Resolver.resolveMx` in `bounces.ts` works (fallback: Cloudflare's DNS-over-HTTPS JSON API with `fetch`). nodemailer runs on `nodejs_compat` per its README (watch its unprefixed built-in imports, nodemailer issue #1621); certificate checks can't be turned off on Workers.
- `compressPublicAssets` off for this preset (Cloudflare compresses; `.br`/`.gz` files would only be extra assets). Check that `routeRules` headers reach the generated `_headers` for prerendered pages.
- Big sheets on the real runtime (128 MB of memory per isolate; 30 s of CPU by default, up to 5 min): on `wrangler dev`, import 10,000 and 50,000 rows, load the grid, publish, export, open Share's send status. Note memory and time; any route that fails gets paged (grid rows in pages, import in chunks) in P1.
- A preview deploy (`wrangler versions upload`) with D1 and R2 bound: a real SMTP account on 465 and on 587 (STARTTLS) from the Worker, a link preview, and one Email Sending message once highreel.app is onboarded.
- Done when: all of the above work, or each gap has a decided fix written into this section.

**P1. The database on D1, isolation in code.**
- **Schema:** `migrations/0001_init.sql` (D1's default folder; `wrangler d1 migrations apply highreel --local|--remote`), translated from the nine Supabase migrations; Better Auth's tables come in P3 as `0002_auth.sql`.
  - uuid → `text` from `crypto.randomUUID()` in code (`requireUuid` stays). Better Auth's user ids aren't UUIDs: `businesses.owner_id text not null unique references user(id) on delete cascade`.
  - timestamptz → ISO text, always written as `new Date().toISOString()` (or the same format from `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` as a default) so they sort and compare as text.
  - jsonb → `text` with `check (json_valid(…))`; the data layer parses and stringifies. `errors <> '{}'` → a generated column `has_errors`.
  - booleans → integer 0/1. Check constraints, cascades, the partial unique index (`where token is not null`) and `token unique` carry over (D1 enforces foreign keys).
  - The `campaigns.updated_at` trigger → the data layer sets it on every campaign update.
  - The SQL functions become queries in the data layer: `record_recap_event` (one UPDATE with CASE; its change count says whether the token exists), `bulk_update_recipients` (`UPDATE … FROM json_each(?)`), `campaign_stats`, `recent_activity`, `campaign_sums` (`json_each` with `json_type in ('integer', 'real')`). Watch: SQLite's `max(a, b)` is NULL if either is (Postgres's `greatest` skips NULLs); `count(*) filter (where …)` works.
- **D1's limits shape the writes.** 100 bound values per statement → inserts and bulk updates pass one JSON parameter per statement (`insert … select … from json_each(?)`, up to about 1 MB of rows; a single string is capped at 2 MB). The statements of one change go in one `batch()`, which is a transaction, so import (clear + insert) and publish become all-or-nothing (today they're chunked). There are no interactive transactions. PostgREST's 1,000-row pages go away.
- **One query at a time per database.** The home's counts read a covering index (something like `recipients (campaign_id, has_errors, token, view_count, first_viewed_at, saved_at, shared_at, cta_clicked_at, updated_at, first_name)`, confirmed with `EXPLAIN QUERY PLAN`) so they never touch the wide JSON columns. Send and its status read only the columns they need (id, token, has_errors, emailed_at, email_error, `json_extract(data, '$.email')`), never whole rows. `perf-home.mjs` (10 × 10,000 rows) keeps its 300 ms budget on local D1, and is run again against the deployed database.
- **Isolation, which replaces RLS (the rule that matters most):**
  - `requireUser(event)` returns `{ userId, businessId, anonymous, email }`, finding or creating the business (today's `ensureBusiness`).
  - All SQL lives in the data layer: `server/utils/db.ts` and its helpers for the workspace, `recap.ts` and `unsubscribe.ts` for token routes, the auth config, the cleanup tasks. Routes never write SQL.
  - Every workspace query takes the business id and filters by it: `business_id = ?` on campaigns and the email tables, a join through `campaigns` for recipients, on UPDATE and DELETE too (`… where id = ? and campaign_id in (select id from campaigns where business_id = ?)`). The queries that leaned on RLS with no filter at all (the business itself, the campaign list, `loadWorkspace`, the home's three functions) get one.
  - What RLS's column grants did becomes "there's no function for it": nothing in the workspace writes the counters, rewrites or deletes the send log, writes opt-outs, or edits or clears bounces.
  - Token routes look rows up by token only and never take a business or campaign id from the request.
  - Checks: `corepack pnpm check:isolation` replaces `check:rls`. Two demo sessions against the dev server; B calls every workspace route in §7.3 with A's ids and gets a 404 with nothing changed. Every rule `check-rls.mjs` covers today has an API-level twin, plus: no route accepts counter fields, and the send log can't be filled or cleared through the API. A vitest reads the data layer's SQL and fails when a workspace statement touching a business-owned table has no business filter.
- Done when: every route works on local D1 and returns the same JSON shapes; vitest, typecheck, `check:isolation` and `perf-home.mjs` pass; the server no longer imports supabase-js.

**P2. Files on R2.**
- The same keys as today: `{business_id}/logo/{uuid}.{ext}` and `{business_id}/{campaign_id}/{uuid}.{ext}`.
- Upload: `POST /api/media` (a session; `kind` logo or photo, and for a photo a `campaign_id` of the user's business). The server checks the file by its first bytes (PNG, JPEG or WebP; logos stay PNG for the link-preview renderer) and its size (≤ 5 MB), picks the key and returns the path. `DELETE /api/media` takes paths inside the business's folder. `useWorkspace` and Your brand swap their Storage calls for these two; the rest of their flow stays.
- Reading: `signMedia()` keeps its signature and signs `/media/{path}?exp=…&sig=…` (HMAC-SHA256 with a key derived from `NUXT_SECRETS_KEY`; `exp` rounded up to the hour, so an image keeps one URL for a while and caches). `server/routes/media/[...path].get.ts` checks the signature and expiry and streams the object from `MEDIA` with its type and a `Cache-Control` that ends at `exp`. Workspace links last 1 h and reel links 24 h, as now.
- Link previews read the logo from `MEDIA` directly; Duplicate copies photos with get + put; deleting a campaign lists its folder and deletes up to 1,000 keys per call.
- Done when: `media.mjs` passes with `/media/` URLs (a link taken before a delete returns 404 afterwards, instead of listing Storage), along with Duplicate, delete and the logo; `check:isolation` covers uploading or deleting in another business's folder and a tampered signature.

**P3. Sign-in with Better Auth.**
- `server/utils/auth.ts` builds Better Auth per request with the `DB` binding as its database (Better Auth 1.7's Kysely adapter has a D1 dialect built in; no transactions there either), `secret` from `NUXT_AUTH_SECRET`, `baseURL` from `siteUrl`, `trustedOrigins` (the site and localhost:3040), cookie prefix `highreel`, sessions of 30 days (today's cookie age) refreshed daily, and **no cookie cache**: every request checks the session in D1, so a deleted user or a cleaned-up demo gets the same 401 `requireUser` gives today. Its route: `server/api/auth/[...all].ts`.
- Plugins:
  - `magicLink`: the link is valid for 1 hour and lands on `/confirm`.
  - `anonymous`: demo sessions, with `emailDomainName: 'demo.highreel.app'` (never emailed).
  - `captcha` with `cloudflare-turnstile` on `/sign-in/anonymous` and `/sign-in/magic-link`.
  - Rate limits stored in D1 (memory doesn't last on Workers; the plugin turns limits off in development unless enabled), plus at most 5 links per address an hour.
  - Google as a social provider, wired and off as today (`NUXT_PUBLIC_AUTH_GOOGLE`).
- Tables: generated with Better Auth's CLI (`npx auth@latest generate`) against a throwaway SQLite config and committed as `migrations/0002_auth.sql`; regenerate when plugins change.
- Keeping a demo: today the banner adds an email to the same anonymous user. With Better Auth the email link signs in a new user and calls `onLinkAccount({ anonymousUser, newUser })` before it deletes the anonymous user (checked in 1.7.7's source). That hook moves the business (`update businesses set owner_id = ? where owner_id = ?`); files keep their keys, since they're by business. If the address already has an account, the banner says so before sending (as today) and the demo stays. If one slips through anyway (a race), the account keeps its own business and the demo is left to the cleanup job.
- Browser: the `better-auth/vue` client with the anonymous and magic-link plugins, loaded lazily the way `supabase-lazy.client.ts` loads Supabase today (never on `/`, `/r/*`, `/example/*` or `/unsubscribe/*`; `budgets.mjs` guards `/r`). A global middleware sends `/app/**` without a session to `/login?next=…`, and `/confirm` continues to `next` (replacing the module's redirect cookie). `useApi`'s 401 handling and sign-out use the new client. Login: an invisible Turnstile widget, email link, demo (also `?demo=1` from the landing), Google when on; Turnstile's test keys locally (they always pass).
- Sign-in emails: one small email ("Your Highreel sign-in link", a button, a plain-text twin) sent through `EMAIL` (Email Sending, from `Highreel <hello@highreel.app>`) in production, and through SMTP to Mailpit when the binding is missing (development), so another provider is a config change if the beta lets us down.
- Remove `@nuxtjs/supabase`, `@supabase/supabase-js`, and the `#supabase-client-plugin` alias and `app:resolve` hook in `nuxt.config.ts`.
- Done when: in e2e, the email link, the demo, keeping a demo (work and files survive, the anonymous user is gone), sign-out, an expired session and a deleted user (`session.mjs`) all pass, and both sign-in endpoints refuse a request without a Turnstile token.

**P4. Scheduled jobs.** A daily Cron Trigger (03:00 UTC) runs Nitro tasks (`experimental.tasks`, `scheduledTasks`):
- `cleanup:demo` (the privacy policy's promise): anonymous users created more than 30 days ago lose their business's files (its R2 folder), then the user (business, campaigns, rows and logs cascade). A few hundred per run, so a run stays inside the Worker's limits.
- `cleanup:auth`: expired sessions, verification tokens, old rate-limit rows.
- `accounts:delete` (the policy's 30 days): the owner adds the address to an `account_deletions` table with `wrangler d1 execute highreel --remote`, and the job deletes that account the same way and marks the request done. No admin route.
- Done when: an e2e check backdates a demo user and runs the task through Nitro's dev task endpoint; its rows and files are gone, and a fresh demo is untouched.

**P5. Tests and tooling.**
- Local stack: `corepack pnpm dev` (D1, R2 and email emulated); `corepack pnpm db:migrate` and `db:reset` (wipe `.wrangler/state/v3`, migrate again); Mailpit on its own (`brew install mailpit`; `corepack pnpm mail` runs it on the same ports, 54424 for the inbox and 54425 for SMTP, so the "Local test inbox" preset and the tests don't change).
- e2e: `lib.mjs` gets an `sql()` helper (`wrangler d1 execute highreel --local --json`) for what tests did through PostgREST or the Auth admin API: `session.mjs` (delete the newest user), `send.mjs` (fill and clear the send log, read the stored ciphertext), `bounces.mjs`, `media.mjs`. The Better Auth cookie replaces `sb-…-auth-token`. All 30 checks pass.
- Production-like runs (budgets, Lighthouse, `record.mjs`) use the built Worker on `wrangler dev` or a preview URL instead of `node .output/server/index.mjs`; "served compressed" is checked on the preview, where Cloudflare compresses. Landing, terms and privacy stay at 100 everywhere; `/r` JS stays ≤ 150 KB gzipped.

**P6. Docs, legal, cleanup.**
- Privacy policy: the providers become Cloudflare (hosting, database, files, sign-in emails and the sign-in bot check; data stored in the EU), Whop, and Google once its sign-in is on; Supabase goes. This also settles M2.12's "name the sign-in email provider". Update `LEGAL_UPDATED` and `legal.mjs`'s list of names.
- Rewrite the CLAUDE.md rules for the new stack: the isolation rule (data layer, business filter, `check:isolation`); bindings instead of the secret key; new tables need their business filter and an isolation check (instead of policies and grants); the commands. Rewrite SPEC §7 (stack, code layout, API with `/api/auth/*`, `/api/media` and `/media/*`, data model, privacy and security, local development) and the M3 list.
- Delete `supabase/`, the Supabase keys in `.env.example` (add `NUXT_AUTH_SECRET` and the Turnstile keys), stop this project's local Supabase. Other projects' local Supabase (forevermore, trueroute on 543xx) is untouched.

**P7. Deploy (part of M3's launch).**
- Create D1 `highreel` with `--jurisdiction=eu` and R2 `highreel-media` in the EU jurisdiction (neither can change later), apply the migrations remotely, set the Worker's secrets (`NUXT_SECRETS_KEY`, `NUXT_AUTH_SECRET`, the Turnstile secret, Google's later), make a Turnstile widget for highreel.app, onboard highreel.app for Email Sending (its DNS records), forward hello@highreel.app to the owner with Email Routing (it's the contact address on the terms), point the custom domain highreel.app at the Worker, turn Workers Logs on (logs carry no addresses or names), turn Email Address Obfuscation off (M2.12).
- Done when, on highreel.app: a demo, an email sign-in, a published reel with a photo opened on a phone, its link preview, a test email through a real business account, and the cleanup job's first run in the logs.

**Risks to watch.** Email Sending is in beta (the SMTP fallback is a config change). D1's one query at a time (P1's indexes and narrow reads, `perf-home.mjs` on the deployed database). Workers' memory with 50,000-row sheets (P0 measures it). Better Auth is a library we upgrade ourselves: pin the version and read its changelog before updating.

### M3 — launch

~~Product name + domain~~ (done 2026-10-12: Highreel, highreel.app); landing page with a live demo recap; Whop checkout (§10); deploy (Cloudflare Pages + hosted Supabase); ~~terms and privacy pages~~ (done 2026-10-12, M2.12) (incl. that businesses confirm consent for photos, and a data-processing note: Kosovo's data-protection law follows GDPR); the "Made with" link pointing to the landing page; outreach to 50–100 founders and local businesses (camps, farms, clubs).

Since 2026-10-12 the deploy is a Cloudflare Worker with D1 and R2 instead of Pages + hosted Supabase: M2.14 covers the CAPTCHA, sign-in emails, the resvg wasm import, the demo cleanup job, the sign-in email provider in the privacy policy, and the deploy steps (P7). The bullets below keep their history; where they say Supabase, M2.14 wins.

Carried over from M2, needed for launch:
- ~~Hosted Supabase: run the five migrations; turn on anonymous sign-ins **with CAPTCHA** (Turnstile) so bots can't mint demo users; keep email confirmations on; set site URL and redirect URLs (`/confirm`); custom SMTP for sign-in emails.~~ Replaced by M2.14 P3 and P7.
- Cloudflare: ~~load resvg's wasm with a Nitro wasm import instead of `serverAssets` (and check the worker size)~~ (M2.14 P0); set `NUXT_PUBLIC_SITE_URL` so exported links use the real domain (`NUXT_PUBLIC_SITE_ORIGIN` already defaults to https://highreel.app). The prerendered landing, robots.txt and sitemap.xml are static files there. Submit the sitemap in Google Search Console and Bing Webmaster Tools once the domain is live.
- Terms and privacy are live (M2.12). Keep their promises: a job that deletes demo sessions never kept after 30 days (below), account deletion within 30 days of an email request, the sign-in email provider added to the privacy policy's providers, Cloudflare's Email Address Obfuscation off (Scrape Shield), and a lawyer's read before the first paid campaign.
- Clean up demo sessions: delete anonymous users (and their businesses, by cascade) older than 30 days. The privacy policy promises it. (M2.14 P4: a Cron Trigger, also clearing their files.)
- Try the recap on real phones (iOS Safari, Android Chrome, Brave): Share sheet, Save image, link previews in WhatsApp.

### M4 — after the season

Vertical video of each recap. Port Forevermore's in-browser recorder: `forevermore/apps/experience/app/composables/record/encoder.ts` (MediaRecorder, mp4/avc3 first for Instagram/TikTok) and `syntheticFeed.ts` (the drawn-reel engine). Slides must be drawn on a canvas to be filmed. Also: milestone recaps on a monthly plan, and integrations (Stripe, PostHog, Beehiiv; Shopify only after confirming Shopify can pay developers in Kosovo).

## 9. Non-goals

~~Sending emails for businesses~~ (since M2.8 we send the recap emails; still no newsletters or campaigns of other kinds) · native mobile apps · charts or analytics dashboards · AI-generated copy as a headline feature · per-customer data beyond what a recap shows · third-party trackers on recap pages.

## 10. Pricing and payments (hypothesis)

One-time per campaign on **Whop**: founding price **$99** (up to 1,000 recipients); then $199 (≤ 1k), $399 (≤ 10k), $799 (≤ 50k). Since 2026-10-12 the landing shows all three sizes, each "for the whole campaign" (not per customer), with $99 marked as the founding price (owner's pick), plus a "What counts as a campaign?" answer. More than 50,000 isn't offered yet. Monthly plan for milestone recaps later. Before taking real money on Whop, do the three checks in `~/.claude/CLAUDE.md` (written confirmation on the 3% "platform fee", whether identity verification is per person or per business, one small real payout to the Kosovo bank).

## 11. Open questions

1. Product name and domain (avoid "Wrapped", Spotify's term).
2. First segment to sell to: SaaS/apps (M1 template) or newsletters?
3. ~~Do we want a company-level "our year" page?~~ Yes (2026-10-11): planned as M2.5 P4, the business's own recap for its social media.
4. Shopify: can app developers in Kosovo get paid? Check before building a Shopify integration.

## 12. Status

| Date | State |
|---|---|
| 2026-10-11 | Scaffold only: Nuxt 4.6.1 + shadcn-nuxt + Tailwind v4 with the portfolio's tokens and fonts; placeholder `/` page verified in Chrome (Geist and Google Sans Code load, Button renders). Template + 200-row sample CSV generated. No Supabase yet. **Next: M1.** |
| 2026-10-11 | **M1 built and verified.** Local Supabase (544xx ports, migration + Habitly seed), shared template/validators (8 vitest tests, the 5 planted errors), all §7.3 routes, workspace `/app` (grid, filters, search, inline edit, Brand panel, publish dialog, export), recap player `/r/[token]` + preview, canvas share image, landing. Checked in headless Chrome: sample → exactly 5 red rows with the right messages, fixing row 8 turns it Ready; Kai (streak 2) has no streak slide; publish → 195 links, export 195 rows, URLs 200; recap at 390×844 and desktop (9:16), tap/hold/keys, auto-advance 5.0 s, Save image = 1080×1920 PNG; no third-party requests; reduced motion skips count-up; 10,000 rows import in 0.9 s and scroll at 16.7 ms median frames; typecheck passes. Not checked on a real phone yet (Web Share sheet, iOS Safari). Known: ranks of published rows refresh only on the next publish. **Next: try it on a phone, then M2 (auth) or start outreach (§2).** |
| 2026-10-11 | **M2a + M2b done.** `@nuxtjs/supabase` sessions; `/login` (magic link, Google behind `NUXT_PUBLIC_AUTH_GOOGLE`, "Try it without an account" = anonymous sign-in), `/confirm`, demo banner to keep work by adding an email (same user becomes permanent). Migration `20261011180000_accounts_rls.sql`: RLS policies on all three tables, grants to `authenticated` (recipients' counters not updatable), `bulk_update_recipients` RPC for publish (runs as the user). All workspace routes use the user's session; only `/api/r/*` uses the secret key. `corepack pnpm check:rls` (14 checks, two users) passes. Campaign switcher (new, switch, delete), Clear rows, Sign out / End demo session. Local auth now requires email confirmation like production; emails land in Mailpit. Browser-checked: demo → sample → publish → public recap; second user gets 404 on every route of the first user's campaign; keep-work email, sign out, magic-link sign-in. Google sign-in wired but not tried (needs a Google OAuth client). **Next: M2c (logo + group photos).** |
| 2026-10-11 | **M2c done.** Migration `20261011200000_media.sql`: private `media` bucket (5 MB, JPEG/PNG/WebP) with owner-folder policies; `businesses.logo_path`. Brand panel: Logo (upload/replace/remove) and Group photos (consent checkbox before the first upload, up to 6, caption, reorder, remove, "first photo on the share image" off by default). Images are shrunk in the browser (photos 2000 px, logo 512 px, WebP) and uploaded with the user's session. Recap: logo replaces the initial on cover, footers, share card and share image; one full-bleed photo slide per photo (slow zoom, caption on an accent band) before the note; the share image puts the first photo on top when enabled. Workspace URLs signed 1 h with the user's session, recap URLs 24 h by the server; storage paths never reach recap pages. Deleting a campaign empties its folder. `check:rls` now 21 checks incl. Storage. Browser-checked end to end with drawn test images. **Next: M2d (engagement columns).** |
| 2026-10-11 | **M2d done.** After publish the grid shows `viewed` (count; tooltip with first view) and `did` (saved / shared / clicked, filled when done, tooltip with time). Top bar adds "· N viewed". Counters refresh when the tab becomes visible again (at most every 15 s), merged into rows without disturbing edits. Empty state asks for the business name while it's still "My business". **Next: M2e (templates as data + newsletter, shop, visit).** |
| 2026-10-11 | **M2e done.** Templates are data (`shared/templates/types.ts`: slides, cover, share wording, note/since, rank, items label, share stats); `buildSlides`/`shareStats`/`toRecapRecipient` are generic, and recaps only receive the columns the template's slides read (never id/email). New templates `newsletter`, `shop`, `visit` (§4.4) with template CSVs and samples; the Habitly sample is byte-identical. New campaign picks the template; Brand panel copy fields, items label, export header and sample/template downloads follow it. 28 vitest tests (each sample's planted errors, clean template rows, slide rules, currency prefix, label copy). Browser-checked a farm campaign end to end with the visit template and a group photo. **Next: M2f (.xlsx + column mapping).** |
| 2026-10-11 | **M2f done.** Uploads accept `.xlsx` (read-excel-file, first sheet, lazy-loaded; Excel dates → YYYY-MM-DD, empty rows dropped) and CSV; `.xls` gets a "save as .xlsx" message. `shared/utils/mapping.ts` suggests a header for each column by exact name, then English/Albanian synonyms (Emri, Ditët, Shënim…); the mapping dialog opens only when headers don't fit, shows the first value per column, and blocks import until required columns are picked. 33 vitest tests (5 for mapping). Browser-checked with a farm's own .xlsx. **Next: M2g (link previews).** |
| 2026-10-11 | **M2g done.** `GET /api/r/:token/og.png`: 1200×630 PNG drawn as SVG on the server and rendered by `@resvg/resvg-wasm` with Geist TTFs from `server/assets/fonts` (OFL licence copied alongside); wasm served from node_modules via `nitro.serverAssets`. Same checks as the payload (404 unless published), logo embedded when set, `Cache-Control: public, max-age=3600`, ~25 ms warm. `/r/[token]` sets og:title/description/image (absolute), twitter:summary_large_image; the page title uses the template's share wording. For Cloudflare (M3): swap the wasm load to a Nitro wasm import. **Next: M2h (Paper theme).** |
| 2026-10-11 | **M2h done, M2 complete.** `settings.theme` (`stories` \| `paper`), picked in the Brand panel with a live preview. Paper: paper/ink palette (accent darkened to ≥ 4.5:1 for big numbers), mono slide counter and rule, accent bar under the cover title, numbers in Google Sans Code, dark buttons; share image and link preview follow the theme. Logos now upload as PNG (resvg can't decode WebP; non-PNG/JPEG logos fall back to the initial in previews). Reduced motion swaps slides instantly. Full regression re-run green: 33 vitest tests, 21 isolation checks, M1 done-when list (5 errors, 195 links, export, 10k rows: 0.9 s import, ~18 ms frames), recap player (tap/hold/keys/5 s/save, no third-party requests), accounts, campaigns, media, engagement, visit template, .xlsx mapping, Paper, typecheck. Not done: real-phone test, Google sign-in (needs OAuth client). **Next: M3 (see "Carried over from M2"), or outreach first (§2: start by 2026-11-01).** |
| 2026-10-11 | **Fix: sessions that outlive their user.** Reported by the owner: Brand → Save said "Campaign not found", then `/app` showed a raw `businesses_owner_id_fkey` error. Cause: the browser kept a valid-looking session cookie for a user deleted by a local `supabase db reset` (the same would happen after deleting accounts or cleaning up demo sessions in M3). `requireUser()` now asks Supabase Auth (`auth.getUser()`, ~30 ms locally) instead of only verifying the JWT; the foreign-key error maps to 401 as a backstop; the workspace's `api` fetch signs out locally on any 401 and opens `/login?expired=1` ("Your session ended…"), with no error toasts. Reproduced first and verified in headless Chrome (save with a deleted user, reload with a deleted user, new demo session) and in the owner's Chrome (sign-in page instead of the error, demo session, Brand save → "Brand saved"). Auth, media and Paper suites re-run green. |
| 2026-10-11 | **Planned M2.5** (P1 recap scenes and motion → P2 landing → P3 business home → P4 the business's own recap) at the owner's request, before M3; written above for a fresh session. Added the browser checks to the repo: `tests/e2e/` (10 checks with assertions, `corepack pnpm e2e`, `playwright-core` driving the installed Chrome); all green. **Next: M2.5 P1.** |
| 2026-10-11 | **M2.5 P1 done: recap scenes and motion.** Each slide plays a scene chosen in template data (`SlideDef.scene`, `span`): cover (shapes assemble, mark pops, title words rise behind a mask), days (12-month calendar with real weekdays fills as the number counts; a visit gets a tear-off page per day), streak (chain lights link by link, pans, last link glows), count (odometer digits, tokens drop and stack, "● = 50" above ~60), word (plate over marquee type wallpaper), badge (rosette seal spins in, shine, ribbons), rank (100 dots, count-down from 100 % to yours, "You're here"), note (quote mark draws, words appear), photo (polaroid drops, develops, caption types), share (tiles fly in and assemble the card, seeded confetti). Stories backdrops: drifting palette blobs + grain; Paper: paper grain, ink rules, wipes only, no overshoot. Durations 5–7 s per scene; entrances wipe/push/zoom/flood/rise, back crossfades; hold freezes the scene. **Guess first** (Brand panel checkbox, off by default): first two number slides ask, three seeded choices, story waits, chip "Spot on" / "You guessed 180". Share image and link preview redrawn in the new look (blobs, grain, stat tiles). **Built with CSS keyframes, not `motion`** (compositor-only, cover plays before hydration, 0 KB JS; see P1 tech decisions). `/r` slimmed: Supabase browser client loads lazily off `/` and `/r/*`, toasts/tooltips moved to `layouts/default.vue`. Budgets on a production build (`tests/e2e/budgets.mjs`): `/r` JS 182 → **113 KB gz**; first slide on Slow 4G + 4× CPU: LCP 2.7 s → **0.68 s** (the cover's last title word settles at ~2.0 s); 4× CPU frame times median 16.7 ms on every scene, worst 0.7 % frames > 25 ms. Checks: 57 vitest (new `tests/scenes.test.ts`), 21 isolation checks, typecheck, 11 browser checks (new `scenes.mjs`: scene per slide, entrances, durations, hold freezes, reduced-motion end states for every scene, Guess first). Recordings for the owner: `tests/e2e/.out/recap-app.mp4` (with two guesses) and `recap-visit.mp4` (`node tests/e2e/record.mjs`, headless Chrome at 390×844, not a real phone). Not done: real-phone check (mid Android, iOS Safari). Open: Guess first on by default? Music later? **Next: M2.5 P2 (landing).** |
| 2026-10-11 | **M2.5 P2 + P3 + P4 done.** **P2 landing** (`/`): headline "Give every customer their year recap." and the $99 founding price (owner's answers), a real example recap playing in a phone with App · Newsletter · Shop · Farm visit (static payloads in `app/data/examples.ts`, illustrated farm photos in `public/examples/`), the page taking each example's colours with a flood from the pressed button, how it works as three CSS vignettes on a sticky stage, pricing with three FAQs, footer "Made in Kosovo"; `/example/[key]` plays an example full-screen; `public/og.png` (`node scripts/og-landing.mjs`). Prefetch hints are off app-wide (they downloaded supabase-js on the landing and recaps). Lighthouse mobile on a production build: **performance 93, accessibility 100**, best practices 100, SEO 100 (landing JS 167 KB gz; `/r` still 115 KB gz, first slide 660 ms on Slow 4G, 60 fps). **P3 home** (`/app`, workspace moved to `/app/c/[id]`, old `?c=` links redirect): the year as sentences with numbers in mono, drafts needing attention, a recaps table (kind, template, status, rows, published, opened %, saved, shared, clicks, updated; Duplicate with photos into next year, Delete), recent activity, year switcher, empty state with both kinds and sample data. `campaign_stats` / `recent_activity` (security invoker); home queries 75 ms median at 10 campaigns × 10k rows (`node scripts/perf-home.mjs`). **P4 business recap**: template `business` (§4.5), `campaigns.kind`, a form with live preview and suggestion chips (`campaign_sums`), timeline scene for milestones, publish → one link, story 1080×1920 and new square 1080×1080 images, link preview; listed on the home with its views. Also fixed: the recap player's reduced-motion class caused a hydration mismatch (never applied in production); it's now read after mount. Checks: 73 vitest (new `tests/home.test.ts`, business template tests), 29 isolation checks, typecheck, 14 browser checks (new `landing.mjs`, `home.mjs`, `business.mjs`), recap budgets. Not done: real-phone check; nothing is committed to git yet (no commits in this repo). **Next: M3 (launch), with outreach starting by 2026-11-01 (§2).** |
| 2026-10-11 | **Landing restyled after trysundrop.app** (owner's ask). See the "Restyled" note under M2.5 P2: white page, Outfit + a 16 KB Caveat subset, our own flower shapes popping out around the hero and closing, recap stickers and inbox bubbles, the example phone on a shape in the business's colour, steps as centred feature blocks, grey price cards, chevron FAQ, sticky Try the demo; new link preview. Content unchanged (headline, examples, steps, $99, three FAQs). Checked in headless Chrome at 1440 and 390 px (screenshots of every section, examples switching); landing e2e rewritten (31 checks: shape per example in its colour, steps pop in, sticky button, self-hosted fonts, recap and vignettes not in the server HTML, reduced motion, no third-party requests); full e2e, 73 vitest tests and typecheck green. Lighthouse mobile on a production build: **performance 93, accessibility 100**, best practices 100, SEO 100 (first try 83: the full Caveat, the headline fading in from invisible and the server-rendered phone; fixed). **Next: M3 (launch), with outreach starting by 2026-11-01 (§2).** |
| 2026-10-11 | **App restyled to the landing's look; farm theme removed.** Owner's ask: the dashboard "looks very industrial" past the landing, and the farm (their first local prospect) had become the landing's running theme. (1) Sign-in, home and workspace now use the landing's design language (§6.4): Outfit UI type on `body.app-ui`, the landing's ink/greys and blue as tokens, pill buttons and tabs, 24 px dialogs, wordmark home link, sentence-case section titles, the year summary set big with ink numbers on grey text, the first-run choices as the landing's grey cards with a shape icon, a handwritten aside here and there, the preview stage tinted with the business's accent and a bezelled phone. Recaps unchanged (Geist). The grid keeps 32 px rows and ≥ 20 visible at 1280×800. (2) Landing made general (see "Made general" under P2): no business names outside the phone, five examples (new: fitness studio, summer camp; farm example and farm SVGs removed), og.png redrawn. Dashboard leftovers made general too: `visit` template text ("Camps, daycares, gyms, studios, clubs"; share lead "What a time, {first_name}!"), its sample is now "Sunny Hill Camp" (same planted errors), business-form and business-name placeholders. Fixed on the way: the stage shape on the landing could swallow clicks on the middle switcher pill. Checks: 73 vitest, typecheck, 14 browser checks (landing: five examples, no business names around the phone; misc: Outfit/Geist/Google Sans Code each load). `check:rls` not re-run (no policy or route changes). Not done: real-phone look, Lighthouse re-run. |
| 2026-10-12 | **Landing reworked and business-type templates.** Owner's asks (2026-10-12): hero less like the reference, real iPhone frames, a clearer step three, pricing past 1,000 customers, more templates in the dashboard (owner picked: a gallery at New recap *and* in the Brand panel; the spec's price tiers). Built: hero motion (morphing blobs, drawn lines, floating pieces; paused off screen and for reduced motion), `PhoneFrame` for every landing phone with the recap edge to edge (`--recap-inset-top`), step three "Share it with your members." with notification → recap phones, step spacing, pricing tiers $99 (founding) / $399 / $799 "for the whole campaign" and a campaign FAQ, og.png "From $99". Ten business-type templates (§4.6) in New recap and the Brand panel; the landing examples come from them; creating from one adopts its colour only on a default-coloured business. Checks: 79 vitest (new `starters.test.ts`), typecheck, 15 browser checks (new `templates.mjs`; landing: iPhone frame fills, hero morphs and pauses off screen, tiers, four questions; the example taps now scroll the phone into view first, since the taller frame put its middle at the viewport edge). Not done: Lighthouse and recap budgets on a production build, real phones. |
| 2026-10-12 | **M2.6 done: a manageable dashboard.** Owner's ask: the recap page did everything at once; split setup from data, still not a traditional dashboard (owner picked a separate Your brand page). Built: `/app/c/:id` with three step tabs in the top bar (Sheet · Design · Share; Content for a business recap; dots for rows to fix, unsaved design, live), nested routes sharing one store; **Sheet** = grid, filters (with counts), Upload, preview; **Design** = template (wording and theme, in the business's colour), look, slide-by-slide cards (each line, count label, photos, note, button) with a phone that jumps to the slide being edited and says when this person doesn't get it, a draft kept across tabs until Save/Discard; **Share** = publish (what goes out, what's skipped, "Fix them first"), export, a message to copy, link preview, how it's going in sentences; a business recap's link and images; **Your brand** (`/app/brand`) = name, logo, colour (with the templates' colours as quick picks), website, an example recap in those colours; `GET/PATCH /api/business` with the checks shared with the campaign route (`server/utils/brand.ts`). Previews use the landing's iPhone frame. The Brand panel and MediaSection are gone (PhotosSection in Design). Fixed on the way: switching recaps while on Design left it reading a cleared draft. Checks: 79 vitest, typecheck, 30 isolation checks (new: B can't change A's brand), 16 browser checks (new `tabs.mjs`; Brand-panel flows moved to Design / Your brand; counts read from the sheet's filters). Not done: leaving a recap with an unsaved design doesn't warn yet; Lighthouse and real phones. |
| 2026-10-12 | **Logo shape, no frame.** Owner's ask: no business logo in the dashboard's top bars, and the logo's thick white frame looked wrong. The logo now fills its mark (object-fit cover, no padding) in a circle by default or a rounded square, picked on Your brand (`businesses.logo_shape`, migration `20261012120000_logo_shape.sql`; checked in `brandUpdate`; in the public payload as `business.logo_shape`). Same on recap slides (`RecapMonogram :shape`), the share image (canvas clip) and the link preview (SVG clipPath, `slice`). The initial-letter mark follows the shape. The home's top bar and Design's brand chip show no logo (a colour dot in Design). Checks: 79 vitest, 30 isolation checks, typecheck, browser checks green (`tabs.mjs` adds: logo fills a circle with no frame, Square saves and reaches the public recap and link preview, no logo in the top bar). |
| 2026-10-12 | **M2.7 done: your own columns and a scene library.** Owner's ask: don't limit businesses to our columns or slides; the owner's own Forevermore must be able to send its members a recap. Researched first (§M2.7: Storyly, Idomoo, Blings, Canva let businesses define fields but are enterprise or static; PushPress is fixed). Built: campaign settings `columns` + `slides`, resolved by `templateFor()` everywhere (grid, import, cell edits, publish, `/r`, share image, link preview); template `custom` ("Your own sheet", eleventh card in New recap) with the Keepsake sample (150 rows, errors in rows 6, 31, 102) and a template CSV with example columns; the mapping dialog's "Your other columns" (detected type, first value, Add; private-looking columns and sheets with > 12 new columns start unticked); lenient own cells (decimals rounded, thousands commas, timestamps → days); Design's slide list (animation pills from the library, tokens, calendar span, show rule, top-% threshold, share-card name, move, hide/remove, Add a slide: a column's value, a top % by any number, or a new column); new scene **date** (tear-off pages, a circle stamps the day) and count tokens as dots, hearts or stars; ranks by every number column at publish (`computed_top:<column>`), live in the preview; placeholders for any column in any line, dates read "February 14, 2026"; "Download template" gives the recap's own columns. No third-party animation library (decided: weight on `/r`, and its animations can't take data). Checks: 107 vitest (new `tests/own.test.ts`: detection, Keepsake errors, re-uploads, `withOwn`, slides, ranks, privacy, lenient cells), typecheck, 30 isolation checks, 17 browser checks (new `custom.mjs`, 22 steps: template slide hidden and restyled, Keepsake import, Design edits, publish, the public recap's scenes and payload; `xlsx.mjs` checks the farm's extra column becomes a slide). Budgets on a production build: `/r` JS 115 → **123 KB gz**, first slide 684 ms, 60 fps on every scene including the own sheet's (date, hearts, badge, rank). Not done: real phones; a Forevermore export query; picking several columns for a timeline; changing a column's type. **Next: M3 (launch), outreach by 2026-11-01.** |
| 2026-10-12 | **M2.7 follow-ups done.** Owner's ask: the open items except real phones. (1) **Forevermore export** (`forevermore/supabase/snippets/recap-members-export.sql`), checked on Forevermore's local database (6 members) and uploaded into a "Your own sheet" recap: types right, no errors, the recap plays; Forevermore's local stack stopped again afterwards. (2) **Lists**: a timeline slide of up to 5 of the business's columns, labelled by column, chips in Design (`show: 'list'`); the timeline scene now takes 5 items. (3) **Column menu** in the Sheet: change an own column's type or remove it (`PATCH /api/campaigns/:id/columns`, `changeColumn`, all rows re-validated, a confirm with the number of cells that won't fit). (4) **Decimals**: type `decimal` (two places; currency signs, %, thousands separators and decimal commas read), detected from cents, Count up only, formatted on slides and the share card, rankable; whole-number cells read currency signs too. Found and fixed on the way: the column menu's reka-ui code moved Rolldown's namespace helper into a workspace chunk, and `/r` grew from 123 to 144 KB gz; the landing now lazy-loads a wrapper (`LandingPlayer`) instead of `RecapPlayer`, and `/r` is **119 KB gz** (16 files). Checks: 117 vitest (lists, column changes, decimals, lenient numbers), typecheck, 30 isolation checks, 17 browser checks (`custom.mjs` 33 steps: lists, the column menu, decimals; `auth.mjs` probes import and columns as another user: 404), budgets on a production build (first slide 688 ms, 60 fps on every scene). Not done: real phones. **Next: M3 (launch), outreach by 2026-11-01.** |
| 2026-10-12 | **M2.8 done: an editor, sending from Recap, a livelier recap page.** Owner's asks: Design scrolled the whole page into a blank area; Design (and Your brand) should be a proper editor without the pointless Template section, with drag handles and eyes; one button to send everyone their link (owner picked: Recap sends the emails, reversing "we never email"); a playful recap page with previous / next / pause. Built: (1) the overflow was `sr-only` labels positioned against the page from inside a scroll pane: panes are `relative` now, and the workspace tabs and Your brand never scroll the page. (2) **Design** = rail (Look, Guess first, the slides with ⠿ drag via `useSortable`, ↑/↓ on the handle, eye, a not-for-this-person icon, + Add a slide, the fixed end, the brand chip) · inspector (status line, `PlaceholderField` chips, animation tiles, options; Add a slide as four cards) · `PhoneStage`; the Template section is gone. (3) **Your brand** in the same shell: settings rows that say where each thing shows, a logo drop zone, Circle \| Square, colour with contrast; the phone goes to the cover while they change. (4) **Sending**: migration `20261012150000_email.sql` (`recipients.emailed_at/email_error`, `email_optouts`, an append-only `email_sends` log without addresses), `shared/utils/email.ts`, `server/utils/mail.ts` (Resend over fetch, Mailpit in development, reserved addresses never to Resend), `GET`/`POST /api/campaigns/:id/send` (200 per call, tests to the owner, retry, 2,000 a day per business, demo sessions refused, others' recaps 404), unsubscribe page and routes (one-click and a no-JS form), Share's Send section with the email's live preview, the publish toast's "Send them", an emailed icon in the Sheet. (5) **Recap page**: `RecapBackdrop` (the landing's blobs, lines and pieces in shifted hues of the accent, CSS/SMIL, still for reduced motion), ‹ › and pause / play (`RecapPlayer.paused`, K/P). Checks: 133 vitest (new `tests/email.test.ts`), typecheck, 44 isolation checks (14 new for sending), 19 browser checks (new `editor.mjs`, `send.mjs`; Design flows in `custom`, `tabs`, `templates`, `visit`, `media`, `home`, `session`, `record` moved to the rail/inspector), budgets on a production build: `/r` JS **122 KB gz** (19 files), first slide 688 ms, 60 fps on every scene. Not done: real email in production (verified domain, Resend key, bounce webhook, terms; see M2.8), real phones. **Next: M3 (launch), outreach by 2026-11-01.** |
| 2026-10-12 | **M2.9 done: send from your own email, WhatsApp one tap at a time, plain slide names.** Owner's asks: slide names like "Longest streak" read like titles the wording must match; Forevermore's members won't know mail from "Recap", and Recap's own domain would land in spam ("not everyone is gonna be using Resend"); pick email or WhatsApp; the email preview broke when clicked and should sit in the iPhone frame. Researched the options (SMTP, Google/Microsoft OAuth, marketing tools, Meta's WhatsApp platform; see M2.9); owner picked SMTP now, no sending from Recap's address, WhatsApp one tap per person. Built: (1) Design's rail and inspector say **Slide 2, Slide 3…** with each line filled in for the previewed person (unseen slides show "…" for their numbers) and the column as a badge. (2) **Connect your email** (`EmailConnectDialog`, on Your brand and from Share): 13 presets (Gmail, Workspace, Microsoft 365, iCloud, Zoho, Resend, Postmark, SendGrid, Brevo, Mailgun, SES, Other, and Local test inbox in development), login checked and a test sent before saving, passwords AES-GCM (`server/utils/secrets.ts`), SMTP ports only and no private addresses (`smtpTarget`), nodemailer from the business's address, 25 per call, the account's daily limit; migration `20261012170000_email_connections.sql`; M2.8's Resend/Mailpit sender removed; no Recap branding in the email or the unsubscribe page; Mailpit SMTP published on 54425. (3) **WhatsApp**: an optional `phone` column on every sheet template (type `phone`, synonyms, never in the payload; samples get Ofcom drama numbers on 4 rows in 5, other values unchanged), Share's Email \| WhatsApp \| Links file tabs, the message and a country code, Send next / Send per row opening `wa.me` with the text, marked sent with Undo (`recipients.whatsapp_at`), a WhatsApp mark in the Sheet. (4) **Previews in the iPhone frame** (`MessagePreview`): the email in a mail app scaled from a 402 pt phone, scrollable, links switched off; the WhatsApp chat with the link preview card. Fixed on the way: Share switched to WhatsApp after loading even when Email had been clicked. Checks: 158 vitest, typecheck, 52 isolation checks (8 new: email accounts, WhatsApp marks), 20 browser checks (`send.mjs` 39 steps: refusals, encryption, the iPhone preview, sends from the business's address; new `whatsapp.mjs` 17 steps), budgets on a production build: `/r` **122.3 KB gz**, first slide 688 ms, 60 fps; nodemailer stays out of the client. Not done: Sign in with Google/Microsoft, marketing-tool integrations, a Workers SMTP client for Cloudflare (M3), real phones, a real Gmail/Resend account (only the local Mailpit was used). **Next: M3 (launch), outreach by 2026-11-01.** |
| 2026-10-12 | **M2.10 done: shadcn controls everywhere, a scene library of 27.** Owner's asks: the editor should use the shadcn-vue components throughout (the native dropdowns didn't look like the library's Select), and the animation library was too slim. Built: Select, Checkbox, Switch, RadioGroup, Tabs and NumberField added (`shadcn-vue add`, tabs and menus rounded to §6.4); no native `<select>`, checkbox or hand-made radio left in the app (Design, PlaceholderField, PhotosSection, Your brand, Share, the connect, mapping and New recap dialogs; `Segmented` for pill choices). 19 new scenes (see M2.10): numbers get 10 (Tally, Fill up, Slot machine, Big number, Bubbles, Gauge, Climb added), decimals 5, words 8 (Sticker, Typewriter, Departure board, Neon, Letters fly in, Spotlight), dates 6 (Postmark, and the letter effects), top % 5 (Podium, Leaderboard, Big number, Gauge), lists 4 (Receipt, Cards, Checklist); `SlideDef.top` keeps a top % slide one whatever draws it. Fixed on the way: reka-ui's `data-state` vs the style's `data-checked`/`data-active` (checked and active states never showed; `main.css` custom variants), and the letter scenes now read as one word to screen readers. Checks: 158 vitest (scene lists per data kind, timing and names for every scene), typecheck, 21 browser checks (new `library.mjs`: 33 scene renders with their values, a published recap playing three of them; tests drive Selects, menus, toggles and checkboxes), budgets on a production build: `/r` **128.5 KB gz**, first slide 752 ms, 60 fps on all 19 new scenes (budgets now play two recaps that use every one). `check:rls` not re-run (no policy or route changes). The dev server was restarted (stale stylesheet links). Not done: real phones. **Next: M3 (launch), outreach by 2026-11-01.** |
| 2026-10-12 | **Named Highreel.** Owner's pick after a long naming search ("Recap" was taken on every good domain; they wanted a short, two-beat name that sounds good, not one that explains how it works). Domain **highreel.app** bought on Cloudflare for one year (renewal to watch). Checked first: no HIGHREEL / HIGH REEL / HI REEL US trademark, nothing on WIPO's Global Brand Database; a small short-drama app calls itself HighReel and HiReel (hireel.com) is a video-CV tool, both other markets; highreel.com is for sale at HugeDomains. Renamed the brand only: wordmarks (landing, sign-in, home, Your brand, workspace top bar), page titles, "Made with Highreel" on the share slide, the share image and the link preview, `public/og.png` redrawn, the "connected to Highreel" email and the From-name fallback, comments. "recap" stays the word for what each customer gets; the repo folder, package name, Supabase `project_id`, code names and localStorage keys keep "recap" (CLAUDE.md rule). New checks: the landing's title and both wordmarks (`landing.mjs`), "Made with Highreel" on the share slide (`recap.mjs`). `pnpm test` 158/158, typecheck clean, e2e landing, recap, send, auth, home, paper, workspace pass. |
| 2026-10-12 | **M2.11 done: the landing at 100, airtight search, unsaved edits, bounces.** Owner's ask: the small gaps except Microsoft 365 sign-in, "especially the landing page scores", search "airtight", "100% out the gate". (1) **Lighthouse 100/100/100/100 on mobile and desktop** (was mobile performance 93): `/` prerendered and served compressed; `modules/landing-first-paint` rewrites its HTML at build time (CSS inline, Outfit's latin file and the Caveat subset preloaded, no modulepreload/payload preloads, the app's entry imported after the largest paint); the lede no longer fades in. Five final runs on a production build: mobile FCP 0.8 s, LCP 1.5 s, TBT 0, CLS 0; desktop FCP 0.2 s, LCP 0.4 s. (2) **Search**: `siteOrigin` (https://highreel.app) for canonical/og:url/og:image; JSON-LD (Organization, WebSite, SoftwareApplication with the three prices, FAQPage as shown); robots.txt and sitemap.xml (prerendered); noindex on /login, /confirm, /app; favicon/SVG/touch/manifest icons (`scripts/icons.mjs`, a blue scallop with Outfit's "h"); example pages get canonicals and "← highreel"; landing copy brought up to date with M2.9 (send from your own email or WhatsApp; email/phone only to send). (3) **Unsaved Design edits**: leaving the recap asks (Keep editing · Discard changes · Save and leave), closing the page gets the browser's prompt; sign-out and ended sessions pass (the full suite caught the dialog blocking the 401 redirect; fixed). (4) **Bounces** (`server/utils/bounces.ts`, migration `20261012190000_email_bounces.sql`): provider typos held, domains without mail bounced, SMTP answers sorted into bounce / retry / stop the run (in the server's words), bounced addresses remembered per business and never sent to again, a batch with ≥ 5 bounces (≥ a fifth) pauses, Share counts "N bounced", the Sheet's mail mark says why; editing an address clears its error. Complaints: one-click unsubscribe as before; spam clicks and later bounce messages in the business's inbox aren't visible (no IMAP; documented). Checks: 344 vitest (new `bounces.test.ts`, `landing.test.ts`), typecheck clean, 58 isolation checks (6 new for `email_bounces`), 23 browser checks (new `unsaved`, 7 steps; `bounces`, 13 steps with its own fake SMTP server; `landing` 52 steps incl. search; all pass after the sign-out fix), budgets on a production build (landing: br, CSS inline, scripts after LCP; `/r` 129.3 KB gz, first slide 744 ms, 60 fps). Not done: terms and privacy pages (need the operator's legal name and address), reading bounce replies from the business's inbox, DNS checks on Cloudflare (Workers lack `node:dns`; they go with the SMTP sender, M3). **Next: M3 (launch), outreach by 2026-11-01.** |
| 2026-10-12 | **M2.12 done: terms and privacy.** Owner gave the legal name (HighReel) and contact (hello@highreel.app). Built `/terms` and `/privacy` (`LegalPage`, `data/legal.ts`) from how the product works: businesses own their customer data and need the right to use it, we're their processor (data processing terms in the policy, Article 28), recaps never show emails/phones/IDs, recap visits record only counts (no IP, cookies or third parties), emails come from the business's own account with one-click unsubscribe, bounces and opt-outs kept per business, providers Supabase/Cloudflare/Whop/sign-in email, Kosovo's Law 06/L-082 and the GDPR, the Information and Privacy Agency. Defaults picked (owner to confirm): full refund within 14 days if nothing from the campaign was sent or shared; Kosovo law, Prishtina courts. Linked from the landing's footer and sign-in; prerendered with the landing's first-paint rewrite; in the sitemap; Organization data has legalName and email. Lighthouse on a production build: both pages 100/100/100/100 on mobile and desktop (first try accessibility 95: link blue on the grey box was 4.36:1, now #3B4FE6), landing still 100 everywhere. Checks: new `legal.mjs` (18 steps), landing (sitemap 8 URLs, legalName/email), budgets (both pages compressed, CSS inline, no early scripts), typecheck, 344 vitest, e2e workspace/landing/auth/session/home/legal pass. Launch must keep the policy's promises (M3 list). **Next: M3 (launch), outreach by 2026-11-01.** |
| 2026-10-12 | **Terms and privacy revised after the owner's read.** "Highlight reel" instead of "recap" throughout both pages (titles, contents lists, body; `legal.mjs` now checks no "recap" and no "Made in Kosovo" on them), "Made in Kosovo" off their footer, photo and children wording cut to one line each (the business adds only photos it may share, e.g. the photo release camps and schools already collect; it's responsible for reels about children; parents can ask for a take-down). Kept: the 30-day demo deletion and 30-day account deletion (owner confirmed). Privacy description trimmed back to 154 characters after the longer word. `legal.mjs` 20/20. The rest of the site (landing, app, emails) still says "recap". |
| 2026-10-12 | **"Highlight reel" everywhere; no "Made in Kosovo".** Owner's ask: drop "Made in Kosovo" from the landing's footer too, and stop using "recap" as the product's noun anywhere ("I don't want it to feel like a nod to the name of the app"), only as an ordinary word. Copy changed across the landing (headline "Give every customer their year's highlight reel.", title, description, og, steps, FAQ, pricing, closing; "Top 6%" sticker moved below the longer headline; inbox bubbles "Ana, your 2026 reel is here"), example pages, sign-in, the home ("New highlight reel", "Your highlight reels", default names "2026 highlight reels"), the workspace (menus, Publish N highlight reels, toasts, preview labels, unsaved dialog), Design, Share (statuses, hints, toasts), Your brand, the unsubscribe page, the public page's 404, the email button ("Open your highlight reel") and the connection email, the WhatsApp default, column help, home sentences, suggestion chips, server errors. The `{recap_url}` placeholder is now `{link}` (old messages still fill in), the links file's column `link`, template downloads `highreel-template-*.csv` (contents unchanged), share images and sheets fall back to `highlight-reel` in file names; `public/og.png` redrawn ("Give every customer their / year's highlight reel."), manifest description updated. The photo checkbox drops its children sentence (the terms' one line covers it). Code names, routes (`/r/…`), database values and CSS classes keep "recap" (no live link changes). Tests updated to the new words; vitest 344, typecheck clean. |
| 2026-10-12 | **M2.13 done: save any slide as an image.** Owner's ask: Save image only saved the summary card; open a picker instead (story shrinks up, a sheet of every slide as cards, tick several, a hover effect on laptops, tap and press-and-hold on phones). Built `RecapSaver` (the sheet) and `RecapStill` (a slide's end state at any size), the player's `.stage` shrinking and `peek`; images drawn while choosing (summary card as before, other slides captured from a 360×640 still with modern-screenshot, lazy-loaded, 1080×1920 PNG); phones save through one share sheet, laptops download one file each. Fixed on the way: the grain's data URI tripped the capture (`/r/%23n` 404s), and centring the strip with `scrollIntoView` scrolled the whole frame. Checks: new `saveimages.mjs` 16/16 (dev and production build), `recap`/`engagement`/`paper`/`media` through the new `saveSummaryImage` helper, budgets (`/r` 132.0 KB gz, first slide 752 ms, 60 fps everywhere), typecheck, 344 vitest. |
| 2026-10-12 | **Save picker: calmer hover, and layout B to compare.** Owner: the hover effects were "a bit too snappy" and looked jittery; and they'd pictured the picker outside the reel's frame, on the page, centred with a width, the reel smaller. Hover now eases over 560 ms without overshoot, the reel's preview waits for the pointer to rest (140 ms), holds through the gaps and crossfades. Layout B behind `?picker=page` on `/r/:token` and `/example/:key`: a centred 880 px panel at the bottom of the page, the whole reel shrunk and centred above it (`useDockedPicker`), arrows/pause/notes faded. A stays the default until the owner picks. Checks: `saveimages.mjs` 24/24 on dev and a production build, recap/engagement/paper/media/editor pass, budgets (`/r` 132.8 KB gz, first slide 764 ms), typecheck. |
| 2026-10-12 | **Save picker: the sheet inside the frame stays; cards further apart.** Owner compared layout B (`?picker=page`) and kept the original; B's code is gone (the player's `pickerOutside`, `useDockedPicker`, the docked panel on `/r` and examples). Cards sat too close when hovered or ticked: the strip's gap is now 4.8u (15 px between a hovered card and its neighbours on a laptop frame, room for two tick rings). Calmer hover kept. Checks: `saveimages.mjs` 17/17 (new: cards keep clear of each other), typecheck. |
| 2026-10-12 | **M2.14 planned: off Supabase, onto Cloudflare.** Owner's ask: use Cloudflare (which already has the domain, Forevermore and the portfolio) for the database, files and sign-in too. Compared first: Workers Paid is one $5 per account and Forevermore's account already pays it, so Highreel adds no base fee; Supabase would need Pro ($25/month) once live (free projects pause after a week, 5 GB of downloads, 500 MB). Plan in §8 M2.14: one Worker (`cloudflare_module`) with D1 (EU), R2 (EU), Better Auth 1.7 (magic link, demo, Turnstile; its D1 dialect and the demo-linking hook checked in 1.7.7's source), Email Sending for sign-in emails, Cron Triggers for the demo cleanup and account deletions. RLS is replaced by a data layer that filters every workspace query by the user's business, an API-level `check:isolation` and a vitest on the SQL. Phases P0 (prove the runtime: wasm, `node:dns`, nodemailer, 50k-row sheets) to P7 (deploy). Found while checking: `node:dns` `lookup` (used by the SMTP guard) isn't implemented on Workers. No code changed yet. **Next: M2.14 P0.** |
