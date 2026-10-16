// The Worker's bindings (wrangler.jsonc, SPEC M2.14): D1, R2 and Email
// Sending. On Cloudflare they come with each request; `corepack pnpm dev`
// emulates them (Nitro's getPlatformProxy, state in .wrangler/state/v3).

import type { H3Event } from 'h3'
import type { D1Database, R2Bucket, SendEmail } from '@cloudflare/workers-types'

export interface Bindings {
  DB: D1Database
  MEDIA: R2Bucket
  /** Email Sending, for sign-in emails when Resend has no key (server/utils/signin.ts) */
  EMAIL?: SendEmail
}

type WithEnv = { cloudflare?: { env?: Partial<Bindings> } }

export function bindings(event: H3Event): Bindings {
  const env = (event.context as WithEnv).cloudflare?.env
  if (!env?.DB || !env.MEDIA)
    throw createError({ statusCode: 500, message: 'No database or file storage: run the Worker (wrangler) or `corepack pnpm dev`' })
  return env as Bindings
}

/**
 * The bindings for a scheduled job (server/tasks, SPEC M2.14 P4), which has
 * no request. A Cron Trigger passes them in the task's context; the dev
 * server's task endpoint (/_nitro/tasks/:name) and its scheduler don't, so
 * there they come from the emulation's global.
 */
export function taskBindings(context: object): Bindings {
  const env = (context as WithEnv).cloudflare?.env ?? (globalThis as { __env__?: Partial<Bindings> }).__env__
  if (!env?.DB || !env.MEDIA)
    throw new Error('No database or file storage for this job: run it on the Worker or `corepack pnpm dev`')
  return env as Bindings
}
