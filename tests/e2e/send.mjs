// Sending email from the business's own account (SPEC M2.8, M2.9): a demo
// session can't send; a real account can't either until it connects its email
// (Highreel never sends from an address of its own). Connecting checks the login
// and sends a test first; bad servers are refused in plain words; the password
// is stored encrypted and never comes back. Then a test to the owner, someone
// unsubscribes (with and without JavaScript), and everyone else gets their own
// recap from the business's address, with an unsubscribe link and the
// one-click headers. Nothing goes twice, the account's daily limit holds, and
// deleting the recap keeps the log. The email preview sits in an iPhone with
// nothing clickable. Mailpit (local Supabase's SMTP on 54425) receives it all.
import { BASE, campaignId, demoSession, env, expect, finish, keepWork, launch, mailpitHeaders, mailpitMessage, mailpitSearch, publish, tab, tokenFor, watchErrors } from './lib.mjs'

const startedAt = Date.now() - 1000
/** This run's messages only: Mailpit keeps earlier runs'. */
const fresh = list => list.filter(m => new Date(m.Created).getTime() >= startedAt)
const browser = await launch()
const errors = []
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
watchErrors(page, errors, /status of (400|403|429)/)
const post = (path, body) => page.evaluate(async ([p, b]) => {
  const r = await fetch(p, { method: b === undefined ? 'POST' : 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b ?? {}) })
  return { status: r.status, body: await r.json().catch(() => null) }
}, [path, body])

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
await publish(page)
const id = campaignId(page)
await tab(page, 'Share')
await page.locator('[data-channel="email"]').click()
await page.waitForSelector('[data-testid="send-lead"]')
expect((await page.locator('[data-testid="share-send"]').innerText()).includes('Add your email in the banner'), 'a demo session is asked for an email before it can send')
expect((await post(`/api/campaigns/${id}/send`)).status === 403, 'the send route refuses a demo session')
expect((await post('/api/business/email', { provider: 'local', from_email: 'x@y.test' })).status === 403, 'and a demo session can\'t connect an email account')

// A real account, no email connected yet: nothing can go out.
const owner = `owner-${Date.now()}@example.com`
await keepWork(page, owner, `${BASE}/app/c/${id}/share`)
await page.locator('[data-channel="email"]').click()
await page.waitForSelector('[data-testid="email-connect"]', { timeout: 20000 })
const unconnected = await post(`/api/campaigns/${id}/send`)
expect(unconnected.status === 400 && unconnected.body.message.startsWith('Connect your email first'), 'without a connected account nothing is sent (no Highreel address)', unconnected)

// Bad servers are refused in plain words, before anything is saved.
const unknown = await post('/api/business/email', { provider: 'other', host: 'smtp.nowhere.invalid', port: 587, username: 'me', password: 'x', from_email: 'me@nowhere.invalid' })
const wrongPort = await post('/api/business/email', { provider: 'other', host: 'example.com', port: 5432, username: 'me', password: 'x', from_email: 'me@example.com' })
const inside = await post('/api/business/email', { provider: 'other', host: '10.0.0.1', port: 587, username: 'me', password: 'x', from_email: 'me@example.com' })
expect(unknown.status === 400 && unknown.body.message.includes('Can\'t reach smtp.nowhere.invalid'), 'an unknown server is refused', unknown.body?.message)
expect(wrongPort.status === 400 && wrongPort.body.message.includes('SMTP port'), 'only SMTP ports', wrongPort.body?.message)
expect(inside.status === 400 && inside.body.message.includes('Can\'t reach'), 'and never a private network address', inside.body?.message)

// Connect the local test inbox, with a login and password, through Share's dialog.
await page.getByTestId('connect-email').click()
await page.getByTestId('ec-provider').click()
await page.getByRole('option', { name: 'Local test inbox (Mailpit)' }).click()
await page.getByLabel('Send from').fill('hello@sunny.test')
await page.getByLabel('Name people see').fill('Sunny Hill')
await page.getByLabel('Login').fill('sunny')
await page.getByLabel('Password (none needed)').fill('secret-pass')
await page.getByRole('dialog').getByRole('button', { name: 'Connect' }).click()
await page.waitForSelector('text=Email connected', { timeout: 20000 })
const hello = fresh(await mailpitSearch('to:hello@sunny.test subject:"connected to Highreel"'))
expect(hello.length === 1, 'connecting sends a test to the address first', hello.length)
const mine = await page.evaluate(async () => (await fetch('/api/business/email')).json())
expect(mine.connection?.from_email === 'hello@sunny.test' && !JSON.stringify(mine).includes('secret-pass') && !('password' in mine.connection) && !('password_enc' in mine.connection), 'the password never comes back to the browser', mine.connection)
const cookies = await context.cookies()
const raw = cookies.filter(c => /^sb-.+-auth-token(?:\.\d+)?$/.test(c.name)).sort((a, b) => a.name.localeCompare(b.name)).map(c => c.value).join('')
const session = JSON.parse(Buffer.from(decodeURIComponent(raw).replace(/^base64-/, ''), 'base64').toString('utf8'))
const rest = (path, init = {}) => fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, ...init.headers } })
const stored = (await (await rest('email_connections?select=password_enc')).json())[0]?.password_enc ?? ''
expect(stored.startsWith('v1:') && !stored.includes('secret-pass'), 'the database holds it encrypted', stored.slice(0, 12))
await page.waitForSelector('[data-testid="send-from"]')
const from = (await page.getByTestId('send-from').innerText()).replace(/\s+/g, ' ')
expect(from.startsWith('From Sunny Hill <hello@sunny.test>'), 'Share says which address it sends from', from)
const lead = (await page.getByTestId('send-lead').innerText()).replace(/\s+/g, ' ')
expect(lead === '195 people have an email address.', 'Share says who gets an email', lead)
expect(await page.getByTestId('send-all').isDisabled(), 'Send waits for the customers checkbox')

// The email as written, live in the iPhone, nothing in it clickable.
await page.getByLabel('Subject').fill('{first_name}, here is your {year}')
await page.getByLabel('Message', { exact: true }).fill('Hi {first_name},\n\nYour year with {business} is ready.')
await page.waitForTimeout(300)
const subject = await page.getByTestId('mail-subject').innerText()
expect(subject === 'Emma, here is your 2026', 'the preview fills in the subject for the previewed person', subject)
const iframe = page.locator('aside[aria-label="Message preview"] .iphone iframe[title="Email preview"]')
const doc = await iframe.evaluate(f => f.srcdoc)
expect(doc.includes('Your year with My business is ready.') && doc.includes('a{pointer-events:none'), 'the preview sits in the iPhone frame with the message, links switched off')
const box = await iframe.boundingBox()
await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.42)
await page.waitForTimeout(400)
const frameUrl = page.frames().find(f => f.parentFrame() && f.url().startsWith('about:'))?.url()
expect(frameUrl === 'about:srcdoc', 'clicking the email\'s button doesn\'t open anything', frameUrl)

// A test to the owner.
await page.getByTestId('send-test').click()
await page.waitForSelector(`text=Test sent to ${owner}`, { timeout: 15000 })
const tests = fresh(await mailpitSearch(`to:${owner} subject:"[Test]"`))
expect(tests.length === 1 && tests[0].Subject === '[Test] Emma, here is your 2026' && tests[0].From.Address === 'hello@sunny.test', 'the test lands in the owner\'s inbox, from the business\'s address', tests.map(t => [t.Subject, t.From.Address]))

// Two people unsubscribe before the send: the page's button, and without JavaScript.
const leaving = await tokenFor(page, 'r => r.token && r.row_index === 1')
const leaver = await page.evaluate(async ([c, t]) => (await (await fetch(`/api/campaigns/${c}/recipients`)).json()).find(r => r.token === t).data.email, [id, leaving])
const u = await context.newPage()
await u.goto(`${BASE}/unsubscribe/${leaving}`)
await u.getByRole('button', { name: 'Unsubscribe' }).click()
await u.waitForSelector('text=You\'re unsubscribed.')
await u.reload()
expect(await u.locator('text=You\'re unsubscribed.').count() === 1, 'the unsubscribe page remembers it')
const oneClick = await fetch(`${BASE}/api/r/${leaving}/unsubscribe`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' })
expect(oneClick.status === 200, 'mail apps\' one-click unsubscribe works too', oneClick.status)
await u.close()
const noJs = await (await browser.newContext({ javaScriptEnabled: false })).newPage()
const other = await tokenFor(page, 'r => r.token && r.row_index === 2')
await noJs.goto(`${BASE}/unsubscribe/${other}`)
await noJs.getByRole('button', { name: 'Unsubscribe' }).click()
await noJs.waitForSelector('text=You\'re unsubscribed.')
expect(new URL(noJs.url()).pathname === `/unsubscribe/${other}`, 'the button works without JavaScript too')
await noJs.close()

// Send everyone.
await page.reload()
await page.locator('[data-channel="email"]').click()
await page.waitForSelector('[data-testid="send-all"]')
expect((await page.getByTestId('send-lead').innerText()).startsWith('193 people'), 'the two who unsubscribed are left out')
await page.getByTestId('email-consent').check()
await page.getByTestId('send-all').click()
await page.getByRole('dialog').getByRole('button', { name: 'Send now' }).click()
await page.waitForSelector('text=193 highlight reels sent', { timeout: 120000 })
const after = (await page.getByTestId('send-lead').innerText()).replace(/\s+/g, ' ')
expect(/^193 sent on \d+ \w+\.$/.test(after), 'Share says how many were sent', after)
expect((await page.getByTestId('send-extra').innerText()).includes('2 unsubscribed'), 'and that two unsubscribed')
expect(await page.getByTestId('send-all').isDisabled(), 'nobody is left to send to')

const sent = fresh(await mailpitSearch('subject:"here is your 2026" -subject:"[Test]"'))
const toLeaver = sent.filter(m => m.To.some(t => t.Address === leaver))
expect(sent.length === 193 && toLeaver.length === 0, '193 emails in Mailpit, none to people who unsubscribed', { sent: sent.length, toLeaver: toLeaver.length })
const emma = sent.find(m => m.Subject === 'Emma, here is your 2026')
const full = await mailpitMessage(emma.ID)
const headers = await mailpitHeaders(emma.ID)
const emmaToken = await tokenFor(page, `r => r.token && r.data.email === ${JSON.stringify(emma.To[0].Address)}`)
expect(full.From.Name === 'Sunny Hill' && full.From.Address === 'hello@sunny.test', 'from the business\'s own address and name', full.From)
expect(full.HTML.includes(`/r/${emmaToken}`) && full.Text.includes(`/r/${emmaToken}`), 'the email links to that person\'s own recap')
expect(full.HTML.includes(`/unsubscribe/${emmaToken}`) && full.Text.includes('Your year with My business is ready.') && !full.Text.includes('Highreel'), 'with an unsubscribe link, the message as written, and no Recap branding')
expect(headers['List-Unsubscribe']?.[0] === `<${BASE}/api/r/${emmaToken}/unsubscribe>` && headers['List-Unsubscribe-Post']?.[0] === 'List-Unsubscribe=One-Click', 'one-click unsubscribe headers', { lu: headers['List-Unsubscribe'], lup: headers['List-Unsubscribe-Post'] })
const pub = await page.evaluate(async t => (await fetch(`/api/r/${t}`)).json(), emmaToken)
expect(!('email' in (pub.settings ?? {})) && pub.settings?.email_consent_at === null && !JSON.stringify(pub).includes('here is your') && !JSON.stringify(pub).includes('7700'), 'the public recap payload carries no email settings, address or phone')

// Sending again sends nothing twice.
const again = await post(`/api/campaigns/${id}/send`)
expect(again.body.sent === 0 && again.body.remaining === 0, 'a second send sends nothing', again.body)

// The account's daily limit (2,000 for the local inbox): read today's count, then log enough to
// leave 6 (owners may add to the log, never remove).
const businessId = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).business.id, id)
const today = Number((await rest(`email_sends?business_id=eq.${businessId}&ok=eq.true&select=id`, { headers: { Prefer: 'count=exact', Range: '0-0' } })).headers.get('content-range')?.split('/')[1])
const fill = await rest('email_sends', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Array.from({ length: 2000 - 6 - today }, () => ({ business_id: businessId, kind: 'recap', ok: true }))) })
expect(fill.status === 201 && today === 194, 'the owner can add to its own send log', { status: fill.status, today })
const wipe = await rest(`email_sends?business_id=eq.${businessId}`, { method: 'DELETE', headers: { Prefer: 'return=representation' } })
const wiped = wipe.ok ? (await wipe.json()).length : 0
expect(!wiped, 'but can\'t delete from it', { status: wipe.status, wiped })
const cleared = await rest(`recipients?campaign_id=eq.${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ emailed_at: null }) })
expect(cleared.ok, 'clearing "emailed" on the rows is allowed', cleared.status)
const limited = await post(`/api/campaigns/${id}/send`)
expect(limited.status === 200 && limited.body.sent === 6 && limited.body.waiting === 187 && limited.body.remaining === 0, 'at the daily limit the rest waits for tomorrow, even with "emailed" cleared', limited.body)
const blocked = await post(`/api/campaigns/${id}/send`)
expect(blocked.status === 429 && blocked.body.message.includes('hello@sunny.test'), 'and a send at the limit is refused, naming the account', blocked.body?.message)

// The Sheet marks who was emailed.
await tab(page, 'Sheet')
await page.waitForSelector('[data-row-id]')
expect(await page.locator('[aria-label="Emailed"]').count() > 0, 'the Sheet\'s did column marks emailed rows')

// Disconnecting removes the account; deleting the recap keeps the log (no addresses in it) for the limit.
const disconnected = await page.evaluate(async () => (await fetch('/api/business/email', { method: 'DELETE' })).status)
const left = await (await rest('email_connections?select=business_id')).json()
expect(disconnected === 204 && left.length === 0, 'Disconnect deletes the account and its password', { disconnected, left })
const gone = await page.evaluate(async c => (await fetch(`/api/campaigns/${c}`, { method: 'DELETE' })).status, id)
const logRes = await rest(`email_sends?business_id=eq.${businessId}&select=campaign_id,recipient_id&limit=1000`, { headers: { Prefer: 'count=exact' } })
const kept = await logRes.json()
const total = Number(logRes.headers.get('content-range')?.split('/')[1])
expect(gone < 300 && total === 2000 && kept.every(k => k.campaign_id === null && k.recipient_id === null), 'deleting the recap keeps the log for the daily limit', { gone, total })

await browser.close()
finish(errors)
