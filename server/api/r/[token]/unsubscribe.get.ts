// The unsubscribe page's details: the business, and whether this address is already off its list.

export default defineEventHandler(async (event) => {
  const { db, email, businessId, business } = await unsubscribeTarget(event)
  let done = false
  if (email) {
    const { data, error } = await db.from('email_optouts').select('email').eq('business_id', businessId).eq('email', email).maybeSingle()
    if (error)
      dbError(error, 'Loading unsubscribes')
    done = !!data
  }
  return { business: { name: business.name, accent_color: business.accent_color }, hasEmail: !!email, done }
})
