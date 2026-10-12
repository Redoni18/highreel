// Sending recap emails through the business's own email account (SPEC M2.9):
// plain SMTP with nodemailer, from their address, so mail comes from someone
// the reader knows and rides on their own sending reputation. Highreel never
// sends from an address of its own. The server only talks to SMTP ports, and
// outside development never to private, loopback or link-local addresses, so
// the connect form can't be used to probe our network.

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type { EmailConnection } from '#shared/utils/smtp'
import { classify, type Outcome } from './bounces'

export interface OutMail {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}
/** One send: ok, or what went wrong and what it means (server/utils/bounces.ts). */
export interface SentMail { ok: boolean, id?: string, error?: string, kind?: Outcome['kind'] }

/** A connection with its password, decrypted (server only). */
export interface SmtpAccount extends EmailConnection { password: string }

const SMTP_PORTS = new Set([25, 465, 587, 2525])
const message = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, ' ').slice(0, 300)

/** Addresses that can't receive mail (RFC 2606/6761: the samples use example.com). A real server would bounce them. */
export function reserved(address: string): boolean {
  const domain = address.slice(address.lastIndexOf('@') + 1).toLowerCase()
  return /(?:^|\.)example\.(?:com|org|net)$/.test(domain) || /\.(?:example|test|invalid|localhost)$/.test(domain) || domain === 'localhost'
}

/** A plain check: something@something.tld, no spaces. */
export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export const isLocalHost = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '::1'

/** Private, loopback, link-local and other non-public IPs. */
export function privateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number) as [number, number]
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  const v = ip.toLowerCase()
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:') && privateIp(v.slice(7))
}

/**
 * Where to connect: the host checked, and on a public host the address it
 * resolved to (so a second lookup can't point somewhere else), with the name
 * kept for TLS.
 */
export async function smtpTarget(host: string, port: number): Promise<{ address: string, servername: string }> {
  const name = host.trim().toLowerCase()
  if (!/^[a-z0-9.-]{1,253}$/.test(name) && !isIP(name))
    throw createError({ statusCode: 400, message: 'That server name doesn\'t look right' })
  if (import.meta.dev && isLocalHost(name))
    return { address: name, servername: name }
  if (!SMTP_PORTS.has(port))
    throw createError({ statusCode: 400, message: 'Use an SMTP port: 465, 587, 25 or 2525' })
  let address: string
  try {
    const found = await lookup(name, { all: true })
    if (!found.length || found.some(f => privateIp(f.address)))
      throw new Error('private')
    address = found[0]!.address
  }
  catch {
    throw createError({ statusCode: 400, message: `Can't reach ${name}: check the server name` })
  }
  return { address, servername: name }
}

async function transport(account: SmtpAccount, pool: boolean) {
  const target = await smtpTarget(account.host, account.port)
  const local = import.meta.dev && isLocalHost(target.address)
  const options: SMTPTransport.Options = {
    host: target.address,
    port: account.port,
    secure: account.secure,
    // STARTTLS on 587/25/2525 when the server offers it, and required off localhost.
    requireTLS: !account.secure && !local,
    auth: account.username || account.password ? { user: account.username, pass: account.password } : undefined,
    tls: { servername: target.servername },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  }
  return pool ? nodemailer.createTransport({ ...options, pool: true, maxConnections: 2 }) : nodemailer.createTransport(options)
}

/** Log in and say why not, in the server's words ("535 Username and Password not accepted"). */
export async function verifyAccount(account: SmtpAccount): Promise<void> {
  const t = await transport(account, false)
  try {
    await t.verify()
  }
  catch (e) {
    throw createError({ statusCode: 400, message: `The mail server said no: ${message(e)}` })
  }
  finally {
    t.close()
  }
}

/**
 * Send through the business's account, one message at a time over a small
 * pool. Stops at the first answer that's about the account (login, spam
 * policy, quota, the server gone): the rest come back unsent, so fewer
 * results than mails means "stopped".
 */
export async function sendMails(account: SmtpAccount, mails: OutMail[]): Promise<SentMail[]> {
  const local = isLocalAccount(account)
  const t = await transport(account, true)
  const from = { name: account.from_name, address: account.from_email }
  const out: SentMail[] = []
  try {
    for (const m of mails) {
      if (reserved(m.to) && !local) {
        out.push({ ok: false, error: 'An example address: it takes no email', kind: 'bounce' })
        continue
      }
      try {
        const info = await t.sendMail({ from, to: m.to, replyTo: account.reply_to || undefined, subject: m.subject, html: m.html, text: m.text, headers: m.headers })
        out.push(info.rejected?.length ? { ok: false, error: `Refused: ${info.rejected.join(', ')}`, kind: 'bounce' } : { ok: true, id: info.messageId })
      }
      catch (e) {
        const o = classify(e as Parameters<typeof classify>[0])
        out.push({ ok: false, error: o.reason, kind: o.kind })
        if (o.kind === 'account')
          break
      }
    }
  }
  finally {
    t.close()
  }
  return out
}

/** The local test inbox (Mailpit) in development: takes every address, the samples' example.com ones too. */
export const isLocalAccount = (account: { host: string }) => import.meta.dev && isLocalHost(account.host.trim().toLowerCase())

/** The business's connection without its password (what routes return). */
export async function loadConnection(db: SupabaseClient, businessId: string): Promise<(EmailConnection & { password_enc: string }) | null> {
  const { data, error } = await db.from('email_connections').select('*').eq('business_id', businessId).maybeSingle()
  if (error)
    dbError(error, 'Loading your email account')
  return data as (EmailConnection & { password_enc: string }) | null
}

export function publicConnection(c: EmailConnection & { password_enc?: string }): EmailConnection {
  return {
    provider: c.provider,
    host: c.host,
    port: c.port,
    secure: c.secure,
    username: c.username,
    from_email: c.from_email,
    from_name: c.from_name,
    reply_to: c.reply_to,
    daily_limit: c.daily_limit,
    verified_at: c.verified_at,
  }
}

export async function accountFor(event: H3Event, c: EmailConnection & { password_enc: string }): Promise<SmtpAccount> {
  return { ...publicConnection(c), password: await decryptSecret(event, c.password_enc) }
}
