// The workspace needs a session (SPEC M2.14 P3): /app and everything under it
// sends a visitor without one to /login, which brings them back afterwards.
// Other pages (the landing, recaps) don't ask at all. The admin pages
// (/app/admin, SPEC M2.15) also need the admin role: anyone else goes home.
// The server checks the role again on every admin route.
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || !/^\/app(?:\/|$)/.test(to.path))
    return
  const auth = useAuth()
  const user = await auth.ensure()
  if (user)
    return /^\/app\/admin(?:\/|$)/.test(to.path) && user.role !== 'admin' ? navigateTo('/app', { replace: true }) : undefined
  const query: Record<string, string> = auth.ended.value ? { expired: '1' } : {}
  if (to.fullPath !== '/app')
    query.next = to.fullPath
  return navigateTo({ path: '/login', query })
})
