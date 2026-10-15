// Unsubscribing from a business's recap emails (SPEC M2.8), addressed by the
// recap's token like the other public recap routes, so it uses the unscoped
// database (tokenDb). Only the row's address, its business and the colour of
// its Highreel's look (the page wears it, SPEC M2.17) are read; nothing else
// leaves.

import type { H3Event } from 'h3'
import { cleanLook, resolveLook } from '#shared/templates/designs'

export async function unsubscribeTarget(event: H3Event) {
  const token = getRouterParam(event, 'token') ?? ''
  if (!isToken(token))
    throw createError({ statusCode: 404, message: 'Not found' })
  const db = tokenDb(event)
  const row = await db.prepare(`select json_extract(r.data, '$.email') as email, c.business_id, b.name,
      json_extract(c.settings, '$.look') as look, json_extract(c.settings, '$.theme') as theme
    from recipients r join campaigns c on c.id = r.campaign_id join businesses b on b.id = c.business_id
    where r.token = ?`).bind(token).first<{ email: unknown, business_id: string, name: string, look: string | null, theme: string | null }>()
  if (!row)
    throw createError({ statusCode: 404, message: 'Not found' })
  const email = isEmail(row.email) ? row.email.trim().toLowerCase() : null
  return {
    email,
    business: { name: row.name },
    accent: resolveLook(cleanLook(parseLook(row.look), row.theme)).accent,
    /** Whether this address is already off the business's list. */
    async done() {
      return !!email && !!await db.prepare('select 1 from email_optouts where business_id = ? and email = ?').bind(row.business_id, email).first()
    },
    async unsubscribe() {
      if (email)
        await db.prepare('insert into email_optouts (business_id, email) values (?, ?) on conflict do nothing').bind(row.business_id, email).run()
    },
  }
}

function parseLook(json: string | null): unknown {
  try {
    return json ? JSON.parse(json) : null
  }
  catch {
    return null
  }
}
