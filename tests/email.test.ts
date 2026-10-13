// The recap email (SPEC M2.8), email accounts and WhatsApp (M2.9), and the
// recap page's backdrop colours.
import { describe, expect, test } from 'vitest'
import { DEFAULT_SUBJECT, fillEmail, recapEmail, senderName } from '../shared/utils/email'
import { readableOn, shiftHue } from '../shared/utils/color'
import { normalizeSettings } from '../shared/utils/recap'
import { privateIp, reserved } from '../server/utils/mail'
import { waLink, waNumber, whatsappText } from '../shared/utils/whatsapp'
import { loginFor, presetFor, SMTP_PRESETS } from '../shared/utils/smtp'
import { templateFor } from '../shared/templates'
import { validateRow } from '../shared/utils/validate'
import { toRecapRecipient } from '../shared/utils/recap'

const base = {
  business: { name: 'Habitly', accent_color: '#4F46E5', website_url: 'https://habitly.app' },
  first_name: 'Ana',
  year: 2026,
  url: 'https://recap.local/r/abcdefghijkl',
  unsubscribeUrl: 'https://recap.local/unsubscribe/abcdefghijkl',
}

describe('recap email', () => {
  test('defaults fill in the person, the business and the year', () => {
    const m = recapEmail(base)
    expect(m.subject).toBe('Ana, your 2026 with Habitly')
    expect(m.text).toContain('Hi Ana,')
    expect(m.text).toContain('Open your Highreel: https://recap.local/r/abcdefghijkl')
    expect(m.text).toContain('Unsubscribe: https://recap.local/unsubscribe/abcdefghijkl')
    expect(m.html).toContain('href="https://recap.local/r/abcdefghijkl"')
    expect(m.html).toContain('href="https://recap.local/unsubscribe/abcdefghijkl"')
    expect(m.html).toContain('href="https://habitly.app"')
  })

  test('the business\'s own subject and message, paragraphs kept', () => {
    const m = recapEmail({ ...base, copy: { subject: '{first_name}, look!', body: 'Hi {first_name},\n\nLine one\nline two.' } })
    expect(m.subject).toBe('Ana, look!')
    expect(m.html).toContain('>Line one<br>line two.</p>')
  })

  test('typed text is escaped, unknown braces stay', () => {
    const m = recapEmail({ ...base, business: { ...base.business, name: 'Tom & <Jerry>' }, first_name: '<b>Ana</b>', copy: { subject: '', body: 'Your {plan} with {business}' } })
    expect(m.html).not.toContain('<b>Ana</b>')
    expect(m.html).toContain('Tom &amp; &lt;Jerry&gt;')
    expect(m.text).toContain('Your {plan} with Tom & <Jerry>')
  })

  test('the button is the business\'s colour with readable text', () => {
    const m = recapEmail({ ...base, business: { ...base.business, accent_color: '#F5C518' } })
    expect(m.html).toContain(`background:#F5C518;color:${readableOn('#F5C518')}`)
  })

  test('no line breaks reach the subject or the sender name', () => {
    expect(recapEmail({ ...base, copy: { subject: 'Hi\r\nBcc: x@y.z', body: '' } }).subject).toBe('Hi Bcc: x@y.z')
    expect(senderName('Evil"\r\n<x@y.z>')).toBe('Evilx@y.z')
    expect(senderName('   ')).toBe('Highreel')
  })

  test('a blank name still greets someone', () => {
    expect(fillEmail(DEFAULT_SUBJECT, { first_name: 'there', business: 'X', year: 2026 })).toBe('there, your 2026 with X')
    expect(recapEmail({ ...base, first_name: ' ' }).text).toContain('Hi there,')
  })

  test('settings keep the email copy and the consent', () => {
    const s = normalizeSettings({ email: { subject: 'S', body: 'B' }, email_consent_at: '2026-10-12T00:00:00Z' })
    expect(s.email).toEqual({ subject: 'S', body: 'B' })
    expect(s.email_consent_at).toBe('2026-10-12T00:00:00Z')
    expect(normalizeSettings({}).email).toEqual({ subject: '', body: '' })
  })
})

describe('reserved addresses (not sent by a real provider)', () => {
  test.each(['a@example.com', 'b@mail.example.org', 'c@x.test', 'd@localhost', 'e@shop.invalid'])('%s', (a) => {
    expect(reserved(a)).toBe(true)
  })
  test.each(['ana@gmail.com', 'me@examples.com', 'x@example.co.uk'])('%s is real', (a) => {
    expect(reserved(a)).toBe(false)
  })
})

describe('shiftHue', () => {
  test('turns around the wheel and keeps greys', () => {
    expect(shiftHue('#FF0000', 120)).toBe('#00FF00')
    expect(shiftHue('#FF0000', -120)).toBe('#0000FF')
    expect(shiftHue('#4F46E5', 360)).toBe('#4F46E5')
    expect(shiftHue('#808080', 40)).toBe('#808080')
  })
})

describe('WhatsApp numbers and messages', () => {
  test.each([
    ['+44 7700 900123', '', '447700900123'],
    ['0044 7700 900123', '', '447700900123'],
    ['447700900123', '', '447700900123'],
    ['044 123 456', '+383', '38344123456'],
    ['044 123 456', '', null],
    ['+383 (44) 123-456', '', '38344123456'],
    ['12345', '', null],
    ['', '+383', null],
  ])('%s with %s → %s', (phone, country, out) => {
    expect(waNumber(phone, country)).toBe(out)
  })

  test('the link goes at the end unless the text places it', () => {
    const vars = { first_name: 'Ana', business: 'Habitly', year: 2026, link: 'https://r.test/r/abc' }
    expect(whatsappText('', vars)).toBe('Hi Ana! We made your 2026 with Habitly into a little Highreel, just for you: https://r.test/r/abc')
    expect(whatsappText('Hey {first_name}, look', vars)).toBe('Hey Ana, look\n\nhttps://r.test/r/abc')
    expect(whatsappText('{link} is yours, {first_name}', vars)).toBe('https://r.test/r/abc is yours, Ana')
    // Messages saved before {link} still fill in their old {recap_url}.
    expect(whatsappText('{recap_url} is yours', vars)).toBe('https://r.test/r/abc is yours')
    expect(waLink('447700900123', 'Hi Ana & co')).toBe('https://wa.me/447700900123?text=Hi%20Ana%20%26%20co')
  })

  test('phone numbers validate as typed and never reach a recap', () => {
    const t = templateFor('app')
    const phone = t.columns.find(c => c.key === 'phone')!
    expect(validateRow({ customer_id: 'a', first_name: 'Ana', active_days: '3', phone: '+44 7700 900123' }, t).data.phone).toBe('+447700900123')
    expect(validateRow({ customer_id: 'a', first_name: 'Ana', active_days: '3', phone: 'call me' }, t).errors.phone).toBe('Not a phone number')
    expect(phone.type).toBe('phone')
    const r = toRecapRecipient(t, { first_name: 'Ana', active_days: 3, phone: '+447700900123', email: 'a@b.c' }, null, { copy: { active_days: '{phone} {email}' } })
    expect(JSON.stringify(r)).not.toContain('7700')
    expect(JSON.stringify(r)).not.toContain('a@b.c')
  })
})

describe('email accounts', () => {
  test('presets give the right login', () => {
    const input = { email: 'Ana@Shop.com ', username: 'custom', password: 'tok' }
    expect(loginFor(presetFor('gmail'), input)).toBe('Ana@Shop.com')
    expect(loginFor(presetFor('resend'), input)).toBe('resend')
    expect(loginFor(presetFor('sendgrid'), input)).toBe('apikey')
    expect(loginFor(presetFor('postmark'), input)).toBe('tok')
    expect(loginFor(presetFor('brevo'), input)).toBe('custom')
    expect(presetFor('nope').key).toBe('other')
    expect(SMTP_PRESETS.filter(p => p.dev).map(p => p.key)).toEqual(['local'])
  })

  test.each(['10.1.2.3', '127.0.0.1', '192.168.1.1', '172.20.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])('%s is private', (ip) => {
    expect(privateIp(ip)).toBe(true)
  })
  test.each(['8.8.8.8', '142.250.1.1', '2a00:1450:4001::1'])('%s is public', (ip) => {
    expect(privateIp(ip)).toBe(false)
  })
})
