// Bounces (SPEC M2.11). Recaps go out through the business's own email
// account, so every bad address costs them: their provider counts bounces,
// and enough of them get the account limited. Three guards:
// - before sending, the address's domain has to take mail (an MX record, or
//   an address record as RFC 5321 allows; a "null MX" says it takes none),
//   and near-misses of the big providers (gmial.com) are held back;
// - the mail server's answer is sorted: a dead address (5.1.x, 5.2.1, a 5xx
//   to RCPT TO) is a bounce, remembered for the business (email_bounces); a
//   problem with the account or the message (login, 5.7.x policy or spam,
//   quotas, the server unreachable) stops the run with the server's words;
//   anything else (4xx, timeouts) can be tried again;
// - a run pauses once too many bounce, before the provider notices.
// Bounces that arrive later as a message in the business's inbox aren't
// seen: Highreel doesn't read their mail.

import { Resolver } from 'node:dns/promises'

/**
 * bounce: the address is dead (suppressed for the business); hold: not sent,
 * fix it in the Sheet (a typo); retry: try again later; account: nothing
 * else will go through this account now (stop the run).
 */
export type Outcome = { kind: 'bounce' | 'hold' | 'retry' | 'account', reason: string }

interface SmtpError {
  code?: string
  responseCode?: number
  response?: string
  command?: string
  message?: string
  rejectedErrors?: SmtpError[]
}

const squash = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 200)

/** What a failed send means, from nodemailer's error. */
export function classify(e: SmtpError): Outcome {
  const first = e.rejectedErrors?.[0] ?? e
  const code = first.responseCode ?? e.responseCode
  const toRecipient = (first.command ?? e.command ?? '').toUpperCase().startsWith('RCPT')
  const text = squash(first.response ?? e.response ?? first.message ?? e.message ?? 'Not sent')
  const bounce = { kind: 'bounce', reason: text } as const
  const account = { kind: 'account', reason: text } as const
  const retry = { kind: 'retry', reason: text } as const

  if (e.code === 'EAUTH' || code === 530 || code === 534 || code === 535)
    return account
  const status = text.match(/\b([245])\.(\d{1,3})\.(\d{1,3})\b/)
  if (status) {
    const [, klass, subject, detail] = status
    if (klass === '5') {
      // 5.1.x: no such address or domain (5.1.7 and 5.1.8 are about the sender).
      if (subject === '1')
        return detail === '7' || detail === '8' ? account : bounce
      // 5.2.1: mailbox disabled; other 5.2.x (full, too big for it): maybe later.
      if (subject === '2')
        return detail === '1' ? bounce : retry
      // 5.4.1 (no such recipient here), 5.4.4 (no route to its domain).
      if (subject === '4' && (detail === '1' || detail === '4'))
        return bounce
      // Policy and spam (5.7.x), quotas (5.4.5), the message (5.3.x, 5.6.x).
      if (subject === '7' || subject === '3' || subject === '6' || subject === '4')
        return account
      return toRecipient ? bounce : account
    }
    // 4.x.x: later, except throttling and quotas, which stop the run.
    return subject === '7' || (subject === '4' && detail === '5') ? account : retry
  }
  if (code && code >= 500)
    return toRecipient ? bounce : account
  if (code && code >= 400)
    return retry
  if (['ECONNECTION', 'ESOCKET', 'EDNS', 'ETIMEDOUT', 'ECONNREFUSED', 'ETLS', 'EPROTOCOL'].includes(e.code ?? ''))
    return account
  return retry
}

/** Big mailbox providers: a domain one keystroke away from one of these is almost always a typo. */
const PROVIDERS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com',
  'hotmail.co.uk', 'yahoo.co.uk', 'btinternet.com', 'comcast.net', 'verizon.net', 'outlook.de',
]
/** Real domains one keystroke from a provider. */
const REAL = new Set(['mail.com', 'email.com', 'ymail.com', 'gmx.com', 'hotmail.de', 'hotmail.fr', 'hotmail.it', 'hotmail.es', 'yahoo.de', 'yahoo.fr', 'yahoo.ca', 'yahoo.es', 'yahoo.it', 'outlook.fr', 'outlook.es', 'outlook.it', 'live.com', 'msn.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'pm.me', 'gmx.de', 'gmx.net', 'web.de'])

/** Optimal string alignment distance (a swap of two neighbours counts once). */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 1; j <= b.length; j++)
    d[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1)
    }
  }
  return d[a.length]![b.length]!
}

/** The provider a domain looks like a misspelling of ("gmial.com" → "gmail.com"), if any. */
export function typoOf(domain: string): string | null {
  const d = domain.toLowerCase()
  if (PROVIDERS.includes(d) || REAL.has(d))
    return null
  return PROVIDERS.find(p => distance(d, p) === 1) ?? null
}

export type DomainCheck = 'ok' | 'none' | 'unknown'
type MxResolver = Pick<Resolver, 'resolveMx' | 'resolve4' | 'resolve6'>

/** Whether a domain takes mail. "unknown" when DNS didn't answer: send anyway. */
export async function mailDomain(domain: string, resolver: MxResolver = new Resolver({ timeout: 2500, tries: 2 })): Promise<DomainCheck> {
  const code = (e: unknown) => (e as { code?: string }).code
  try {
    const mx = await resolver.resolveMx(domain)
    if (mx.length && mx.every(r => r.exchange === '' || r.exchange === '.'))
      return 'none'
    if (mx.length)
      return 'ok'
  }
  catch (e) {
    // Workers (SPEC M2.14) answer "no MX records" with ENOTFOUND too, not only
    // "no such domain": the address records below tell the two apart.
    if (code(e) !== 'ENODATA' && code(e) !== 'ENOTFOUND')
      return 'unknown'
  }
  // No MX: an address record means the host takes mail itself (RFC 5321 §5.1).
  const any = await Promise.all([resolver.resolve4(domain), resolver.resolve6(domain)].map(p => p.then(r => r.length > 0, (e: unknown) => (code(e) === 'ENODATA' || code(e) === 'ENOTFOUND' ? false : null))))
  return any.includes(true) ? 'ok' : any.includes(null) ? 'unknown' : 'none'
}

/**
 * Addresses to hold back before sending: near-misses of the big providers
 * ("hold") and domains that take no mail ("bounce"). `skipDns` for the local
 * test inbox, which takes the samples' example.com addresses.
 */
export async function precheck(addresses: string[], skipDns: (domain: string) => boolean = () => false, check = mailDomain): Promise<Map<string, Outcome>> {
  const out = new Map<string, Outcome>()
  const domains = new Map<string, Promise<DomainCheck>>()
  const domainOf = (a: string) => a.slice(a.lastIndexOf('@') + 1).toLowerCase()
  for (const a of addresses) {
    const typo = typoOf(domainOf(a))
    if (typo)
      out.set(a, { kind: 'hold', reason: `Looks like a typo of ${typo}: fix the address in the Sheet` })
    else if (!skipDns(domainOf(a)) && !domains.has(domainOf(a)))
      domains.set(domainOf(a), check(domainOf(a)))
  }
  const results = new Map(await Promise.all([...domains].map(async ([d, p]) => [d, await p] as const)))
  for (const a of addresses) {
    if (!out.has(a) && results.get(domainOf(a)) === 'none')
      out.set(a, { kind: 'bounce', reason: `${domainOf(a)} takes no email` })
  }
  return out
}

/** Pause a run once this many of a batch bounce (and at least a fifth of it). */
export function tooManyBounces(bounced: number, tried: number): boolean {
  return bounced >= 5 && bounced >= tried / 5
}
