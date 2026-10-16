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

/**
 * The white wordmark on the email's card (public/email/, drawn by
 * scripts/icons.mjs). Mail apps keep images by address, so bump `v` whenever
 * it's redrawn.
 */
export const EMAIL_LOGO = '/email/highreel-wordmark-white.png?v=1'

// The email is one Highreel slide (owner, 2026-10-16, design "B · Slide"): a
// dark card with story bars, the white wordmark, a big headline and a yellow
// button. Mail apps want tables, inline styles and hex colours: the button is
// a coloured cell around the link so Outlook on Windows draws it too, a hidden
// preheader sets the inbox's preview line, and the light scheme is pinned so
// mail apps don't recolour the page around the card. Outfit shows only where
// it's installed; everywhere else it's the system font.
const FONT = `Outfit,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`
const SLIDE = '#141414'
const MARKER = '#FFE45C'
const PAGE = '#F2F2F2'

const storyBars = ['#FFFFFF', '#3A3A3A', '#3A3A3A'].map((colour, i) =>
  `<td width="33%" style="padding:0 ${i < 2 ? 3 : 0}px 0 ${i > 0 ? 3 : 0}px"><div style="height:3px;line-height:3px;font-size:0;border-radius:3px;background:${colour}">&nbsp;</div></td>`).join('')

/** `keep`: the link also keeps a demo session's work ("Keep my work"). */
export function signInEmail(url: string, keep = false): { subject: string, html: string, text: string } {
  const hour = SIGN_IN_LINK_MINUTES === 60 ? 'hour' : `${SIGN_IN_LINK_MINUTES} minutes`
  const subject = keep ? 'Keep your Highreel demo' : 'Your Highreel sign-in link'
  const preheader = keep ? 'One click keeps what you made in your demo.' : `It works once, within the next ${hour}.`
  const headline = keep ? 'Keep what you made.' : 'Let’s get you signed in.'
  const lede = keep
    ? 'This button keeps the work from your demo session and signs you in to Highreel with this email from now on.'
    : 'Use the button below to sign in to Highreel. No password needed.'
  const button = keep ? 'Keep my work' : 'Sign in to Highreel'
  const site = new URL(url).origin
  const href = escape(url)
  // The headline's last two words stay together, so none ends on a line of its own.
  const head = escape(headline).replace(/ (\S+)$/, '&nbsp;$1')
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escape(preheader)}${'&#8199;&#847;'.repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE}">
<tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;font-family:${FONT}">
<tr><td bgcolor="${SLIDE}" style="background:${SLIDE};border-radius:28px;padding:18px 28px 32px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:0 0 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${storyBars}</tr></table></td></tr>
<tr><td style="padding:0 0 56px"><img src="${escape(site + EMAIL_LOGO)}" width="96" height="28" alt="Highreel" style="display:block;border:0;width:96px;height:auto"></td></tr>
<tr><td style="padding:0 0 16px;font-size:42px;line-height:44px;font-weight:700;letter-spacing:-0.03em;color:#FFFFFF">${head}</td></tr>
<tr><td style="padding:0 0 36px;font-size:16px;line-height:24px;color:#B5B5B5">${escape(lede)}</td></tr>
<tr><td style="padding:0 0 56px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${MARKER}" style="border-radius:999px;background:${MARKER}"><a href="${href}" style="display:inline-block;padding:15px 30px;border-radius:999px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:${SLIDE};text-decoration:none">${escape(button)}</a></td>
</tr></table></td></tr>
<tr><td style="font-size:13px;line-height:18px;color:#8A8A8A">Works once · within the next ${hour}</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:24px 12px 0;font-size:13px;line-height:20px;color:#6F6F6F">Didn’t ask for this? You can ignore this email.</td></tr>
<tr><td align="center" style="padding:8px 12px 0;font-size:12px;line-height:18px;color:#9A9A9A;word-break:break-all">Or paste this into your browser: <a href="${href}" style="color:#6F6F6F;text-decoration:underline">${href}</a></td></tr>
<tr><td align="center" style="padding:20px 12px 0;font-size:12px;line-height:18px"><a href="${escape(site)}" style="color:#9A9A9A;text-decoration:none;font-weight:600">highreel.app</a></td></tr>
</table>
</td></tr></table>
</body></html>`
  // The plain-text twin has no button, so it says "this link".
  const textLede = keep
    ? 'Open this link to keep the work from your demo session. It signs you in to Highreel with this email from now on.'
    : 'Open this link to sign in to Highreel. No password needed.'
  const text = `${textLede}\n\n${url}\n\nThe link works once, within the next ${hour}. If you didn’t ask for it, you can ignore this email.\n`
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
