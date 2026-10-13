// The workspace needs a session (SPEC M2.14 P3): /app and everything under it
// sends a visitor without one to /login, which brings them back afterwards.
// Other pages (the landing, recaps) don't ask at all.
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || !/^\/app(?:\/|$)/.test(to.path))
    return
  const auth = useAuth()
  if (await auth.ensure())
    return
  const query: Record<string, string> = auth.ended.value ? { expired: '1' } : {}
  if (to.fullPath !== '/app')
    query.next = to.fullPath
  return navigateTo({ path: '/login', query })
})
