// Connect (or change) the business's email account (SPEC M2.9). Nothing is
// saved until the server has logged in with it and sent a test to the
// address: a wrong password comes back in the mail server's own words. A
// blank password keeps the saved one when the server and login stay the same.

import type { EmailConnection } from '#shared/utils/smtp'
import { senderName } from '#shared/utils/email'
import { presetFor } from '#shared/utils/smtp'
import { checkText as text } from '../../utils/brand'

interface Body {
  provider?: string
  host?: string
  port?: number
  secure?: boolean
  username?: string
  password?: string
  from_email?: string
  from_name?: string
  reply_to?: string | null
  daily_limit?: number
}

export default defineEventHandler(async (event): Promise<{ connection: EmailConnection }> => {
  const { db, userId, anonymous } = await requireUser(event)
  if (anonymous)
    throw createError({ statusCode: 403, message: 'Add your email to keep your work first, then connect an account to send from' })
  const business = await ensureBusiness(db, userId)
  const body = (await readBody<Body>(event)) ?? {}

  const preset = presetFor(String(body.provider ?? 'other'))
  if (preset.dev && !import.meta.dev)
    throw createError({ statusCode: 400, message: 'Pick your email provider' })
  const host = preset.editable || preset.key === 'other' ? text(body.host ?? '', 'Server', 253, true).toLowerCase() : preset.host
  const port = preset.editable || preset.key === 'other' ? Math.round(Number(body.port)) : preset.port
  const secure = preset.editable || preset.key === 'other' ? body.secure === true : preset.secure
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw createError({ statusCode: 400, message: 'Port must be a number like 465 or 587' })
  const from_email = text(body.from_email ?? '', 'Email address', 254, true).toLowerCase()
  if (!isEmail(from_email))
    throw createError({ statusCode: 400, message: 'That email address doesn\'t look right' })
  const from_name = senderName(text(body.from_name ?? '', 'Name', 60) || business.name)
  const reply = text(body.reply_to ?? '', 'Replies to', 254).toLowerCase()
  if (reply && !isEmail(reply))
    throw createError({ statusCode: 400, message: 'The reply address doesn\'t look right' })
  const username = text(body.username ?? '', 'Login', 254)
  const limit = Math.round(Number(body.daily_limit ?? preset.dailyLimit))
  if (!Number.isInteger(limit) || limit < 1 || limit > 100_000)
    throw createError({ statusCode: 400, message: 'Daily limit: a number from 1 to 100,000' })

  // A blank password keeps the saved one, but only for the same server and login.
  const saved = await loadConnection(db, business.id)
  let password = typeof body.password === 'string' ? body.password.trim() : ''
  if (password.length > 500)
    throw createError({ statusCode: 400, message: 'That password is too long' })
  if (!password && saved && saved.host === host && saved.username === username)
    password = await decryptSecret(event, saved.password_enc)
  if (!password && !preset.dev)
    throw createError({ statusCode: 400, message: `Enter the ${preset.password.label.toLowerCase()}` })

  const account = { provider: preset.key, host, port, secure, username, password, from_email, from_name, reply_to: reply || null, daily_limit: limit, verified_at: null }
  await verifyAccount(account)
  const [test] = await sendMails(account, [{
    to: from_email,
    subject: `${from_name} is connected to Highreel`,
    text: `Highreel can now send your highlight reels from ${from_email}.\n\nThey go out through your own account, so they come from you, and copies may show up in your Sent folder. You can change or disconnect this on Your brand at any time.`,
    html: `<p style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">Highreel can now send your highlight reels from <b>${from_email}</b>.</p><p style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">They go out through your own account, so they come from you, and copies may show up in your Sent folder. You can change or disconnect this on Your brand at any time.</p>`,
  }])
  if (!test?.ok)
    throw createError({ statusCode: 400, message: `Logged in, but the test email didn't go out: ${test?.error ?? 'unknown error'}` })

  const row = {
    business_id: business.id,
    provider: preset.key,
    host,
    port,
    secure,
    username,
    password_enc: password ? await encryptSecret(event, password) : '',
    from_email,
    from_name,
    reply_to: reply || null,
    daily_limit: limit,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await db.from('email_connections').upsert(row, { onConflict: 'business_id' }).select('*').single()
  if (error)
    dbError(error, 'Saving your email account')
  return { connection: publicConnection(data) }
})
