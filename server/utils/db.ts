// Loading and saving businesses, campaigns and recipients through PostgREST.
// Every function takes the client to use: the user's session client for the
// workspace (RLS applies), the secret-key client only for recap tokens.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Business, Campaign, CampaignSummary, Recipient, Workspace } from '#shared/types/recap'
import { getTemplate } from '#shared/templates'
import { type Starter, withStarter } from '#shared/templates/starters'
import { normalizeSettings } from '#shared/utils/recap'

/** A new business's colour until it picks its own (a business-type template may replace it). */
export const DEFAULT_ACCENT = '#4F46E5'

export const RECIPIENT_COLUMNS = 'id, row_index, customer_id, raw, data, errors, token, view_count, first_viewed_at, saved_at, shared_at, cta_clicked_at, emailed_at, email_error, whatsapp_at'
const PAGE = 1000

export function toCampaign(row: Record<string, any>): Campaign {
  return {
    id: row.id,
    business_id: row.business_id,
    name: row.name,
    template_key: row.template_key,
    kind: row.kind === 'business' ? 'business' : 'customers',
    year: row.year,
    settings: normalizeSettings(row.settings),
    status: row.status,
    published_at: row.published_at,
  }
}

export function toBusiness(row: Record<string, any>): Business {
  return {
    id: row.id,
    name: row.name,
    accent_color: row.accent_color,
    logo_shape: row.logo_shape === 'square' ? 'square' : 'circle',
    logo_url: null,
    logo_path: row.logo_path ?? null,
    website_url: row.website_url,
  }
}

/** The user's business, created on their first visit (SPEC M2a.4). */
export async function ensureBusiness(db: SupabaseClient, userId: string): Promise<Business> {
  const found = await db.from('businesses').select('*').maybeSingle()
  if (found.error)
    dbError(found.error, 'Loading business')
  if (found.data)
    return toBusiness(found.data)
  const created = await db
    .from('businesses')
    .upsert({ owner_id: userId, name: 'My business', accent_color: DEFAULT_ACCENT }, { onConflict: 'owner_id', ignoreDuplicates: true })
    .select('*')
    .maybeSingle()
  if (created.error) {
    // The user behind the session no longer exists (owner_id foreign key).
    if (created.error.code === '23503')
      throw sessionEnded()
    dbError(created.error, 'Creating business')
  }
  if (created.data)
    return toBusiness(created.data)
  // A parallel first request created it first.
  const again = await db.from('businesses').select('*').single()
  if (again.error)
    dbError(again.error, 'Loading business')
  return toBusiness(again.data)
}

export async function createCampaign(db: SupabaseClient, businessId: string, input: { name: string, year: number, template_key: string, starter?: Starter }): Promise<Campaign> {
  const template = getTemplate(input.template_key)
  const { data, error } = await db
    .from('campaigns')
    .insert({
      business_id: businessId,
      name: input.name,
      year: input.year,
      template_key: template.key,
      kind: template.kind ?? 'customers',
      settings: input.starter ? withStarter(normalizeSettings(template.defaultSettings), input.starter) : template.defaultSettings,
    })
    .select('*')
    .single()
  if (error)
    dbError(error, 'Creating campaign')
  return toCampaign(data)
}

export async function listCampaigns(db: SupabaseClient): Promise<CampaignSummary[]> {
  const { data, error } = await db
    .from('campaigns')
    .select('id, name, year, template_key, kind, status, published_at, created_at, recipients(count)')
    .order('created_at', { ascending: false })
  if (error)
    dbError(error, 'Loading campaigns')
  return data.map(c => ({
    id: c.id,
    name: c.name,
    year: c.year,
    template_key: c.template_key,
    kind: c.kind,
    status: c.status,
    published_at: c.published_at,
    created_at: c.created_at,
    row_count: (c.recipients as unknown as Array<{ count: number }>)[0]?.count ?? 0,
  }))
}

export async function loadWorkspace(db: SupabaseClient, campaignId: string): Promise<Workspace> {
  const { data, error } = await db
    .from('campaigns')
    .select('*, businesses(*)')
    .eq('id', campaignId)
    .maybeSingle()
  if (error)
    dbError(error, 'Loading campaign')
  if (!data)
    throw createError({ statusCode: 404, message: 'Campaign not found' })
  return { business: toBusiness(data.businesses), campaign: toCampaign(data) }
}

/** The campaign with its business, logo and photos signed for the workspace (1 h). */
export async function loadSignedWorkspace(db: SupabaseClient, campaignId: string): Promise<Workspace> {
  const ws = await loadWorkspace(db, campaignId)
  const signed = await signMedia(db, ws.business, ws.campaign.settings, 3600)
  return { business: signed.business, campaign: { ...ws.campaign, settings: signed.settings } }
}

/** All recipients of a campaign in sheet order, paging past PostgREST's row cap. */
export async function loadRecipients(db: SupabaseClient, campaignId: string, columns = RECIPIENT_COLUMNS): Promise<Recipient[]> {
  const out: Recipient[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from('recipients')
      .select(columns)
      .eq('campaign_id', campaignId)
      .order('row_index')
      .range(from, from + PAGE - 1)
    if (error)
      dbError(error, 'Loading recipients')
    out.push(...(data as unknown as Recipient[]))
    if (data.length < PAGE)
      return out
  }
}

/** Insert new rows in chunks (PostgREST bodies stay small and fast). */
export async function insertRecipients(db: SupabaseClient, rows: Record<string, unknown>[]): Promise<Recipient[]> {
  const out: Recipient[] = []
  for (let i = 0; i < rows.length; i += PAGE) {
    const { data, error } = await db.from('recipients').insert(rows.slice(i, i + PAGE)).select(RECIPIENT_COLUMNS)
    if (error)
      dbError(error, 'Saving recipients')
    out.push(...(data as unknown as Recipient[]))
  }
  return out.sort((a, b) => a.row_index - b.row_index)
}

/** Update customer_id/data/errors/token of existing rows, as the user (RLS applies). */
export async function bulkUpdateRecipients(
  db: SupabaseClient,
  rows: Array<{ id: string, customer_id: string, data: unknown, errors: unknown, token: string | null }>,
): Promise<Recipient[]> {
  const out: Recipient[] = []
  for (let i = 0; i < rows.length; i += PAGE) {
    const { data, error } = await db.rpc('bulk_update_recipients', { p_rows: rows.slice(i, i + PAGE) }).select(RECIPIENT_COLUMNS)
    if (error)
      dbError(error, error.code === '23505' ? 'Two published rows share an id' : 'Saving recipients')
    out.push(...(data as unknown as Recipient[]))
  }
  return out.sort((a, b) => a.row_index - b.row_index)
}

export function requireUuid(value: string | undefined, what = 'id'): string {
  if (!value || !/^[0-9a-f-]{36}$/i.test(value))
    throw createError({ statusCode: 400, message: `Invalid ${what}` })
  return value
}
