// The email each person gets (SPEC M2.8; since M2.9 sent from the business's
// own account): the business's subject and message with {first_name},
// {business} and {year} filled in, a button to the recap in the business's
// colour, and a footer with the unsubscribe link. It comes from the business:
// no Highreel sender, logo or footer; only the button names what they get, their
// Highreel (owner, 2026-10-12). Built here so the server sends exactly what the Share
// tab previews.

import { mix, normalizeHex, readableOn } from './color'

export const DEFAULT_SUBJECT = '{first_name}, your {year} with {business}'
export const DEFAULT_BODY = 'Hi {first_name},\n\nWe made something just for you: your {year} with {business}, in a few taps.\n\nThank you for being part of our year.'
const BUTTON_LABEL = 'Open your Highreel'
export const SUBJECT_MAX = 120
export const BODY_MAX = 1000

export interface EmailCopy { subject: string, body: string }

export interface RecapEmailInput {
  business: { name: string, accent_color: string, website_url?: string | null }
  first_name: string
  year: number
  copy?: Partial<EmailCopy> | null
  url: string
  unsubscribeUrl: string
}

export interface RecapEmail { subject: string, text: string, html: string }

/** {first_name}, {business} and {year}; anything else in braces stays as typed. */
export function fillEmail(template: string, vars: { first_name: string, business: string, year: number }): string {
  return template.replace(/\{(first_name|business|year)\}/g, (_, k: keyof typeof vars) => String(vars[k]))
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)
}

/** A display name that can't break the From header. */
export function senderName(name: string): string {
  return name.replace(/[\r\n"<>\\]/g, '').trim().slice(0, 60) || 'Highreel'
}

export function recapEmail(input: RecapEmailInput): RecapEmail {
  const vars = { first_name: input.first_name.trim() || 'there', business: input.business.name, year: input.year }
  const subject = fillEmail(input.copy?.subject?.trim() || DEFAULT_SUBJECT, vars).replace(/[\r\n]+/g, ' ').slice(0, 200)
  const body = fillEmail(input.copy?.body?.trim() || DEFAULT_BODY, vars)
  const accent = normalizeHex(input.business.accent_color) ?? '#111111'
  const onAccent = readableOn(accent)
  const page = mix(accent, '#FFFFFF', 0.08)
  const name = escape(input.business.name)
  const website = input.business.website_url && /^https?:\/\//i.test(input.business.website_url) ? input.business.website_url : null
  const font = '-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif'

  const paragraphs = body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    .map(p => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#222222;">${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
  const heading = website
    ? `<a href="${escape(website)}" style="color:#222222;text-decoration:none;">${name}</a>`
    : name

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:0;background:${page};font-family:${font};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${page};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:20px;">
<tr><td style="padding:28px 28px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;height:36px;border-radius:18px;background:${accent};color:${onAccent};font-size:17px;font-weight:700;text-align:center;line-height:36px;">${escape(input.business.name.trim().charAt(0).toUpperCase() || 'R')}</td>
<td style="padding-left:10px;font-size:15px;font-weight:600;color:#222222;">${heading}</td>
</tr></table>
</td></tr>
<tr><td style="padding:16px 28px 4px;">${paragraphs}</td></tr>
<tr><td style="padding:4px 28px 32px;">
<a href="${escape(input.url)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:${accent};color:${onAccent};font-size:16px;font-weight:600;text-decoration:none;">${BUTTON_LABEL}</a>
</td></tr>
</table>
<p style="max-width:440px;margin:18px auto 0;font-size:12px;line-height:1.5;color:#6F6F6F;">You're getting this because you're a customer of ${name}. <a href="${escape(input.unsubscribeUrl)}" style="color:#6F6F6F;">Unsubscribe</a></p>
</td></tr></table>
</body></html>`

  const text = `${body}\n\n${BUTTON_LABEL}: ${input.url}\n\n--\nYou're getting this because you're a customer of ${input.business.name}.\nUnsubscribe: ${input.unsubscribeUrl}`
  return { subject, text, html }
}
