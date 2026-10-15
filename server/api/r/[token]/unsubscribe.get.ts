// The unsubscribe page's details: the business, its Highreel's colour, and whether this address is already off its list.

export default defineEventHandler(async (event) => {
  const target = await unsubscribeTarget(event)
  return { business: target.business, accent: target.accent, hasEmail: !!target.email, done: await target.done() }
})
