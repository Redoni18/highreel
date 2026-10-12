// WhatsApp, one tap per person (SPEC M2.9): with phone numbers in the sheet and
// no email connected, Share opens on WhatsApp; "Send next" opens that person's
// chat (wa.me) with their message and own link typed in, and marks them sent
// (Undo takes it back). A number written without its country code waits for
// one. The phone beside it shows the chat with the link preview; the Sheet's
// did column marks who got it; the number never reaches the recap.
import { BASE, campaignId, demoSession, expect, finish, launch, publish, tab, watchErrors } from './lib.mjs'

const browser = await launch()
const errors = []
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
// WhatsApp's own site stays out of the test: answer wa.me locally.
const opened = []
await context.route('https://wa.me/**', (route) => {
  opened.push(route.request().url())
  return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>WhatsApp</p>' })
})
const page = await context.newPage()
watchErrors(page, errors)
const rows = () => page.evaluate(async c => (await fetch(`/api/campaigns/${c}/recipients`)).json(), campaignId(page))

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
expect(await page.locator('[data-row-id] [data-col="phone"]').count() > 0, 'the sheet has a phone column')
await publish(page)
const live = (await rows()).filter(r => r.token && !Object.keys(r.errors).length)
const withPhone = live.filter(r => r.data.phone)

await tab(page, 'Share')
await page.waitForSelector('[data-testid="wa-lead"]')
expect(await page.locator('[data-channel="whatsapp"]').getAttribute('aria-selected') === 'true', 'with numbers and no email connected, Share opens on WhatsApp')
const lead = (await page.getByTestId('wa-lead').innerText()).replace(/\s+/g, ' ')
expect(lead === `${withPhone.length} people have a phone number.`, 'it says who has a number', lead)
const bubble = await page.getByTestId('chat-bubble').innerText()
expect(bubble.includes('Hi Emma!') && bubble.includes('/r/'), 'the phone shows the WhatsApp message with the link', bubble.slice(0, 80))
expect(await page.locator('aside[aria-label="Message preview"] .card-img').count() === 1, 'and the link preview card')

// Send next: the first person's chat opens with their own text and link.
const first = withPhone[0]
const popup = page.waitForEvent('popup')
await page.getByTestId('wa-next').click()
const tabOpened = await popup
await tabOpened.waitForLoadState()
const url = new URL(opened.at(-1))
const text = url.searchParams.get('text')
expect(url.pathname === `/${first.data.phone.replace(/\D/g, '')}` && text.includes(`Hi ${first.data.first_name}!`) && text.includes(`/r/${first.token}`), 'Send next opens their chat with their message and own link', { path: url.pathname, text })
await tabOpened.close()
await page.waitForTimeout(300)
const afterLead = (await page.getByTestId('wa-lead').innerText()).replace(/\s+/g, ' ')
expect(afterLead.startsWith(`1 of ${withPhone.length} sent. Next up:`), 'and marks them sent', afterLead)
expect((await rows()).find(r => r.id === first.id)?.whatsapp_at, 'saved on the row')
await page.getByRole('button', { name: `Undo sent for ${first.data.first_name}` }).first().click()
await page.waitForTimeout(400)
expect(!(await rows()).find(r => r.id === first.id)?.whatsapp_at, 'Undo takes it back')

// A message without {recap_url} gets the link at the end.
await page.getByLabel('Message', { exact: true }).fill('Hey {first_name}, your year with {business}')
await page.getByLabel('Message', { exact: true }).blur()
const popup2 = page.waitForEvent('popup')
await page.locator(`[data-wa="${first.id}"]`).getByRole('button', { name: /Send to/ }).click()
await (await popup2).close()
const text2 = new URL(opened.at(-1)).searchParams.get('text')
expect(text2 === `Hey ${first.data.first_name}, your year with My business\n\n${BASE}/r/${first.token}`, 'the link goes at the end when the text doesn\'t place it', text2)

// A number written without its country code waits for one.
const local = withPhone[1]
await page.evaluate(async id => fetch(`/api/recipients/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ column: 'phone', value: '044 123 456' }) }), local.id)
await page.reload()
await page.waitForSelector('[data-testid="wa-bad"]')
expect((await page.getByTestId('wa-bad').innerText()).startsWith('1 number needs'), 'a national number is flagged')
expect(await page.locator(`[data-wa="${local.id}"]`).getByRole('button', { name: /Send to/ }).isDisabled(), 'and can\'t be sent yet')
await page.getByLabel('Country code for numbers without one').fill('+383')
await page.getByLabel('Country code for numbers without one').blur()
await page.waitForTimeout(300)
expect((await page.locator(`[data-wa="${local.id}"]`).innerText()).includes('+38344123456') && await page.getByTestId('wa-bad').count() === 0, 'with a country code it reads +383 44 123 456')
const saved = await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).campaign.settings.whatsapp, campaignId(page))
expect(saved.country === '+383' && saved.body.startsWith('Hey {first_name}'), 'the message and country code are saved with the recap', saved)

// The Sheet marks it; the recap never carries the number.
await tab(page, 'Sheet')
await page.waitForSelector('[data-row-id]')
expect(await page.locator('[aria-label="Sent on WhatsApp"]').count() === 1, 'the Sheet\'s did column marks who got it on WhatsApp')
const pub = await (await fetch(`${BASE}/api/r/${first.token}`)).json()
expect(!JSON.stringify(pub).includes('7700'), 'the recap never carries the phone number')

await browser.close()
finish(errors)
