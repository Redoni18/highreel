// Shared by the send route and its status route (SPEC M2.8). Who's left to
// email is counted in SQL since M2.14 P1 (audienceCounts and pendingRows in
// server/utils/db.ts).

import type { H3Event } from 'h3'
import type { Recipient } from '#shared/types/recap'

/** A row's address, lowercased, if it has a usable one. */
export function addressOf(row: Recipient): string | null {
  const v = row.data.email
  return isEmail(v) ? v.trim().toLowerCase() : null
}

/** Where recap links point: the configured site, else this request's origin. */
export function siteOrigin(event: H3Event): string {
  return useRuntimeConfig(event).public.siteUrl || getRequestURL(event).origin
}
