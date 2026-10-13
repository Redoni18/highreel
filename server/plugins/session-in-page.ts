// The workspace and /login carry the session in their HTML (SPEC §7.7): their
// script used to ask /api/session first and only then load the page and ask
// for its data, a whole round trip more on every load (from Kosovo, whose
// IPv6 lands in Rio, ~0.4 s). useAuth() reads it once; later questions (after
// signing in or out) still go to /api/session. These pages are never
// prerendered or cached (routeRules: no-store), so the answer is always this
// request's.

const ASKS_ON_LOAD = /^\/(?:app(?:\/|$)|login$)/

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    if (import.meta.prerender || !ASKS_ON_LOAD.test(getRequestURL(event).pathname))
      return
    const answer = await sessionAnswer(event).catch(() => null)
    if (!answer)
      return
    // JSON inside <script>: a "</script>" in it can't end it early.
    const json = JSON.stringify(answer).replace(/</g, '\\u003c')
    html.head.push(`<script>window.__hrSession=${json}</script>`)
  })
})
