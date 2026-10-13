// Cloudflare Web Analytics on our own public pages (owner, 2026-10-13): the
// landing, the examples, terms, privacy and sign-in. Never on a Highreel (/r)
// or an unsubscribe page: there we act for the business, and their customers'
// visits aren't ours to count (privacy policy §4, §5; tests/analytics.test.ts).
// Cloudflare's automatic injection is off for highreel.app, so this snippet
// is the only one. It sets no cookies. It loads on the live site only (not
// local runs or tests) and once the page is idle, after the largest paint.
const BEACON = 'https://static.cloudflareinsights.com/beacon.min.js'
// The site's Web Analytics token: public, it's in every page that loads the beacon.
const TOKEN = '0c94de44f23440f39c6716d1c1a27164'

export function usePublicAnalytics() {
  const host = new URL(useRuntimeConfig().public.siteOrigin).hostname
  onMounted(() => {
    // Already there: Cloudflare's own injection (a longer URL), or an earlier page's.
    if (location.hostname !== host || document.querySelector(`script[src^="${BEACON}"]`))
      return
    const add = () => {
      // As Cloudflare's snippet has it: a module script (deferred by itself).
      const script = document.createElement('script')
      script.type = 'module'
      script.src = BEACON
      // spa: false, so it counts the page it loaded on and not the workspace a visitor moves on to.
      script.dataset.cfBeacon = JSON.stringify({ token: TOKEN, spa: false })
      document.head.appendChild(script)
    }
    if ('requestIdleCallback' in window)
      requestIdleCallback(add, { timeout: 4000 })
    else
      setTimeout(add, 2000)
  })
}
