// Resend (resend.com), the provider for Highreel's own emails since 2026-10-16:
// today the sign-in links (signin.ts). Plain fetch to its REST API, so it runs
// on the Worker. The domain highreel.app is verified there (DKIM on
// resend._domainkey, bounces on send.highreel.app, EU region). Highreels
// never go through here: they go through the business's own account (mail.ts,
// SPEC M2.9).

export interface ResendEmail {
  /** `Name <address>` on highreel.app */
  from: string
  to: string
  subject: string
  html: string
  text: string
  replyTo?: string
}

/** Send one email; answers Resend's id for it, or throws with Resend's reason. */
export async function sendWithResend(apiKey: string, mail: ResendEmail): Promise<string> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: mail.from,
      to: [mail.to],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  })
  const body = await res.json().catch(() => null) as { id?: string, name?: string, message?: string } | null
  if (!res.ok || !body?.id)
    throw new Error(`Resend didn't take the email (${res.status}${body?.name ? ` ${body.name}` : ''}): ${body?.message ?? 'no answer'}`)
  return body.id
}
