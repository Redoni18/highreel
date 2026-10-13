// WhatsApp, one tap per person (SPEC M2.9): each person's chat opens on the
// business's own WhatsApp with their message and link already typed. No API:
// WhatsApp's click-to-chat links (wa.me) take the full international number,
// digits only, and the text.

export const DEFAULT_WHATSAPP = 'Hi {first_name}! We made your {year} with {business} into a little Highreel, just for you: {link}'
export const WHATSAPP_MAX = 700

/**
 * The number as WhatsApp wants it: country code and number, digits only.
 * "+44 7700 900123", "0044…" and "447700900123" are international already;
 * "044 123 456" is national: with the country +383 it becomes 38344123456
 * (the leading 0 goes), without one it can't be sent (null). Null too when
 * there aren't enough digits for a phone number.
 */
export function waNumber(phone: string | null | undefined, country = ''): string | null {
  const raw = String(phone ?? '').trim()
  if (!raw)
    return null
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+'))
    digits = raw.replace(/\D/g, '')
  else if (digits.startsWith('00'))
    digits = digits.slice(2)
  else if (digits.startsWith('0')) {
    // Written the national way: it needs the country code.
    const cc = country.replace(/\D/g, '')
    if (!cc)
      return null
    digits = cc + digits.replace(/^0+/, '')
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

/** The message for one person: placeholders filled, and the link at the end if the text doesn't place it. */
export function whatsappText(template: string, vars: { first_name: string, business: string, year: number, link: string }): string {
  // {recap_url} is the link's old name (messages saved before 2026-10-12).
  const text = (template.trim() || DEFAULT_WHATSAPP).replace(/\{(first_name|business|year|link|recap_url)\}/g, (_, k: string) => String(k === 'recap_url' ? vars.link : vars[k as keyof typeof vars]))
  return /\{(link|recap_url)\}/.test(template) || !template.trim() ? text : `${text}\n\n${vars.link}`
}

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`
}
