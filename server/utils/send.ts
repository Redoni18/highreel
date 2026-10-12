// Who gets a recap email and how many a business may still send today
// (SPEC M2.8). Shared by the send route and its status route; everything
// runs as the user, so RLS keeps it to their own business.

import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Recipient } from '#shared/types/recap'
import { hasErrors } from '#shared/utils/validate'

/** A row's address, lowercased, if it has a usable one. */
export function addressOf(row: Recipient): string | null {
  const v = row.data.email
  return isEmail(v) ? v.trim().toLowerCase() : null
}

export async function optedOut(db: SupabaseClient, businessId: string): Promise<Set<string>> {
  const { data, error } = await db.from('email_optouts').select('email').eq('business_id', businessId)
  if (error)
    dbError(error, 'Loading unsubscribes')
  return new Set((data ?? []).map(r => r.email as string))
}

/** Addresses that bounced for this business (SPEC M2.11): never sent to again. */
export async function bouncedAddresses(db: SupabaseClient, businessId: string): Promise<Set<string>> {
  const { data, error } = await db.from('email_bounces').select('email').eq('business_id', businessId)
  if (error)
    dbError(error, 'Loading bounces')
  return new Set((data ?? []).map(r => r.email as string))
}

/** Recap emails this business sent in the last 24 hours (failed tries don't count). */
export async function sentToday(db: SupabaseClient, businessId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count, error } = await db
    .from('email_sends')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('ok', true)
    .gte('created_at', since)
  if (error)
    dbError(error, 'Counting emails')
  return count ?? 0
}

export interface Audience {
  /** published, valid, with an address, not unsubscribed or bounced, not sent yet (and, unless retrying, not failed) */
  pending: Recipient[]
  sent: number
  failed: number
  noEmail: number
  unsubscribed: number
  bounced: number
}

export function audience(rows: Recipient[], optouts: Set<string>, bounces: Set<string> = new Set(), retry = false): Audience {
  const out: Audience = { pending: [], sent: 0, failed: 0, noEmail: 0, unsubscribed: 0, bounced: 0 }
  for (const row of rows) {
    if (!row.token || hasErrors(row.errors))
      continue
    const address = addressOf(row)
    if (row.emailed_at)
      out.sent++
    else if (!address)
      out.noEmail++
    else if (optouts.has(address))
      out.unsubscribed++
    else if (bounces.has(address))
      out.bounced++
    else if (row.email_error && !retry)
      out.failed++
    else
      out.pending.push(row)
  }
  return out
}

/** Where recap links point: the configured site, else this request's origin. */
export function siteOrigin(event: H3Event): string {
  return useRuntimeConfig(event).public.siteUrl || getRequestURL(event).origin
}
