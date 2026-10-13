// Bounces (SPEC M2.11): what a mail server's answer means, typos of the big
// providers, domains that take no mail, and when a run pauses.
import { describe, expect, test } from 'vitest'
import { classify, mailDomain, precheck, tooManyBounces, typoOf } from '../server/utils/bounces'

const rcpt = (responseCode: number, response: string) => ({ code: 'EENVELOPE', command: 'RCPT TO', responseCode, response, rejectedErrors: [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode, response }] })

describe('classify', () => {
  test('a dead address is a bounce', () => {
    expect(classify(rcpt(550, '550 5.1.1 <ana@farm.test>: Recipient address rejected: User unknown')).kind).toBe('bounce')
    expect(classify(rcpt(550, '550-5.1.1 The email account that you tried to reach does not exist.')).kind).toBe('bounce')
    expect(classify(rcpt(550, '550 5.2.1 The email account that you tried to reach is disabled.')).kind).toBe('bounce')
    expect(classify(rcpt(550, '550 5.4.1 Recipient address rejected: Access denied')).kind).toBe('bounce')
    // No enhanced code: a 5xx to RCPT TO is still about the recipient.
    expect(classify(rcpt(550, '550 No such user here')).kind).toBe('bounce')
  })
  test('the account or the message stops the run', () => {
    expect(classify({ code: 'EAUTH', responseCode: 535, response: '535-5.7.8 Username and Password not accepted.' }).kind).toBe('account')
    expect(classify({ command: 'DATA', responseCode: 550, response: '550-5.4.5 Daily user sending limit exceeded.' }).kind).toBe('account')
    expect(classify({ command: 'DATA', responseCode: 554, response: '554 5.7.1 Message rejected as spam' }).kind).toBe('account')
    expect(classify(rcpt(554, '554 5.7.1 <ana@farm.test>: Relay access denied')).kind).toBe('account')
    expect(classify({ command: 'MAIL FROM', responseCode: 553, response: '553 5.1.8 Sender address rejected' }).kind).toBe('account')
    expect(classify({ responseCode: 421, response: '421 4.7.0 Try again later, closing connection.' }).kind).toBe('account')
    expect(classify({ code: 'ECONNECTION', message: 'Connection closed unexpectedly' }).kind).toBe('account')
  })
  test('anything temporary can be tried again', () => {
    expect(classify(rcpt(452, '452 4.2.2 The email account that you tried to reach is over quota.')).kind).toBe('retry')
    expect(classify(rcpt(552, '552 5.2.2 Mailbox full')).kind).toBe('retry')
    expect(classify(rcpt(450, '450 Mailbox busy')).kind).toBe('retry')
  })
  test('the reason is the server\'s own words, on one line', () => {
    expect(classify(rcpt(550, '550-5.1.1 The email account\n550 does not exist')).reason).toBe('550-5.1.1 The email account 550 does not exist')
  })
})

describe('typoOf', () => {
  test('one keystroke from a big provider', () => {
    expect(typoOf('gmial.com')).toBe('gmail.com')
    expect(typoOf('gmail.con')).toBe('gmail.com')
    expect(typoOf('gmai.com')).toBe('gmail.com')
    expect(typoOf('hotmial.com')).toBe('hotmail.com')
    expect(typoOf('yahooo.com')).toBe('yahoo.com')
    expect(typoOf('outlok.com')).toBe('outlook.com')
    expect(typoOf('iclod.com')).toBe('icloud.com')
  })
  test('real domains are left alone', () => {
    for (const d of ['gmail.com', 'mail.com', 'email.com', 'ymail.com', 'yahoo.ca', 'hotmail.fr', 'farm.test', 'getforevermore.co', 'gmx.com'])
      expect(typoOf(d)).toBeNull()
  })
})

const err = (code: string) => Object.assign(new Error(code), { code })
const resolver = (mx: Record<string, string[] | string>, a: Record<string, string[] | string> = {}) => ({
  resolveMx: async (d: string) => {
    const v = mx[d] ?? 'ENODATA'
    if (typeof v === 'string')
      throw err(v)
    return v.map(exchange => ({ exchange, priority: 10 }))
  },
  resolve4: async (d: string) => {
    const v = a[d] ?? 'ENODATA'
    if (typeof v === 'string')
      throw err(v)
    return v
  },
  resolve6: async () => { throw err('ENODATA') },
}) as unknown as Parameters<typeof mailDomain>[1]

describe('mailDomain', () => {
  test('MX, null MX, no domain, A fallback, DNS down', async () => {
    const r = resolver({ 'farm.test': ['mx.farm.test'], 'nomail.test': ['.'], 'gone.test': 'ENOTFOUND', 'down.test': 'ETIMEOUT' }, { 'host.test': ['203.0.113.7'] })
    expect(await mailDomain('farm.test', r)).toBe('ok')
    expect(await mailDomain('nomail.test', r)).toBe('none')
    expect(await mailDomain('gone.test', r)).toBe('none')
    expect(await mailDomain('host.test', r)).toBe('ok')
    expect(await mailDomain('bare.test', r)).toBe('none')
    // DNS didn't answer: don't hold anyone back.
    expect(await mailDomain('down.test', r)).toBe('unknown')
  })

  test('Workers: ENOTFOUND for "no records of this type" too (SPEC M2.14 P0)', async () => {
    const r = {
      resolveMx: async (d: string) => {
        if (d === 'farm.test')
          return [{ exchange: 'mx.farm.test', priority: 10 }]
        throw err('ENOTFOUND')
      },
      resolve4: async (d: string) => {
        if (d === 'host.test')
          return ['203.0.113.7']
        throw err('ENOTFOUND')
      },
      resolve6: async () => { throw err('ENOTFOUND') },
    } as unknown as Parameters<typeof mailDomain>[1]
    expect(await mailDomain('farm.test', r)).toBe('ok')
    // No MX but an address record: takes mail, not a bounce.
    expect(await mailDomain('host.test', r)).toBe('ok')
    expect(await mailDomain('gone.test', r)).toBe('none')
  })
})

describe('precheck', () => {
  test('holds typos, bounces dead domains, checks each domain once, skips the local inbox\'s', async () => {
    const asked: string[] = []
    const check = async (d: string) => {
      asked.push(d)
      return d === 'gone.test' ? 'none' as const : 'ok' as const
    }
    const out = await precheck(['ana@gmial.com', 'ben@gone.test', 'cy@gone.test', 'di@farm.test', 'ed@example.com'], d => d === 'example.com', check)
    expect(out.get('ana@gmial.com')).toEqual({ kind: 'hold', reason: 'Looks like a typo of gmail.com: fix the address in the Sheet' })
    expect(out.get('ben@gone.test')?.kind).toBe('bounce')
    expect(out.get('cy@gone.test')?.kind).toBe('bounce')
    expect(out.has('di@farm.test') || out.has('ed@example.com')).toBe(false)
    expect(asked.sort()).toEqual(['farm.test', 'gone.test'])
  })
})

test('a run pauses at 5 bounces and a fifth of the batch', () => {
  expect(tooManyBounces(4, 4)).toBe(false)
  expect(tooManyBounces(5, 25)).toBe(true)
  expect(tooManyBounces(5, 26)).toBe(false)
})
