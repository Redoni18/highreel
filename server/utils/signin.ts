// The sign-in email (SPEC M2.14 P3): Highreel's own, never a business's.
// Resend delivers it on Cloudflare (resend.ts, NUXT_RESEND_API_KEY, since
// 2026-10-16), from noreply@highreel.app with replies going to hello@. Without
// that key, Cloudflare Email Sending (the EMAIL binding) still can, from hello@.
// A development server sends it to Mailpit over SMTP instead, so the link can
// be opened from http://127.0.0.1:54424.

import type { SendEmail } from '@cloudflare/workers-types'
import { sendWithResend } from './resend'

/** How long a sign-in link works. The email states it, so both read this. */
export const SIGN_IN_LINK_MINUTES = 60

/** Nobody needs to answer a sign-in link; a reply still reaches the contact address. */
const SIGN_IN_FROM = { name: 'Highreel', email: 'noreply@highreel.app' }
const REPLY_TO = 'hello@highreel.app'
/** Email Sending's binding may only send from this address (wrangler.jsonc). */
const EMAIL_SENDING_FROM = { name: 'Highreel', email: 'hello@highreel.app' }

/** How sign-in emails leave the Worker: Resend when its key is set, else Email Sending. */
export interface SignInSender {
  resendKey?: string
  binding?: SendEmail
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** `keep`: the link also keeps a demo session's work ("Keep my work"). */
export function signInEmail(url: string, keep = false): { subject: string, html: string, text: string } {
  const subject = keep ? 'Keep your Highreel demo' : 'Your Highreel sign-in link'
  const lede = keep
    ? 'Open this link to keep the work from your demo session. It signs you in to Highreel with this email from now on.'
    : 'Open this link to sign in to Highreel.'
  const button = keep ? 'Keep my work' : 'Sign in to Highreel'
  const fine = `The link works once, within the next ${SIGN_IN_LINK_MINUTES === 60 ? 'hour' : `${SIGN_IN_LINK_MINUTES} minutes`}. If you didn't ask for it, you can ignore this email.`
  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111">
<div style="max-width:440px;margin:0 auto">
<p style="margin:0 0 24px;font-size:16px;line-height:1.5">${escape(lede)}</p>
<p style="margin:0 0 24px"><a href="${escape(url)}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#111111;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">${escape(button)}</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#666666">${escape(fine)}</p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#666666;word-break:break-all">Or paste this into your browser: ${escape(url)}</p>
</div></body></html>`
  const text = `${lede}\n\n${url}\n\n${fine}\n`
  return { subject, html, text }
}

/** Send it: through Resend (or Email Sending) on Cloudflare, to Mailpit on a development server. */
export async function sendSignInEmail(via: SignInSender, to: string, url: string, keep = false) {
  const mail = signInEmail(url, keep)
  if (import.meta.dev) {
    const [sent] = await sendMails({
      provider: 'local',
      host: '127.0.0.1',
      port: 54425,
      secure: false,
      username: '',
      password: '',
      from_email: SIGN_IN_FROM.email,
      from_name: SIGN_IN_FROM.name,
      reply_to: REPLY_TO,
      daily_limit: 2000,
      verified_at: null,
    }, [{ to, ...mail }])
    if (!sent?.ok)
      throw new Error(`Mailpit didn't take the sign-in email (is it running? \`corepack pnpm mail\`): ${sent?.error ?? 'no answer'}`)
    return
  }
  if (via.resendKey) {
    await sendWithResend(via.resendKey, { from: `${SIGN_IN_FROM.name} <${SIGN_IN_FROM.email}>`, to, replyTo: REPLY_TO, ...mail })
    return
  }
  if (!via.binding)
    throw new Error('No way to send sign-in emails: set NUXT_RESEND_API_KEY, or the EMAIL binding (wrangler.jsonc)')
  await via.binding.send({ from: EMAIL_SENDING_FROM, to, subject: mail.subject, html: mail.html, text: mail.text })
}
