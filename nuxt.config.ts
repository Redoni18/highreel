// https://nuxt.com/docs/api/configuration/nuxt-config
import { builtinModules } from 'node:module'
import tailwindcss from '@tailwindcss/vite'
import { SCHEDULE } from './server/schedule'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    'shadcn-nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
  ],

  css: ['~/assets/css/main.css'],

  hooks: {
    // No prefetch hints (SPEC M2.5 P2): on a phone, the landing and recaps
    // spent their first seconds downloading chunks for pages they never open
    // (the workspace layout, error pages). Those chunks still
    // load when a route needs them.
    'build:manifest'(manifest) {
      for (const meta of Object.values(manifest))
        meta.prefetch = false
    },
  },

  // App components keep their file names (DataGrid, RecapPlayer, …) instead
  // of folder-prefixed ones. shadcn-vue components stay under ui/.
  components: [
    { path: '~/components/grid', pathPrefix: false },
    { path: '~/components/recap', pathPrefix: false },
    { path: '~/components/workspace', pathPrefix: false },
    { path: '~/components/landing', pathPrefix: false },
    { path: '~/components/home', pathPrefix: false },
    '~/components',
  ],

  runtimeConfig: {
    // Encrypts the SMTP passwords businesses connect (SPEC M2.9) and signs
    // /media links (M2.14 P2). Required in production; a development server
    // has a stand-in.
    secretsKey: '',
    // Sign-in (Better Auth, SPEC M2.14 P3, server/utils/auth.ts). NUXT_AUTH_SECRET
    // signs session cookies: required in production (any long random string),
    // derived from the one above in development.
    authSecret: '',
    // Cloudflare Turnstile's secret for the sign-in bot check (NUXT_TURNSTILE_SECRET).
    // Locally its test key, which always passes (.env.example).
    turnstileSecret: '',
    // Better Auth's per-IP limits on sign-in. Local runs set NUXT_AUTH_RATE_LIMIT=false:
    // tests start many demo sessions from one address.
    authRateLimit: true,
    // Google sign-in: the provider exists only with both (NUXT_GOOGLE_CLIENT_ID,
    // NUXT_GOOGLE_CLIENT_SECRET); NUXT_PUBLIC_AUTH_GOOGLE draws the button.
    googleClientId: '',
    googleClientSecret: '',
    public: {
      // Base for recap links in the export; blank means "the current origin".
      siteUrl: '',
      // The public site, for canonical links, link previews, robots.txt and
      // the sitemap (SPEC M2.11). Not the request's origin: the landing is
      // built once, and local or preview hosts mustn't compete with it in search.
      siteOrigin: 'https://highreel.app',
      // Show "Continue with Google" on /login (needs a Google OAuth client, SPEC M2a.2).
      authGoogle: false,
      // Turnstile's site key (NUXT_PUBLIC_TURNSTILE_SITE_KEY), for /login and "Keep my work".
      turnstileSiteKey: '',
    },
  },

  nitro: {
    // One Worker on Cloudflare (SPEC M2.14, wrangler.jsonc). `pnpm dev` emulates
    // its bindings (event.context.cloudflare.env); budgets and Lighthouse run on
    // the built Worker (`wrangler dev`). Cloudflare compresses responses itself,
    // so there are no pre-compressed copies.
    preset: 'cloudflare_module',
    // Link-preview images (SPEC M2g): resvg's WebAssembly is an ESM import
    // (server/utils/og.ts), a compiled module on Workers; the Geist TTFs live
    // in server/assets/fonts (served as assets:server).
    // Tasks: the scheduled jobs in server/tasks (SPEC M2.14 P4), run by the
    // Worker's Cron Triggers (wrangler.jsonc). In dev, POST /_nitro/tasks/:name
    // runs one now (that endpoint exists only on the dev server).
    experimental: { wasm: true, tasks: true },
    scheduledTasks: SCHEDULE,
    // Bundled CommonJS that requires a Node built-in gets what Node gives it,
    // the module's default export. Nitro's "auto" gave nodemailer the
    // namespace on Workers, where node:events is an ES module, and its
    // `class Mail extends require('events')` threw "Class extends value
    // [object Module]" (SPEC M2.14 P0; nodemailer issue #1621).
    commonJS: {
      requireReturnsDefault: id => (id.startsWith('node:') || builtinModules.includes(id) ? 'preferred' : 'auto'),
    },
  },

  routeRules: {
    // The landing is static: built once, served as a file (SPEC M2.11). Its
    // HTML is tuned for the first paint in modules/landing-first-paint.
    '/': { prerender: true },
    // Terms and privacy (SPEC M2.12): static too, and tuned like the landing.
    '/terms': { prerender: true },
    '/privacy': { prerender: true },
    '/robots.txt': { prerender: true },
    '/sitemap.xml': { prerender: true },
    // Sign-in and the workspace have nothing for search engines (robots.txt keeps them out of /app too).
    '/login': { headers: { 'X-Robots-Tag': 'noindex' } },
    '/confirm': { headers: { 'X-Robots-Tag': 'noindex' } },
    // The home and the workspace are browser tools (file drop, canvas, keyboard grid).
    '/app': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    '/app/**': { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } },
    // Recaps are personal: keep them out of search engines (SPEC §7.5).
    '/r/**': { headers: { 'X-Robots-Tag': 'noindex' } },
    '/unsubscribe/**': { headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
    '/api/r/**': { headers: { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' } },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Highreel',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      // Drawn by scripts/icons.mjs.
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  colorMode: {
    classSuffix: '',
    preference: 'light',
    fallback: 'light',
    storageKey: 'color-mode',
    disableTransition: true,
  },

  // Same type pairing as the portfolio: Geist for text, Google Sans Code
  // (MONO axis pinned to 1) for numbers, ids and badges. The landing adds
  // Outfit (headlines and text).
  fonts: {
    defaults: {
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
    },
    families: [
      { name: 'Geist', provider: 'google', global: true, weights: ['400 700'] },
      { name: 'Google Sans Code', provider: 'google', global: true, weights: ['400 600'] },
      // The landing only (not global: @nuxt/fonts adds it where CSS uses it).
      // Its handwritten notes use a Caveat subset from public/fonts instead
      // (scripts/subset-caveat.py): the full font is 74 KB.
      // Its fallbacks are sized to match it, so the text doesn't move when it loads.
      { name: 'Outfit', provider: 'google', weights: ['400 700'], fallbacks: ['Arial', 'Roboto'] },
    ],
    google: {
      experimental: {
        variableAxis: {
          'Google Sans Code': { MONO: ['1'] },
        },
      },
    },
  },

  typescript: {
    strict: true,
  },
})
