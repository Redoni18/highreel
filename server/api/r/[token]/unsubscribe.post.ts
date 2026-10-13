// Unsubscribe this recap's address from its business's recap emails (SPEC
// M2.8). Mail apps' one-click unsubscribe (List-Unsubscribe-Post) posts here
// and gets JSON; the unsubscribe page's form posts `page=1` and is sent back
// to the page, so the button works before (or without) JavaScript.

export default defineEventHandler(async (event) => {
  await (await unsubscribeTarget(event)).unsubscribe()
  const body = await readBody<Record<string, unknown> | string | null>(event).catch(() => null)
  if (body && typeof body === 'object' && body.page === '1')
    return sendRedirect(event, `/unsubscribe/${getRouterParam(event, 'token')}`, 303)
  return { done: true }
})
