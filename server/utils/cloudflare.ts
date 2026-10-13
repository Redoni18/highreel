// The Worker's bindings (wrangler.jsonc, SPEC M2.14): D1, R2 and Email
// Sending. On Cloudflare they come with each request; `corepack pnpm dev`
// emulates them (Nitro's getPlatformProxy, state in .wrangler/state/v3).

import type { H3Event } from 'h3'
import type { D1Database, R2Bucket, SendEmail } from '@cloudflare/workers-types'

export interface Bindings {
  DB: D1Database
  MEDIA: R2Bucket
  /** Email Sending, for sign-in emails only (server/utils/signin.ts) */
  EMAIL?: SendEmail
}

export function bindings(event: H3Event): Bindings {
  const env = (event.context as { cloudflare?: { env?: Partial<Bindings> } }).cloudflare?.env
  if (!env?.DB || !env.MEDIA)
    throw createError({ statusCode: 500, message: 'No database or file storage: run the Worker (wrangler) or `corepack pnpm dev`' })
  return env as Bindings
}
