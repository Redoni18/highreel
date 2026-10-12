// Email accounts a business can send its recap emails through (SPEC M2.9):
// presets for the usual providers, so "Connect your email" only asks for the
// address and a password. Everything is plain SMTP; "Other" takes any server.
// Daily limits sit a little under each provider's own, so a big list carries
// on the next day instead of getting the account blocked.

export interface SmtpPreset {
  key: string
  label: string
  host: string
  port: number
  /** implicit TLS (465); otherwise STARTTLS */
  secure: boolean
  /** the login: the address itself, a fixed name ("apikey"), the token again, or typed in */
  username: 'email' | 'password' | 'ask' | { fixed: string }
  /** what the password field is called and where to get one */
  password: { label: string, help?: string, url?: string }
  dailyLimit: number
  /** shown under the form */
  note?: string
  /** host and port can be edited (a region, a different server) */
  editable?: boolean
  /** only on a development server: the local Mailpit, no login */
  dev?: boolean
}

export const SMTP_PRESETS: SmtpPreset[] = [
  {
    key: 'gmail', label: 'Gmail', host: 'smtp.gmail.com', port: 465, secure: true, username: 'email',
    password: { label: 'App password', help: 'Google only lets apps send with an app password (16 letters), made in your Google account with 2-step verification on.', url: 'https://myaccount.google.com/apppasswords' },
    dailyLimit: 450, note: 'Gmail sends up to 500 emails a day; bigger lists go out over a few days.',
  },
  {
    key: 'workspace', label: 'Google Workspace', host: 'smtp.gmail.com', port: 465, secure: true, username: 'email',
    password: { label: 'App password', help: 'Made in your Google account with 2-step verification on. If it isn\'t offered, your Workspace admin has turned app passwords off.', url: 'https://myaccount.google.com/apppasswords' },
    dailyLimit: 1900, note: 'Workspace sends up to 2,000 emails a day.',
  },
  {
    key: 'microsoft', label: 'Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false, username: 'email',
    password: { label: 'Password', help: 'Your mailbox password, or an app password if your account uses one. Your admin may need to turn on "Authenticated SMTP" for the mailbox.' },
    dailyLimit: 2000, note: 'Microsoft turns this kind of sign-in off by default at the end of 2026; admins can turn it back on.',
  },
  {
    key: 'icloud', label: 'iCloud Mail', host: 'smtp.mail.me.com', port: 587, secure: false, username: 'email',
    password: { label: 'App-specific password', help: 'Made at account.apple.com under Sign-In and Security.', url: 'https://account.apple.com' },
    dailyLimit: 900,
  },
  {
    key: 'zoho', label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, secure: true, username: 'email', editable: true,
    password: { label: 'App password', help: 'Made in Zoho under Security, App passwords. Accounts in the EU use smtp.zoho.eu.' },
    dailyLimit: 450,
  },
  {
    key: 'resend', label: 'Resend', host: 'smtp.resend.com', port: 465, secure: true, username: { fixed: 'resend' },
    password: { label: 'API key', help: 'A Resend API key with sending access. The address must be on a domain you verified in Resend.', url: 'https://resend.com/api-keys' },
    dailyLimit: 2000,
  },
  {
    key: 'postmark', label: 'Postmark', host: 'smtp.postmarkapp.com', port: 587, secure: false, username: 'password',
    password: { label: 'Server API token', help: 'From your Postmark server, API Tokens. The address must be a confirmed sender signature or domain.' },
    dailyLimit: 2000,
  },
  {
    key: 'sendgrid', label: 'SendGrid', host: 'smtp.sendgrid.net', port: 587, secure: false, username: { fixed: 'apikey' },
    password: { label: 'API key', help: 'A SendGrid API key with Mail Send access; the address must be a verified sender.' },
    dailyLimit: 2000,
  },
  {
    key: 'brevo', label: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, secure: false, username: 'ask',
    password: { label: 'SMTP key', help: 'In Brevo under SMTP & API: the SMTP login goes in Login, an SMTP key here.' },
    dailyLimit: 2000,
  },
  {
    key: 'mailgun', label: 'Mailgun', host: 'smtp.mailgun.org', port: 587, secure: false, username: 'ask', editable: true,
    password: { label: 'SMTP password', help: 'Your domain\'s SMTP credentials in Mailgun. EU domains use smtp.eu.mailgun.org.' },
    dailyLimit: 2000,
  },
  {
    key: 'ses', label: 'Amazon SES', host: 'email-smtp.us-east-1.amazonaws.com', port: 587, secure: false, username: 'ask', editable: true,
    password: { label: 'SMTP password', help: 'SES SMTP credentials (not your AWS keys). Change the region in the server name if yours differs.' },
    dailyLimit: 2000,
  },
  {
    key: 'other', label: 'Other (any SMTP server)', host: '', port: 587, secure: false, username: 'ask', editable: true,
    password: { label: 'Password', help: 'Your mail server\'s details are usually in your email or hosting provider\'s help pages, under SMTP or "sending from other apps".' },
    dailyLimit: 2000,
  },
  {
    key: 'local', label: 'Local test inbox (Mailpit)', host: '127.0.0.1', port: 54425, secure: false, username: 'ask', dev: true,
    password: { label: 'Password (none needed)' },
    dailyLimit: 2000, note: 'Development only: everything lands in Mailpit at http://127.0.0.1:54424.',
  },
]

export const presetFor = (key: string) => SMTP_PRESETS.find(p => p.key === key) ?? SMTP_PRESETS.find(p => p.key === 'other')!

/** The login a preset uses for this address and password. */
export function loginFor(preset: SmtpPreset, input: { email: string, username: string, password: string }): string {
  const u = preset.username
  if (u === 'email')
    return input.email.trim()
  if (u === 'password')
    return input.password.trim()
  if (typeof u === 'object')
    return u.fixed
  return input.username.trim()
}

/** What Share and Your brand show about a connection (never the password). */
export interface EmailConnection {
  provider: string
  host: string
  port: number
  secure: boolean
  username: string
  from_email: string
  from_name: string
  reply_to: string | null
  daily_limit: number
  verified_at: string | null
}
