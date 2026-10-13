// Shared helpers for the browser checks in tests/e2e. They drive the
// installed Google Chrome headless through playwright-core (no browser
// download), against the dev server on :3040. Emails (sign-in links, recap
// emails) land in Mailpit, the local test inbox.
//
//   corepack pnpm mail                       # in one terminal (brew install mailpit)
//   corepack pnpm dev                        # in another
//   corepack pnpm e2e                        # all checks
//   node tests/e2e/recap.mjs                 # one check
//
// Screenshots and downloads go to tests/e2e/.out (gitignored).

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

export const BASE = process.env.E2E_BASE ?? 'http://localhost:3040'
export const OUT = fileURLToPath(new URL('./.out/', import.meta.url))
export const FIX = fileURLToPath(new URL('./.fixtures/', import.meta.url))
mkdirSync(OUT, { recursive: true })

export const env = Object.fromEntries(
  readFileSync(new URL('../../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => /^\w+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)

export const log = (...a) => console.log('    ', ...a)

/**
 * For page.waitForURL: the page is in the workspace. Not the glob '**\/app**':
 * /login?next=/app/… and /confirm?…&next=/app/… match that too.
 */
export const inApp = url => new URL(url).pathname.startsWith('/app')

/**
 * Run SQL on the local D1 database (.wrangler/state/v3, shared with the dev
 * server and `wrangler dev`) and get its rows: for what a test sets up or
 * checks behind the app's back. Values are the test's own, never user input.
 */
export function sql(query) {
  const out = execFileSync('corepack', ['pnpm', 'exec', 'wrangler', 'd1', 'execute', 'highreel', '--local', '--json', '--command', query], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(out.slice(out.indexOf('[')))[0].results
}

let failures = 0
export function expect(ok, label, detail) {
  const d = detail === undefined ? '' : ` (${typeof detail === 'string' ? detail : JSON.stringify(detail)})`
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${d}`)
  if (!ok)
    failures++
}

export function launch() {
  return chromium.launch({ channel: 'chrome' })
}

/** Collect page errors and console errors (minus expected noise). */
export function watchErrors(page, errors, ignore = /^$/) {
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !ignore.test(m.text()))
      errors.push(m.text())
  })
}

/** Start a demo (anonymous) session and land in its first draft's workspace. */
export async function demoSession(page) {
  await page.goto(`${BASE}/login?demo=1`)
  await page.waitForURL('**/app/c/*', { timeout: 20000 })
  await page.waitForSelector('text=Use sample data')
}

export const MAILPIT = 'http://127.0.0.1:54424'

/** Messages in Mailpit matching a search ("to:ana@example.com", "subject:Test"), newest first. */
export async function mailpitSearch(query) {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}&limit=500`).then(r => r.json())
  return res.messages ?? []
}
export const mailpitMessage = id => fetch(`${MAILPIT}/api/v1/message/${id}`).then(r => r.json())
export const mailpitHeaders = id => fetch(`${MAILPIT}/api/v1/message/${id}/headers`).then(r => r.json())

/** The newest sign-in link (/confirm?token=…) sent to an address; `after`: a link other than this one. */
export async function latestLink(to, after) {
  for (let i = 0; i < 30; i++) {
    const msg = (await mailpitSearch(`to:${to}`))[0]
    if (msg) {
      const full = await mailpitMessage(msg.ID)
      const link = (full.Text || full.HTML).match(/https?:\/\/[^\s"'<>]+\/confirm\?token=[^\s"'<>]+/)?.[0]?.replaceAll('&amp;', '&')
      if (link && link !== after)
        return link
    }
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`no email for ${to}`)
}

/**
 * Turn the current demo session into a real account (the banner's "Keep my
 * work" and its email link, opened in the same browser) and come back to the
 * campaign at `url`.
 */
export async function keepWork(page, email, url) {
  await page.getByLabel('Email to keep this work').fill(email)
  await page.getByRole('button', { name: 'Keep my work' }).click()
  await page.waitForSelector(`text=Check ${email}`)
  await page.goto(await latestLink(email))
  await page.waitForURL(inApp, { timeout: 15000 })
  await page.goto(url)
}

/** Publish the current campaign through the UI. */
export async function publish(page) {
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click()
  await page.waitForSelector('text=Highreels published')
}

/** The sheet's row counts, from its filter buttons: { all, errors, ready, published }. */
export function sheetCounts(page) {
  return page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-filter]')].map(el => [el.dataset.filter, Number(el.dataset.count)])))
}

/** Go to one of a recap's tabs (Sheet, Design, Share; Content for a business recap). */
export async function tab(page, name) {
  await page.locator('nav[aria-label="Steps"]').getByRole('link', { name: new RegExp(name) }).click()
  const suffix = { Sheet: '', Content: '', Design: '/design', Share: '/share' }[name]
  await page.waitForURL(u => new URL(u).pathname.match(/^\/app\/c\/[\w-]+(\/\w+)?$/)?.[1] === (suffix || undefined))
}

/** Open one item of Design's rail (a slide key, or cover, add, photos, note, share) in the inspector. */
export async function designItem(page, key) {
  await page.locator(`[data-slide="${key}"] .row`).click()
  await page.waitForSelector(`[data-inspector="${key}"]`)
  return page.locator(`[data-inspector="${key}"]`)
}

export const campaignId = page => new URL(page.url()).pathname.match(/^\/app\/c\/([\w-]+)/)?.[1] ?? null

/** Every row of a campaign, through the user's own session, a page at a time (SPEC M2.14 P1). */
export function rowsOf(page, c = campaignId(page)) {
  return page.evaluate(async (c) => {
    const out = []
    for (let after = -1; ;) {
      const p = await (await fetch(`/api/campaigns/${c}/recipients?after=${after}`)).json()
      out.push(...p.rows)
      if (p.next === null)
        return out
      after = p.next
    }
  }, c)
}

/** A published row's token, read through the user's own session. */
export async function tokenFor(page, predicate = 'r => r.token') {
  // eslint-disable-next-line no-eval
  return (await rowsOf(page)).find(eval(predicate))?.token
}

export const rowLoc = (page, n) => page.locator('[data-row-id]').filter({ has: page.locator('[data-col="__row"] > div', { hasText: new RegExp(`^\\s*${n}\\s*$`) }) })

export function needFixtures() {
  if (!existsSync(`${FIX}/farm-1.jpg`))
    throw new Error('Run `node tests/e2e/fixtures.mjs` first (corepack pnpm e2e does it for you)')
}

export function finish(errors = []) {
  expect(errors.length === 0, 'no page or console errors', errors.length ? errors.slice(0, 3) : undefined)
  if (failures)
    console.log(`\n${failures} check(s) failed`)
  process.exit(failures ? 1 : 0)
}

/**
 * "Save image" on a recap's last slide, then the picker's Save (M2.13): the
 * summary card is ticked to start with. Resolves to the download; closes the
 * picker again.
 */
export async function saveSummaryImage(page) {
  // Touch devices save through the share sheet, which headless Chrome never shows: download instead.
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true }))
  await page.getByRole('button', { name: 'Save image' }).click()
  const save = page.getByRole('dialog', { name: 'Save images' }).getByTestId('save-images')
  await page.waitForFunction(() => document.querySelector('[data-testid="save-images"]')?.textContent?.trim() === 'Save 1 image', null, { timeout: 20000 })
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), save.click()])
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"][aria-label="Save images"]', { state: 'detached' })
  return download
}

