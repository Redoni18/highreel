import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { orderHeaders } from '../modules/cloudflare-headers/headers'
import { SCHEDULE } from '../server/schedule'

// What Nitro's Cloudflare preset wrote from routeRules (most specific first).
const NITRO = `/_nuxt/builds/meta/*
  cache-control: public, max-age=31536000, immutable
/api/r/*
  X-Robots-Tag: noindex
  Cache-Control: no-store
/_nuxt/builds/*
  cache-control: public, max-age=1, immutable
/app
  X-Robots-Tag: noindex
/app/*
  X-Robots-Tag: noindex
/_nuxt/*
  cache-control: public, max-age=31536000, immutable`

describe('orderHeaders (SPEC M2.14 P0)', () => {
  const out = orderHeaders(NITRO)

  test('general rules first, specific ones detach what they set again', () => {
    expect(out).toBe(`/app
  X-Robots-Tag: noindex
/app/*
  X-Robots-Tag: noindex
/_nuxt/*
  cache-control: public, max-age=31536000, immutable
/api/r/*
  X-Robots-Tag: noindex
  Cache-Control: no-store
/_nuxt/builds/*
  ! cache-control
  cache-control: public, max-age=1, immutable
/_nuxt/builds/meta/*
  ! cache-control
  cache-control: public, max-age=31536000, immutable`)
  })

  test('a rule that doesn\'t cover another leaves it alone', () => {
    // /app doesn't cover /app/*, and /_nuxt/* doesn't cover /api/r/*.
    expect(out).not.toMatch(/\/app\/\*\n {2}!/)
    expect(out).not.toMatch(/\/api\/r\/\*\n {2}!/)
  })

  test('running it twice changes nothing', () => {
    expect(orderHeaders(out)).toBe(out)
  })
})

describe('scheduled jobs (SPEC M2.14 P4)', () => {
  const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
  const crons = JSON.parse(wrangler.match(/"crons":\s*(\[[^\]]*\])/)![1]!) as string[]

  test('the Worker has a Cron Trigger for every schedule, and no other', () => {
    // A trigger runs the tasks of its own expression: one missing never runs.
    expect([...crons].sort()).toEqual(Object.keys(SCHEDULE).sort())
  })

  test('every scheduled task exists', () => {
    for (const name of Object.values(SCHEDULE).flat())
      expect(existsSync(new URL(`../server/tasks/${name.replace(':', '/')}.ts`, import.meta.url)), name).toBe(true)
  })
})
