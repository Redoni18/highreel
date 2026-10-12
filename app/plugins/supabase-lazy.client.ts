// Loads the Supabase browser client only where it's used (SPEC M2.5 P1).
// @nuxtjs/supabase's own client plugin is removed in nuxt.config.ts: it put
// supabase-js (~55 KB gzipped) in every page's entry and made every page wait
// for auth.getSession() before hydrating, recaps included. Recap pages and
// the landing never sign anyone in, so they skip it; any other route loads
// the module's plugin before its page runs (here on first load, or in the
// middleware on client-side navigation). Example recaps (/example/*) are
// static and skip it too.

const PUBLIC = /^\/(?:r\/|example\/|unsubscribe\/|$)/

let loading: Promise<void> | undefined

export default defineNuxtPlugin({
  name: 'supabase-lazy',
  enforce: 'pre',
  async setup(nuxtApp) {
    const load = () => {
      loading ??= import('#supabase-client-plugin').then(({ default: plugin }) =>
        nuxtApp.runWithContext(() => (plugin as unknown as (app: typeof nuxtApp) => Promise<void>)(nuxtApp)))
      return loading
    }
    // Registered before the module's auth-redirect middleware, so the session is known when that runs.
    addRouteMiddleware('supabase-load', async (to) => {
      if (!PUBLIC.test(to.path))
        await load()
    }, { global: true })
    if (!PUBLIC.test(window.location.pathname))
      await load()
  },
})
