// Bounces (SPEC M2.11), through a fake mail server that answers like real
// ones: a typo of a big provider is held back before sending; a dead address
// bounces once and is skipped from then on (remembered for the business); a
// busy mailbox can be tried again; a quota answer stops the run with the
// server's words and leaves the rest waiting; the Sheet shows why a row
// didn't go out; a corrected address gets a fresh try; a batch where too
// many bounce pauses the run.
import { createServer } from 'node:net'
import { BASE, campaignId, demoSession, expect, finish, keepWork, launch, publish, tab, watchErrors, rowsOf, sql } from './lib.mjs'

// --- A small SMTP server: refuses gone*@ (5.1.1), busy*@ (4.2.0), quota*@ (5.4.5) while `quota` is on.
const smtp = { quota: true, busy: true, delivered: [], tried: new Map() }
const server = createServer((socket) => {
  let data = false
  let buf = ''
  let rcpt = null
  const say = line => socket.write(`${line}\r\n`)
  say('220 fake.test ESMTP')
  socket.on('data', (chunk) => {
    buf += chunk.toString('utf8')
    for (;;) {
      if (data) {
        const end = buf.indexOf('\r\n.\r\n')
        if (end < 0)
          return
        buf = buf.slice(end + 5)
        data = false
        smtp.delivered.push(rcpt)
        say('250 2.0.0 OK queued')
        continue
      }
      const nl = buf.indexOf('\r\n')
      if (nl < 0)
        return
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 2)
      const cmd = line.toUpperCase()
      if (cmd.startsWith('EHLO') || cmd.startsWith('HELO'))
        say('250-fake.test\r\n250-AUTH PLAIN\r\n250 8BITMIME')
      else if (cmd.startsWith('AUTH'))
        say('235 2.7.0 Authentication successful')
      else if (cmd.startsWith('MAIL FROM'))
        say('250 2.1.0 OK')
      else if (cmd.startsWith('RCPT TO')) {
        rcpt = line.match(/<([^>]+)>/)?.[1]?.toLowerCase() ?? ''
        smtp.tried.set(rcpt, (smtp.tried.get(rcpt) ?? 0) + 1)
        if (rcpt.startsWith('gone'))
          say(`550 5.1.1 <${rcpt}>: Recipient address rejected: User unknown`)
        else if (rcpt.startsWith('busy') && smtp.busy)
          say('451 4.2.0 Mailbox busy, try again later')
        else if (rcpt.startsWith('quota') && smtp.quota)
          say('550 5.4.5 Daily user sending limit exceeded')
        else
          say('250 2.1.5 OK')
      }
      else if (cmd === 'DATA') {
        data = true
        say('354 End data with <CR><LF>.<CR><LF>')
      }
      else if (cmd === 'QUIT') {
        say('221 2.0.0 Bye')
        socket.end()
      }
      else {
        say('250 OK')
      }
    }
  })
  socket.on('error', () => {})
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const PORT = server.address().port

const browser = await launch()
const errors = []
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
watchErrors(page, errors, /status of (400|403|429)/)
const call = (path, method, body) => page.evaluate(async ([p, m, b]) => {
  const r = await fetch(p, { method: m, headers: { 'content-type': 'application/json' }, body: b === undefined ? undefined : JSON.stringify(b) })
  return { status: r.status, body: await r.json().catch(() => null) }
}, [path, method, body])

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await publish(page)
const id = campaignId(page)
await keepWork(page, `owner-${Date.now()}@example.com`, `${BASE}/app/c/${id}/share`)
const connected = await call('/api/business/email', 'PUT', { provider: 'other', host: '127.0.0.1', port: PORT, secure: false, username: 'shop', password: 'pw', from_email: 'hello@shop.test', from_name: 'The Shop' })
expect(connected.status === 200, 'the business connects its (fake) mail server', connected.body?.message)

// Four addresses with something wrong, in the first batch.
const rows = (await rowsOf(page, id)).filter(r => r.token && r.data.email).sort((a, b) => a.row_index - b.row_index)
const [typo, gone, busy, quota] = rows
for (const [row, email] of [[typo, 'ana@gmial.com'], [gone, 'gone1@example.com'], [busy, 'busy1@example.com'], [quota, 'quota1@example.com']])
  await call(`/api/recipients/${row.id}`, 'PATCH', { column: 'email', value: email })

async function send(label) {
  await page.reload()
  await page.locator('[data-channel="email"]').click()
  await page.waitForSelector('[data-testid="send-all"]')
  if (!(await page.getByTestId('email-consent').isChecked().catch(() => true)))
    await page.getByTestId('email-consent').check()
  await (label === 'retry' ? page.getByRole('button', { name: 'Try again' }) : page.getByTestId('send-all')).click()
  if (label !== 'retry')
    await page.getByRole('dialog').getByRole('button', { name: 'Send now' }).click()
  const toast = page.locator('[data-sonner-toast]').last()
  await toast.waitFor({ timeout: 120000 })
  const text = (await toast.innerText()).replace(/\s+/g, ' ')
  await page.waitForTimeout(500)
  return text
}
const status = () => call(`/api/campaigns/${id}/send`, 'GET').then(r => r.body)

// 1. The quota answer stops the run: nothing after it is tried, it stays pending.
const first = await send()
expect(first.includes('Nothing went out') && first.includes('Your mail server said: 550 5.4.5 Daily user sending limit exceeded'), 'a quota answer stops the run, in the server\'s words', first)
let s = await status()
expect(s.pending === rows.length - 3 && s.bounced === 1 && s.failed === 2 && s.sent === 0, 'the address after the stop still waits; one bounced, two didn\'t go out', s)
expect(!smtp.tried.has('ana@gmial.com') && smtp.delivered.join() === 'hello@shop.test' && [...smtp.tried.keys()].join() === 'hello@shop.test,gone1@example.com,busy1@example.com,quota1@example.com',
  'the typo was held back before sending, and nothing after the stop was tried (only the connection\'s test went out)', [...smtp.tried.keys()])

// 2. The rest go out once the server takes them again.
smtp.quota = false
const second = await send()
s = await status()
expect(second.startsWith(`${rows.length - 3} Highreels sent`) && s.sent === rows.length - 3 && s.pending === 0, 'the rest go out, the stopped address too', second)
expect(smtp.tried.get('gone1@example.com') === 1, 'the bounced address isn\'t tried again')
const extra = (await page.getByTestId('send-extra').innerText()).replace(/\s+/g, ' ')
expect(extra.includes('2 didn\'t go out') && extra.includes('1 bounced'), 'Share counts what didn\'t go out and what bounced', extra)

// 3. The Sheet says why a row wasn't emailed.
await tab(page, 'Sheet')
const why = async row => page.locator(`[data-row-id="${row.id}"] [data-mark="emailed"]`).getAttribute('aria-label')
const marks = [await why(typo), await why(gone), await why(busy)]
expect(marks[0] === 'Not emailed: Looks like a typo of gmail.com: fix the address in the Sheet' && marks[1].startsWith('Not emailed: Bounced: 550 5.1.1') && marks[2] === 'Not emailed: 451 4.2.0 Mailbox busy, try again later', 'the Sheet shows why each didn\'t go out', marks)

// 4. The bounce is remembered for the business, not shown to anyone else.
const businessId = (await call('/api/business', 'GET')).body.business.id
const bounced = sql(`select email, reason from email_bounces where business_id = '${businessId}'`)
expect(bounced.length === 1 && bounced[0].email === 'gone1@example.com' && bounced[0].reason.includes('User unknown'), 'the bounced address is kept for the business, with the server\'s reason', bounced)

// 5. A corrected address gets a fresh try; Try again sends it and the busy one.
await call(`/api/recipients/${typo.id}`, 'PATCH', { column: 'email', value: 'ana@example.com' })
smtp.busy = false
await tab(page, 'Share')
const retried = await send('retry')
s = await status()
expect(retried.startsWith('2 Highreels sent') && s.failed === 0 && s.bounced === 1 && smtp.delivered.includes('ana@example.com') && smtp.delivered.includes('busy1@example.com'), 'the corrected address and the busy one go out on Try again', retried)

// 6. Too many bounces in a batch pause the run.
const again = rows.slice(10, 16)
for (const [i, row] of again.entries())
  await call(`/api/recipients/${row.id}`, 'PATCH', { column: 'email', value: `gone${i + 2}@example.com` })
sql(`update recipients set emailed_at = null where id in (${again.map(r => `'${r.id}'`).join(',')})`)
const paused = await send()
expect(paused.includes('6 of the last 6 addresses bounced') && paused.includes('Check the email column in your Sheet'), 'a batch where too many bounce pauses the run and says what to check', paused)
s = await status()
expect(s.bounced === 7 && s.pending === 0, 'all six are remembered as bounced', s)

await browser.close()
server.close()
finish(errors)
