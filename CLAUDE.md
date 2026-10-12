# Highreel

Self-serve "Wrapped"-style recaps: a small business uploads a spreadsheet of customer stats and every customer gets a personal recap page to share. Named Highreel (highreel.app) on 2026-10-12; "Recap" was the working name.

**Read `SPEC.md` first.** It holds the product, the spreadsheet contract, the UI decisions, the data model and the milestones. Before ending a session, add a row to its §12 Status table.

**Moving off Supabase (SPEC M2.14, planned 2026-10-12):** the database, files and sign-in move to Cloudflare (D1, R2, Better Auth, one Worker). Until a phase lands, the Supabase rules and commands below still describe the code; M2.14 P6 rewrites them.

## Commands

```bash
corepack pnpm install
supabase start           # local DB on 544xx ports (see SPEC §7.6); `supabase db reset` reseeds
corepack pnpm dev        # http://localhost:3040 → "Try the demo" (anonymous session); /app home, /app/brand Your brand, /app/c/:id a recap (Sheet · /design · /share); recap emails (via "Local test inbox" on Your brand) land in Mailpit, http://127.0.0.1:54424
corepack pnpm sample     # regenerate public/templates/*.csv
corepack pnpm test       # vitest: validators, templates, mapping
corepack pnpm check:rls  # isolation checks against local Supabase (two demo users)
corepack pnpm e2e        # browser checks in headless Chrome (needs dev server + Supabase)
corepack pnpm typecheck
E2E_BASE=http://localhost:3047 node tests/e2e/budgets.mjs   # recap budgets, against a production build (SPEC §7.6)
node tests/e2e/record.mjs  # phone-size MP4s of an app and a visit recap → tests/e2e/.out
node scripts/perf-home.mjs  # the home's queries at 10 campaigns × 10k rows (budget 300 ms)
node scripts/og-landing.mjs # redraw public/og.png (the landing's link preview)
node scripts/icons.mjs      # redraw favicon.ico, icon.svg, the touch/manifest icons and site.webmanifest
npx lighthouse@12.8.2 http://localhost:3047/ --form-factor=mobile --throttling-method=simulate --chrome-flags="--headless=new"   # and --preset=desktop; production build (SPEC §7.6)
python3 scripts/subset-caveat.py  # rebuild the landing's handwriting font subset (fonttools + brotli)
```

`pnpm` is not on PATH on this Mac; always go through `corepack pnpm`.

## Rules

- The product is **Highreel**: the lowercase wordmark, page titles ("Sign in · Highreel"), "Made with Highreel" on the share slide, share image and link preview, and anywhere copy names us. What each customer gets is a **highlight reel** in all copy since 2026-10-12 (owner: "recap" read like a nod to the old name): the landing, the app, emails, WhatsApp, the reels, errors, file names (`highreel-template-*.csv`), the links file's `link` column and the `{link}` placeholder (`{recap_url}` still works in saved messages). "reel" alone where space is tight ("Ana, your 2026 reel is here"). "recap" only as an ordinary word in a sentence, never as the product's noun. The repo folder, the package name (renaming it makes pnpm want a reinstall), the Supabase `project_id` (renaming it drops the local database), code names (`RecapPlayer`, `/r`, `recap.css`) and localStorage keys keep "recap".
- Verify UI changes in a real browser, not just by typecheck: `corepack pnpm e2e` (headless installed Chrome), and add a check to `tests/e2e/` for new behaviour. Claude in Chrome's window is often hidden on this Mac, which freezes animations.
- The workspace UI is a dense Airtable-style grid with a live recap preview. No dashboard cards, charts or stat tiles (SPEC §6).
- A recap's setup lives in its tabs (SPEC M2.6): Sheet is data and a preview only; wording, theme, photos and the button go in Design; publishing and sending in Share; name, logo and colour on Your brand. Don't add design controls back to the Sheet.
- UI controls are shadcn-vue components (`app/components/ui`, add more with `corepack pnpm dlx shadcn-vue@latest add …`): Select for dropdowns, DropdownMenu for actions, Checkbox/Switch, RadioGroup (cards: a Label holding its RadioGroupItem), `Segmented` (ToggleGroup) for pill choices, Tabs, NumberField, Tooltip on icon buttons. No native `<select>` or checkbox (SPEC M2.10). Their state classes (`data-checked:`, `data-active:`, `data-open:`) work through the custom variants in `main.css`; reka-ui sets `data-state`. Class names on reka-based components may not get a parent's scoped styles: pass Tailwind classes. Tests drive a Select by clicking its trigger, then `getByRole('option', …)`.
- Design is an editor since M2.8: a rail of compact rows (drag ⠿, eye), an inspector for the selected item, the phone (`PhoneStage`). New per-slide settings go in the inspector, not the rail. The template is picked in New recap only. Scroll panes get `relative`: without it `sr-only` labels inside them stretch the whole page (`editor.mjs` checks no tab scrolls the page).
- The app UI (sign-in, home, workspace) follows the landing's look since 2026-10-11 (SPEC §6.4): Outfit, the landing's ink/greys/blue tokens in `app/assets/css/main.css`, pill buttons, handwritten notes sparingly, no stickers or illustrations. Recaps keep Geist + Google Sans Code.
- The landing speaks to any business: example business names only appear inside the example phone (the landing e2e checks this).
- The landing scores 100 in every Lighthouse category on mobile and desktop (SPEC M2.11); re-run Lighthouse on a production build after changing it. It is prerendered, and `modules/landing-first-paint` rewrites its HTML at build time (CSS inline, its latin fonts preloaded, the app's script only after the largest paint). So: everything it shows must work from the HTML alone, the headline and lede never fade in from invisible, and nothing in its HTML may depend on the request (absolute URLs come from `siteHref()`/`useCanonical()`; `useRequestURL()` there is the build host).
- Terms and privacy (`/terms`, `/privacy`, SPEC M2.12) describe what the product really does with data. When data handling changes (a new provider, a new field in a payload, a new cookie, retention), update them and `LEGAL_UPDATED` in `app/data/legal.ts` in the same change. Legal name HighReel, contact hello@highreel.app (`app/data/legal.ts`). They're prerendered and rewritten like the landing (`FIRST_PAINT_ROUTES`) and must keep Lighthouse at 100.
- Search (SPEC M2.11): public pages get `useCanonical(path)` and a description; new public pages go into `server/routes/sitemap.xml.ts`; private ones get `X-Robots-Tag: noindex` in `routeRules`. robots.txt must not block `/r` or `/api/r/` (link previews read them; a blocked page can't say noindex). Structured data on the landing says only what the page shows.
- Business-type templates (`shared/templates/starters.ts`) sit on top of the sheet templates; New recap, the Brand panel and the landing's examples all read them. Their copy keys must exist in their sheet template (`tests/starters.test.ts`).
- Phones on the landing use `PhoneFrame` (iPhone frame, recap edge to edge via `--recap-inset-top`).
- Templates are data in `shared/templates/*.ts`. The column contracts there, in SPEC §4 and in `scripts/generate-sample.mjs` must stay in sync (`corepack pnpm test` checks each sample's planted errors).
- A recap can add its own columns and slides on top of its template (`settings.columns`, `settings.slides`, SPEC M2.7). Wherever a campaign or a recap payload is at hand, read its template with `templateFor(template_key, settings)`, not `getTemplate()` (that's the template alone). New scenes join the library in `shared/templates/own.ts` (`SCENES`, `scenesFor` per data kind), `SCENE_TIMING`, `RecapSlide`'s map and Design's `SCENE_ICONS`, and follow the scene rules below; `library.mjs` and the budgets cover each (27 since M2.10).
- Recaps only receive the columns a template's slides read (`toRecapRecipient`); never the id or email.
- Logos are stored as PNG: the link-preview renderer (resvg wasm) can't decode WebP.
- No third-party trackers on recap pages (`/r/*`). Keep `/r` lean: no Supabase browser client (it loads lazily, `app/plugins/supabase-lazy.client.ts`), no toasts/tooltips (they live in `layouts/default.vue`); JS ≤ 150 KB gzipped. Never lazy-import `RecapPlayer` itself (`LazyRecapPlayer`, `import()`): the bundler then puts a helper the player needs into whatever chunk it likes, and `/r` once pulled 21 KB of workspace code for it. The landing lazy-loads `LandingPlayer` instead. Check `/r`'s JS with `tests/e2e/budgets.mjs` after adding shared code or UI libraries.
- Recap scenes: animate only transform and opacity, base style = end state (reduced motion sets `animation: none`), timing from data via CSS variables, randomness seeded. Avoid class names that are Tailwind utilities (`ring`, `outline`, …): Tailwind generates them from the templates.
- "Save image" opens the save picker (SPEC M2.13): `RecapStill` draws any slide at its end state, `RecapSaver` captures ticked ones with modern-screenshot (imported only there; keep it out of `/r`'s first load). Since scenes double as saved images, they must look finished with `is-reduced` and nothing may depend on a clock to show its value. In recap CSS never write a literal `url(` inside a data URI (encode it as `url%28…%29`): the capture reads it as a file to fetch.
- Every business sees only its own data. Workspace routes call `requireUser(event)` and query with the user's session (RLS decides); the secret key (`tokenClient`) is only for token-addressed `/api/r/*` routes. Run `corepack pnpm check:rls` after touching policies, grants or routes.
- The Supabase secret key stays on the server.
- Recap emails go out through the business's own email account over SMTP (SPEC M2.9), never from an address of Highreel's: no connected account, no email (WhatsApp or the links file instead). Every send goes through `POST /api/campaigns/:id/send` (logged in `email_sends` for the account's daily limit, opt-outs skipped, demo sessions refused). The email is built once in `shared/utils/email.ts` for sending and for Share's preview, with no Recap branding. Saved SMTP passwords are encrypted (`server/utils/secrets.ts`, `NUXT_SECRETS_KEY`) and never returned; the server only connects to SMTP ports and never to private addresses (`smtpTarget`). Locally connect "Local test inbox (Mailpit)" (SMTP 54425, inbox http://127.0.0.1:54424).
- Phone numbers (the `phone` column, WhatsApp) are private like emails: never in a recap payload or on a slide.
- Bounces (SPEC M2.11, `server/utils/bounces.ts`): every send is prechecked (provider typos held, domains without mail bounced) and every failure classified: a bounce goes into `email_bounces` and that business never emails the address again; an answer about the account stops the run with the server's words; a batch with too many bounces pauses. Never send to a bounced or unsubscribed address. `tests/e2e/bounces.mjs` runs its own fake SMTP server.
- New tables need RLS policies plus explicit grants (`authenticated` for workspace access, `service_role` for token routes) in their migration: the current Supabase CLI grants nothing by default.
- Don't put a `font` key back in `components.json`: `shadcn-vue add` would inject a Google Fonts import (a third-party request on recaps).
- No git remote yet; don't push anywhere without asking.
