// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/supabase',
    'shadcn-nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
  ],

  css: ['~/assets/css/main.css'],

  // The Supabase browser client loads lazily (app/plugins/supabase-lazy.client.ts),
  // so recap pages and the landing don't ship supabase-js. Drop the module's
  // eager client plugin and point the lazy one at it.
  alias: {
    '#supabase-client-plugin': fileURLToPath(new URL('./node_modules/@nuxtjs/supabase/dist/runtime/plugins/supabase.client.js', import.meta.url)),
  },
  hooks: {
    'app:resolve'(app) {
      app.plugins = app.plugins.filter(p => !/@nuxtjs\/supabase\/dist\/runtime\/plugins\/supabase\.client/.test(p.src))
    },
    // No prefetch hints (SPEC M2.5 P2): on a phone, the landing and recaps
    // spent their first seconds downloading chunks for pages they never open
    // (supabase-js, the workspace layout, error pages). Those chunks still
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
    // Encrypts the SMTP passwords businesses connect (SPEC M2.9). Required in
    // production; a development server derives one from the Supabase secret key.
    secretsKey: '',
    public: {
      // Base for recap links in the export; blank means "the current origin".
      siteUrl: '',
      // The public site, for canonical links, link previews, robots.txt and
      // the sitemap (SPEC M2.11). Not the request's origin: the landing is
      // built once, and local or preview hosts mustn't compete with it in search.
      siteOrigin: 'https://highreel.app',
      // Show "Continue with Google" on /login (needs a Google OAuth client, SPEC M2a.2).
      authGoogle: false,
    },
  },

  // Auth + RLS (SPEC M2a). Reads SUPABASE_URL, SUPABASE_KEY (publishable) and
  // SUPABASE_SECRET_KEY from .env. Workspace routes use the user's session;
  // only token-addressed recap routes use the secret key.
  supabase: {
    types: false,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      include: ['/app', '/app/**'],
      saveRedirectToCookie: true,
    },
    cookieOptions: {
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      // Safari drops Secure cookies on http://localhost.
      secure: process.env.NODE_ENV === 'production',
    },
  },

  // Link-preview images (SPEC M2g): resvg's WebAssembly comes from node_modules;
  // the Geist TTFs live in server/assets/fonts (served as assets:server).
  nitro: {
    // Serve pre-compressed JS/CSS when the Node server is used (Cloudflare compresses on its own).
    compressPublicAssets: true,
    serverAssets: [
      { baseName: 'resvg', dir: fileURLToPath(new URL('./node_modules/@resvg/resvg-wasm', import.meta.url)) },
    ],
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
