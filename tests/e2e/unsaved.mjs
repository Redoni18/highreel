// Unsaved Design edits (SPEC M2.11): they survive switching tabs; leaving the
// recap (the home, Your brand, another recap) asks first: Keep editing stays,
// Discard changes leaves without them, Save and leave saves them. Closing the
// page with edits gets the browser's own prompt; without edits nothing asks.
import { demoSession, expect, finish, launch, tab, watchErrors, campaignId } from './lib.mjs'

const browser = await launch()
const errors = []
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
watchErrors(page, errors)
const ask = page.getByRole('dialog', { name: 'Save your design changes?' })
let id = null
const theme = async () => (await page.evaluate(async c => (await (await fetch(`/api/campaigns/${c}`)).json()).campaign.settings.theme, id))
const paper = () => page.locator('[data-testid="theme"] [data-value="paper"]').click()

await demoSession(page)
await page.getByRole('button', { name: 'Use sample data' }).click()
await page.waitForSelector('[data-row-id]')
const recap = page.url()
id = campaignId(page)

// Nothing to ask about yet.
await page.getByRole('link', { name: 'All Highreels' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app')
expect(!(await ask.isVisible()), 'no edits: leaving doesn\'t ask')
await page.goto(recap)
await page.waitForSelector('[data-row-id]')

// An edit survives switching tabs.
await tab(page, 'Design')
await paper()
await tab(page, 'Share')
await tab(page, 'Design')
expect(await page.locator('[data-testid="theme"] [data-value="paper"]').getAttribute('data-state') === 'on', 'the edit survives switching tabs')

// Leaving asks; Keep editing stays.
await page.getByRole('link', { name: 'All Highreels' }).click()
await ask.waitFor()
await ask.getByRole('button', { name: 'Keep editing' }).click()
await page.waitForTimeout(300)
expect(new URL(page.url()).pathname.endsWith('/design') && !(await ask.isVisible()), 'Keep editing stays in Design with the edit', page.url())

// Discard changes leaves without them.
await page.locator('a[href="/app/brand"]').first().click()
await ask.waitFor()
await ask.getByRole('button', { name: 'Discard changes' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app/brand')
expect(await theme() === 'stories', 'Discard changes leaves for Your brand and saves nothing')

// Save and leave saves them.
await page.goto(recap.replace(/\/?$/, '/design'))
await page.waitForSelector('[data-testid="theme"]')
await paper()
await page.getByRole('link', { name: 'All Highreels' }).click()
await ask.waitFor()
await ask.getByRole('button', { name: 'Save and leave' }).click()
await page.waitForURL(u => new URL(u).pathname === '/app')
await page.goto(recap)
await page.waitForSelector('[data-row-id]')
expect(await theme() === 'paper', 'Save and leave saves the edit, then leaves')

// Closing the page with edits gets the browser's prompt (and stays when it's dismissed).
await tab(page, 'Design')
await page.locator('[data-testid="theme"] [data-value="stories"]').click()
const prompt = new Promise(resolve => page.once('dialog', async (d) => { resolve(d.type()); await d.dismiss() }))
await page.close({ runBeforeUnload: true })
expect(await Promise.race([prompt, new Promise(r => setTimeout(() => r('none'), 3000))]) === 'beforeunload', 'closing the page with edits asks first')

await browser.close()
finish(errors)
