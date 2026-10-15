// All workspace SQL (SPEC M2.14 P1). D1 has no row-level security, so this is
// where every business is walled off from the others: each function takes the
// signed-in user's `Db` (from requireUser) and every statement filters by its
// business, on reads, updates and deletes alike; recipients are reached through
// `campaign_id in (select id from campaigns where business_id = ?)`. Routes
// never write SQL. tests/isolation.test.ts reads this file and fails on a
// statement that touches a business's tables without that filter;
// `corepack pnpm check:isolation` tries every route with another business's ids.
//
// What RLS's column grants did is "there's no function for it": nothing here
// writes the view/save/share/click counters, rewrites or clears the send log,
// writes opt-outs, or edits or clears bounces.

import type { H3Event } from 'h3'
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types'
import type { Business, Campaign, CampaignKind, CampaignSettings, CampaignStatus, CampaignSummary, HomeActivity, Recipient, Workspace } from '#shared/types/recap'
import type { ParsedRow, RawRow, RowErrors } from '#shared/templates/types'
import type { EmailConnection } from '#shared/utils/smtp'
import { getTemplate } from '#shared/templates'
import type { Look } from '#shared/templates/designs'
import { type Starter, withStarter } from '#shared/templates/starters'
import { normalizeSettings } from '#shared/utils/recap'

/** The signed-in user's business's view of the database. */
export interface Db {
  d1: D1Database
  businessId: string
}

/** Rows per page (grid, import parts, publish), SPEC M2.14 P1: about 15 MB of heap each at most. */
export const PAGE_ROWS = 5000

const RECIPIENT_COLUMNS = 'id, row_index, customer_id, raw, data, errors, token, view_count, first_viewed_at, saved_at, shared_at, cta_clicked_at, emailed_at, email_error, whatsapp_at'

/** A JSON parameter per statement stays under D1's 2 MB string cap. */
// Updating rows listed in a JSON parameter: the `+` in `+recipients.campaign_id`
// stops SQLite from driving the update off the campaign_id index, which made it
// scan the whole JSON list once per row of the campaign (80 s for 5,000 rows of
// a 50,000-row sheet). With it, the list is read once and each row found by id
// (0.04 s). The business filter is unchanged; only the plan differs.
const JSON_PARAM_BYTES = 900_000

const now = () => new Date().toISOString()

function parse<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string')
    return fallback
  try {
    return JSON.parse(value) as T
  }
  catch {
    return fallback
  }
}

/** Split rows into JSON arrays of at most JSON_PARAM_BYTES each. */
function jsonChunks(rows: unknown[]): string[] {
  const out: string[] = []
  let part: string[] = []
  let size = 2
  for (const row of rows) {
    const s = JSON.stringify(row)
    if (part.length && size + s.length + 1 > JSON_PARAM_BYTES) {
      out.push(`[${part.join(',')}]`)
      part = []
      size = 2
    }
    part.push(s)
    size += s.length + 1
  }
  if (part.length)
    out.push(`[${part.join(',')}]`)
  return out
}

function toCampaign(row: Record<string, any>): Campaign {
  return {
    id: row.id,
    business_id: row.business_id,
    name: row.name,
    template_key: row.template_key,
    kind: row.kind === 'business' ? 'business' : 'customers',
    year: row.year,
    settings: normalizeSettings(parse(row.settings, {})),
    status: row.status,
    published_at: row.published_at ?? null,
    importing: row.import_next != null,
    paid: [],
  }
}

function toBusiness(row: Record<string, any>): Business {
  return {
    id: row.id,
    name: row.name,
    logo_shape: row.logo_shape === 'square' ? 'square' : 'circle',
    logo_url: null,
    logo_path: row.logo_path ?? null,
    website_url: row.website_url ?? null,
  }
}

export function toRecipient(row: Record<string, any>): Recipient {
  return {
    id: row.id,
    row_index: row.row_index,
    customer_id: row.customer_id,
    raw: parse<RawRow>(row.raw, {}),
    data: parse<ParsedRow>(row.data, {}),
    errors: parse<RowErrors>(row.errors, {}),
    token: row.token ?? null,
    view_count: row.view_count ?? 0,
    first_viewed_at: row.first_viewed_at ?? null,
    saved_at: row.saved_at ?? null,
    shared_at: row.shared_at ?? null,
    cta_clicked_at: row.cta_clicked_at ?? null,
    emailed_at: row.emailed_at ?? null,
    email_error: row.email_error ?? null,
    whatsapp_at: row.whatsapp_at ?? null,
  }
}

function notFound(what = 'Campaign'): never {
  throw createError({ statusCode: 404, message: `${what} not found` })
}

// --- Businesses ----------------------------------------------------------------

/** The user's business, created on their first visit (SPEC M2a.4). Called by requireUser only. */
export async function businessOf(d1: D1Database, userId: string): Promise<Business> {
  const find = d1.prepare('select * from businesses where owner_id = ?').bind(userId)
  const found = await find.first()
  if (found)
    return toBusiness(found)
  // A parallel first request may create it first: then this does nothing.
  await d1.prepare('insert into businesses (id, owner_id, name) values (?, ?, ?) on conflict (owner_id) do nothing')
    .bind(crypto.randomUUID(), userId, 'My business')
    .run()
  const created = await find.first()
  if (!created)
    throw createError({ statusCode: 500, message: 'Creating business failed' })
  return toBusiness(created)
}

// Colour isn't one: it belongs to a Highreel's design since M2.17 (the old accent_color column is no longer read or written).
const BUSINESS_FIELDS = ['name', 'website_url', 'logo_path', 'logo_shape'] as const
export type BusinessUpdate = Partial<Record<typeof BUSINESS_FIELDS[number], string | null>>

export async function updateBusiness(db: Db, update: BusinessUpdate): Promise<Business> {
  const keys = BUSINESS_FIELDS.filter(k => update[k] !== undefined)
  if (!keys.length)
    return getBusiness(db)
  const sets = keys.map(k => `${k} = ?`).join(', ')
  const row = await db.d1.prepare(`update businesses set ${sets} where id = ? returning *`)
    .bind(...keys.map(k => update[k] ?? null), db.businessId)
    .first()
  return row ? toBusiness(row) : notFound('Business')
}

async function getBusiness(db: Db): Promise<Business> {
  const row = await db.d1.prepare('select * from businesses where id = ?').bind(db.businessId).first()
  return row ? toBusiness(row) : notFound('Business')
}

// --- Campaigns -----------------------------------------------------------------

export async function createCampaign(db: Db, input: { name: string, year: number, template_key: string, kind?: CampaignKind, settings?: unknown, starter?: Starter, look?: Look }): Promise<Campaign> {
  const template = getTemplate(input.template_key)
  const base = input.settings ?? (input.starter ? withStarter(normalizeSettings(template.defaultSettings), input.starter) : template.defaultSettings)
  // The design picked in New Highreel, over the business type's suggestion (SPEC M2.17).
  const settings = input.look ? { ...normalizeSettings(base), look: input.look } : base
  const row = await db.d1.prepare('insert into campaigns (id, business_id, name, year, template_key, kind, settings) values (?, ?, ?, ?, ?, ?, ?) returning *')
    .bind(crypto.randomUUID(), db.businessId, input.name, input.year, template.key, input.kind ?? template.kind ?? 'customers', JSON.stringify(settings))
    .first()
  return toCampaign(row!)
}

export async function listCampaigns(db: Db): Promise<CampaignSummary[]> {
  const { results } = await db.d1.prepare(`select c.id, c.name, c.year, c.template_key, c.kind, c.status, c.published_at, c.created_at,
      (select count(*) from recipients r where r.campaign_id = c.id) as row_count
    from campaigns c where c.business_id = ? order by c.created_at desc`).bind(db.businessId).all<Record<string, any>>()
  return results.map(c => ({
    id: c.id,
    name: c.name,
    year: c.year,
    template_key: c.template_key,
    kind: c.kind,
    status: c.status,
    published_at: c.published_at,
    created_at: c.created_at,
    row_count: c.row_count ?? 0,
  }))
}

/** The campaign and its business; 404 unless the campaign is this business's. */
export async function loadWorkspace(db: Db, campaignId: string): Promise<Workspace> {
  const [campaign, business, paid] = await db.d1.batch<Record<string, any>>([
    db.d1.prepare('select * from campaigns where id = ? and business_id = ?').bind(campaignId, db.businessId),
    db.d1.prepare('select * from businesses where id = ?').bind(db.businessId),
    paidStatement(db, campaignId),
  ])
  const c = campaign!.results[0]
  const b = business!.results[0]
  if (!c || !b)
    notFound()
  return { business: toBusiness(b), campaign: { ...toCampaign(c), paid: paid!.results.map(r => r.tier as string) } }
}

// The sizes a campaign is paid for (SPEC §10): its payments that weren't
// refunded. Only Whop's webhook and the checkout's confirm route write them
// (server/utils/payments.ts).
function paidStatement(db: Db, campaignId: string) {
  return db.d1.prepare(`select tier from payments where campaign_id = ? and business_id = ? and status = 'paid' and tier is not null`).bind(campaignId, db.businessId)
}

export async function paidTiers(db: Db, campaignId: string): Promise<string[]> {
  const { results } = await paidStatement(db, campaignId).all<{ tier: string }>()
  return results.map(r => r.tier)
}

/** The campaign with its business, logo and photos signed for the workspace (1 h). */
export async function loadSignedWorkspace(event: H3Event, db: Db, campaignId: string): Promise<Workspace> {
  const ws = await loadWorkspace(db, campaignId)
  const signed = await signMedia(event, ws.business, ws.campaign.settings, 3600)
  return { business: signed.business, campaign: { ...ws.campaign, settings: signed.settings } }
}

export interface CampaignUpdate {
  name?: string
  settings?: CampaignSettings | Record<string, unknown>
  status?: CampaignStatus
  published_at?: string | null
  import_next?: number | null
}

function campaignUpdate(db: Db, campaignId: string, update: CampaignUpdate): D1PreparedStatement {
  const keys = (['name', 'settings', 'status', 'published_at', 'import_next'] as const).filter(k => update[k] !== undefined)
  const values = keys.map(k => (k === 'settings' ? JSON.stringify(update.settings) : update[k] ?? null))
  const sets = [...keys.map(k => `${k} = ?`), 'updated_at = ?'].join(', ')
  return db.d1.prepare(`update campaigns set ${sets} where id = ? and business_id = ?`).bind(...values, now(), campaignId, db.businessId)
}

/** Update a campaign (and its updated_at, which the home shows). */
export async function updateCampaign(db: Db, campaignId: string, update: CampaignUpdate) {
  const { meta } = await campaignUpdate(db, campaignId, update).run()
  if (!meta.changes)
    notFound()
}

/** Delete a campaign; its rows go by cascade (the send log keeps its entries, without the ids). */
export async function deleteCampaign(db: Db, campaignId: string) {
  await db.d1.prepare('delete from campaigns where id = ? and business_id = ?').bind(campaignId, db.businessId).run()
}

/** The campaigns of a year (the home), newest first; all years' campaigns for the year switcher. */
export async function campaignsForHome(db: Db) {
  const { results } = await db.d1.prepare('select id, name, year, template_key, kind, status, published_at, created_at from campaigns where business_id = ? order by created_at desc')
    .bind(db.businessId).all<Record<string, any>>()
  return results as Array<Omit<CampaignSummary, 'row_count'>>
}

/** A year's customer campaigns, oldest first (the business recap's suggestions). */
export async function customerCampaigns(db: Db, year: number) {
  const { results } = await db.d1.prepare('select id, template_key, settings from campaigns where business_id = ? and year = ? and kind = \'customers\' order by created_at')
    .bind(db.businessId, year).all<Record<string, any>>()
  return results.map(c => ({ id: c.id as string, template_key: c.template_key as string, settings: normalizeSettings(parse(c.settings, {})) }))
}

// --- Recipients ----------------------------------------------------------------

/** Up to PAGE_ROWS rows after `after` (a row_index; -1 for the first page), and where the next page starts. */
export async function recipientPage(db: Db, campaignId: string, after = -1, limit = PAGE_ROWS): Promise<{ rows: Recipient[], next: number | null }> {
  const { results } = await db.d1.prepare(`select ${RECIPIENT_COLUMNS} from recipients
    where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?) and row_index > ?
    order by row_index limit ?`).bind(campaignId, db.businessId, after, limit).all<Record<string, any>>()
  const rows = results.map(toRecipient)
  return { rows, next: rows.length === limit ? rows.at(-1)!.row_index : null }
}

/** One row with its campaign's template key and settings (a cell edit). */
export async function recipientWithCampaign(db: Db, id: string) {
  const row = await db.d1.prepare(`select r.id, r.row_index, r.customer_id, r.raw, r.data, r.errors, r.token, r.view_count, r.first_viewed_at, r.saved_at, r.shared_at, r.cta_clicked_at, r.emailed_at, r.email_error, r.whatsapp_at,
      r.campaign_id, c.template_key, c.settings as campaign_settings
    from recipients r join campaigns c on c.id = r.campaign_id
    where r.id = ? and c.business_id = ?`).bind(id, db.businessId).first<Record<string, any>>()
  if (!row)
    notFound('Row')
  return { row: toRecipient(row), campaignId: row.campaign_id as string, templateKey: row.template_key as string, settings: normalizeSettings(parse(row.campaign_settings, {})) }
}

/** Other rows of a campaign with one of these ids (duplicate checks after a cell edit). */
export async function rowsWithIds(db: Db, campaignId: string, ids: string[], exceptId: string): Promise<Recipient[]> {
  if (!ids.length)
    return []
  const { results } = await db.d1.prepare(`select ${RECIPIENT_COLUMNS} from recipients
    where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?)
      and customer_id in (select value from json_each(?)) and id <> ?`).bind(campaignId, db.businessId, JSON.stringify(ids), exceptId).all<Record<string, any>>()
  return results.map(toRecipient)
}

export interface RowWrite {
  raw?: RawRow
  data?: ParsedRow
  errors?: RowErrors
  customer_id?: string
  first_name?: string | null
  email?: string | null
  email_error?: string | null
}

/** Save one row's cells (a cell edit, the business form); null if it isn't this business's. */
export async function saveRecipient(db: Db, id: string, w: RowWrite): Promise<Recipient | null> {
  const keys = (['raw', 'data', 'errors', 'customer_id', 'first_name', 'email', 'email_error'] as const).filter(k => w[k] !== undefined)
  const values: Array<string | number | null> = keys.map(k => (k === 'raw' || k === 'data' || k === 'errors' ? JSON.stringify(w[k]) : w[k] ?? null))
  const sets = keys.map(k => `${k} = ?`)
  if (w.errors !== undefined) {
    sets.push('has_errors = ?')
    values.push(Object.keys(w.errors).length ? 1 : 0)
  }
  sets.push('updated_at = ?')
  try {
    const row = await db.d1.prepare(`update recipients set ${sets.join(', ')}
      where id = ? and campaign_id in (select id from campaigns where business_id = ?) returning ${RECIPIENT_COLUMNS}`)
      .bind(...values, now(), id, db.businessId).first<Record<string, any>>()
    return row ? toRecipient(row) : null
  }
  catch (e) {
    throw uniqueError(e)
  }
}

/** A published row's id taken twice: the database's partial unique index said no. */
export class DuplicatePublishedId extends Error {}
function uniqueError(e: unknown): unknown {
  return /UNIQUE constraint failed: recipients\.campaign_id, recipients\.customer_id/.test(String((e as Error)?.message ?? e)) ? new DuplicatePublishedId('Two published rows share an id') : e
}

/** Insert the business recap's one row. */
export async function insertBusinessRow(db: Db, campaignId: string, w: Required<Pick<RowWrite, 'raw' | 'data' | 'errors'>>): Promise<Recipient> {
  const row = await db.d1.prepare(`insert into recipients (id, campaign_id, row_index, customer_id, raw, data, errors, has_errors)
    select ?, ?, 0, 'business', ?, ?, ?, ? where ? in (select id from campaigns where business_id = ?) returning ${RECIPIENT_COLUMNS}`)
    .bind(crypto.randomUUID(), campaignId, JSON.stringify(w.raw), JSON.stringify(w.data), JSON.stringify(w.errors), Object.keys(w.errors).length ? 1 : 0, campaignId, db.businessId)
    .first<Record<string, any>>()
  return row ? toRecipient(row) : notFound()
}

/** The business recap's one row: its id and token, or null before the form is first saved. */
export async function businessRow(db: Db, campaignId: string) {
  return db.d1.prepare(`select id, token, customer_id, raw, data, errors from recipients
    where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?) order by row_index limit 1`)
    .bind(campaignId, db.businessId).first<Record<string, any>>()
}

/** Copy a business recap's row into its duplicate (both campaigns this business's). */
export async function copyBusinessRow(db: Db, fromId: string, toId: string) {
  await db.d1.prepare(`insert into recipients (id, campaign_id, row_index, customer_id, raw, data, errors, has_errors)
    select ?, ?, 0, customer_id, raw, data, errors, has_errors from recipients
    where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?)
      and ? in (select id from campaigns where business_id = ?)
    order by row_index limit 1`).bind(crypto.randomUUID(), toId, fromId, db.businessId, toId, db.businessId).run()
}

/** Delete every row of a campaign. */
export function clearRowsStatement(db: Db, campaignId: string): D1PreparedStatement {
  return db.d1.prepare('delete from recipients where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?)').bind(campaignId, db.businessId)
}

export async function clearRows(db: Db, campaignId: string) {
  await clearRowsStatement(db, campaignId).run()
}

export interface NewRow {
  row_index: number
  customer_id: string
  first_name: string | null
  email: string | null
  raw: RawRow
  data: ParsedRow
  errors: RowErrors
}

/** Statements that insert rows (one JSON parameter each, inside the business's campaign). */
export function insertRowStatements(db: Db, campaignId: string, rows: NewRow[]): D1PreparedStatement[] {
  return jsonChunks(rows.map(r => ({ ...r, id: crypto.randomUUID() }))).map(chunk => db.d1.prepare(`insert into recipients (id, campaign_id, row_index, customer_id, first_name, email, raw, data, errors, has_errors)
    select json_extract(value, '$.id'), ?, json_extract(value, '$.row_index'), json_extract(value, '$.customer_id'), json_extract(value, '$.first_name'), json_extract(value, '$.email'),
      json_extract(value, '$.raw'), json_extract(value, '$.data'), json_extract(value, '$.errors'), json_extract(value, '$.errors') <> '{}'
    from json_each(?) where ? in (select id from campaigns where business_id = ?)`).bind(campaignId, chunk, campaignId, db.businessId))
}

/** Statements that set data, errors and customer_id of existing rows (validation results). */
export function revalidatedRowStatements(db: Db, campaignId: string, rows: Array<{ id: string, data: ParsedRow, errors: RowErrors }>): D1PreparedStatement[] {
  const at = now()
  return jsonChunks(rows).map(chunk => db.d1.prepare(`update recipients set data = json_extract(x.value, '$.data'), errors = json_extract(x.value, '$.errors'), has_errors = json_extract(x.value, '$.errors') <> '{}',
      first_name = json_extract(x.value, '$.data.first_name'), email = json_extract(x.value, '$.data.email'), updated_at = ?
    from json_each(?) as x
    where recipients.id = json_extract(x.value, '$.id') and +recipients.campaign_id = ? and +recipients.campaign_id in (select id from campaigns where business_id = ?)`)
    .bind(at, chunk, campaignId, db.businessId))
}

/** Statements that give rows their links and ranks at publish (a null rank removes it). */
export function publishRowStatements(db: Db, campaignId: string, rows: Array<{ id: string, token: string | null, ranks: Record<string, number | null> }>): D1PreparedStatement[] {
  const at = now()
  return jsonChunks(rows).map(chunk => db.d1.prepare(`update recipients set token = coalesce(recipients.token, json_extract(x.value, '$.token')), data = json_patch(recipients.data, json_extract(x.value, '$.ranks')), updated_at = ?
    from json_each(?) as x
    where recipients.id = json_extract(x.value, '$.id') and +recipients.campaign_id = ? and +recipients.campaign_id in (select id from campaigns where business_id = ?)`)
    .bind(at, chunk, campaignId, db.businessId))
}

/** A batch is one transaction: all of it lands, or none. */
export async function runBatch(db: Db, statements: D1PreparedStatement[]) {
  if (!statements.length)
    return
  try {
    await db.d1.batch(statements)
  }
  catch (e) {
    throw uniqueError(e)
  }
}

export const campaignUpdateStatement = campaignUpdate

/** For validation: one page of rows' cells and results. */
export async function rowsForCheck(db: Db, campaignId: string, after: number, limit = PAGE_ROWS) {
  const { results } = await db.d1.prepare(`select id, row_index, customer_id, raw, data, errors, token from recipients
    where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?) and row_index > ?
    order by row_index limit ?`).bind(campaignId, db.businessId, after, limit).all<Record<string, any>>()
  return results.map(r => ({ id: r.id as string, row_index: r.row_index as number, customer_id: r.customer_id as string, token: (r.token ?? null) as string | null, raw: parse<RawRow>(r.raw, {}), dataText: r.data as string, errorsText: r.errors as string }))
}

/** Where an unfinished sheet upload continues: the next part expected, or null. */
export async function importNext(db: Db, campaignId: string): Promise<number | null> {
  const row = await db.d1.prepare('select import_next from campaigns where id = ? and business_id = ?').bind(campaignId, db.businessId).first<{ import_next: number | null }>()
  return row ? row.import_next : notFound()
}

/** Rows whose id another row of the campaign also has: { row_index, customer_id }. */
export async function duplicateIdRows(db: Db, campaignId: string) {
  const { results } = await db.d1.prepare(`select row_index, customer_id from recipients
    where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?) and customer_id <> ''
      and customer_id in (select customer_id from recipients where campaign_id = ? and customer_id <> '' group by customer_id having count(*) > 1)`)
    .bind(campaignId, db.businessId, campaignId).all<{ row_index: number, customer_id: string }>()
  return results
}

/** Rows, rows with errors, and rows with a link (an import's or publish's answer). */
export async function rowCounts(db: Db, campaignId: string) {
  const row = await db.d1.prepare(`select count(*) as total, count(*) filter (where has_errors) as errors, count(*) filter (where token is not null and not has_errors) as published
    from recipients where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?)`).bind(campaignId, db.businessId).first<Record<string, number>>()
  return { total: row?.total ?? 0, errors: row?.errors ?? 0, published: row?.published ?? 0 }
}

/** The links file, a page at a time: published rows without errors. */
export async function linkRows(db: Db, campaignId: string, after: number, limit = PAGE_ROWS) {
  const { results } = await db.d1.prepare(`select row_index, customer_id, json_extract(data, '$.first_name') as first_name, json_extract(data, '$.email') as email, token from recipients
    where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?) and row_index > ? and token is not null and not has_errors
    order by row_index limit ?`).bind(campaignId, db.businessId, after, limit).all<{ row_index: number, customer_id: string, first_name: unknown, email: unknown, token: string }>()
  return results
}

/** WhatsApp, one tap per person (M2.9): set or clear when the chat was opened. Only published rows. */
export async function setWhatsapp(db: Db, campaignId: string, recipientId: string, at: string | null) {
  return db.d1.prepare(`update recipients set whatsapp_at = ?
    where id = ? and campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?) and token is not null
    returning id, whatsapp_at`).bind(at, recipientId, campaignId, db.businessId).first<{ id: string, whatsapp_at: string | null }>()
}

// --- Sending (M2.8–M2.11) ------------------------------------------------------

// A row's address is its `email` column (the parsed, valid address), lowercased.
// Who's left to email, in the order the Share tab counts them:
// sent, no address, unsubscribed, bounced, failed (unless retrying), pending.
const AUDIENCE_STATE = `case
    when r.emailed_at is not null then 'sent'
    when r.email is null or length(r.email) > 254 then 'noEmail'
    when exists (select 1 from email_optouts o where o.business_id = ? and o.email = lower(trim(r.email))) then 'unsubscribed'
    when exists (select 1 from email_bounces b where b.business_id = ? and b.email = lower(trim(r.email))) then 'bounced'
    when r.email_error is not null and not ? then 'failed'
    else 'pending' end`

export interface AudienceCounts { pending: number, sent: number, failed: number, noEmail: number, unsubscribed: number, bounced: number }

/** How many published rows are in each sending state. */
export async function audienceCounts(db: Db, campaignId: string, retry = false): Promise<AudienceCounts> {
  const { results } = await db.d1.prepare(`select ${AUDIENCE_STATE} as state, count(*) as n from recipients r
    where r.campaign_id = ? and r.campaign_id in (select id from campaigns where business_id = ?) and r.token is not null and not r.has_errors
    group by state`).bind(db.businessId, db.businessId, retry ? 1 : 0, campaignId, db.businessId).all<{ state: keyof AudienceCounts, n: number }>()
  const out: AudienceCounts = { pending: 0, sent: 0, failed: 0, noEmail: 0, unsubscribed: 0, bounced: 0 }
  for (const r of results)
    out[r.state] = r.n
  return out
}

/** The next rows to email, in sheet order: id, token and the data the email uses. */
export async function pendingRows(db: Db, campaignId: string, retry: boolean, limit: number): Promise<Recipient[]> {
  const { results } = await db.d1.prepare(`select r.id, r.row_index, r.token, json_extract(r.data, '$.first_name') as first_name, r.email from recipients r
    where r.campaign_id = ? and r.campaign_id in (select id from campaigns where business_id = ?) and r.token is not null and not r.has_errors
      and (${AUDIENCE_STATE}) = 'pending'
    order by r.row_index limit ?`).bind(campaignId, db.businessId, db.businessId, db.businessId, retry ? 1 : 0, limit).all<Record<string, any>>()
  return results.map(r => toRecipient({ ...r, data: JSON.stringify({ first_name: r.first_name ?? null, email: r.email ?? null }) }))
}

/** A published, valid row for "Send a test": this one if it qualifies, else the first. */
export async function testRow(db: Db, campaignId: string, preferId: string | undefined): Promise<Recipient | null> {
  const row = await db.d1.prepare(`select id, row_index, token, json_extract(data, '$.first_name') as first_name, email from recipients
    where campaign_id = ? and campaign_id in (select id from campaigns where business_id = ?) and token is not null and not has_errors
    order by (id = ?) desc, row_index limit 1`).bind(campaignId, db.businessId, preferId ?? '').first<Record<string, any>>()
  return row ? toRecipient({ ...row, data: JSON.stringify({ first_name: row.first_name ?? null, email: row.email ?? null }) }) : null
}

export async function markSent(db: Db, campaignId: string, ids: string[], at: string) {
  if (!ids.length)
    return
  await db.d1.prepare(`update recipients set emailed_at = ?, email_error = null
    where id in (select value from json_each(?)) and +campaign_id = ? and +campaign_id in (select id from campaigns where business_id = ?)`)
    .bind(at, JSON.stringify(ids), campaignId, db.businessId).run()
}

export async function markFailed(db: Db, campaignId: string, failures: Array<{ id: string, error: string }>) {
  if (!failures.length)
    return
  await db.d1.prepare(`update recipients set email_error = json_extract(x.value, '$.error')
    from json_each(?) as x
    where recipients.id = json_extract(x.value, '$.id') and +recipients.campaign_id = ? and +recipients.campaign_id in (select id from campaigns where business_id = ?)`)
    .bind(JSON.stringify(failures), campaignId, db.businessId).run()
}

/** Remember addresses that bounced, for good (M2.11). */
export async function addBounces(db: Db, bounces: Array<{ email: string, reason: string }>) {
  if (!bounces.length)
    return
  await db.d1.prepare(`insert into email_bounces (business_id, email, reason)
    select ?, lower(json_extract(value, '$.email')), substr(json_extract(value, '$.reason'), 1, 200) from json_each(?) where true
    on conflict (business_id, email) do nothing`).bind(db.businessId, JSON.stringify(bounces)).run()
}

export interface SendLogEntry { campaign_id: string | null, recipient_id: string | null, kind: 'recap' | 'test', ok: boolean, error: string | null, provider_id: string | null }

/** Add to the send log (the daily limit counts it). Campaigns must be this business's. */
export async function logSends(db: Db, entries: SendLogEntry[]) {
  if (!entries.length)
    return
  await db.d1.prepare(`insert into email_sends (id, business_id, campaign_id, recipient_id, kind, ok, error, provider_id)
    select json_extract(value, '$.id'), ?, json_extract(value, '$.campaign_id'), json_extract(value, '$.recipient_id'), json_extract(value, '$.kind'),
      json_extract(value, '$.ok'), json_extract(value, '$.error'), json_extract(value, '$.provider_id')
    from json_each(?)
    where json_extract(value, '$.campaign_id') is null or json_extract(value, '$.campaign_id') in (select id from campaigns where business_id = ?)`)
    .bind(db.businessId, JSON.stringify(entries.map(e => ({ ...e, id: crypto.randomUUID(), ok: e.ok ? 1 : 0 }))), db.businessId).run()
}

/** Emails of a kind this business sent in the last 24 hours (`okOnly`: failed tries don't count). */
export async function sendsSince(db: Db, kind: 'recap' | 'test' | null, okOnly: boolean): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const row = await db.d1.prepare(`select count(*) as n from email_sends
    where business_id = ? and created_at >= ? and (? is null or kind = ?) and (not ? or ok = 1)`)
    .bind(db.businessId, since, kind, kind, okOnly ? 1 : 0).first<{ n: number }>()
  return row?.n ?? 0
}

// --- The email account (M2.9) --------------------------------------------------

export type StoredConnection = EmailConnection & { password_enc: string }

function toConnection(row: Record<string, any>): StoredConnection {
  return {
    provider: row.provider,
    host: row.host,
    port: row.port,
    secure: row.secure === 1,
    username: row.username,
    password_enc: row.password_enc,
    from_email: row.from_email,
    from_name: row.from_name,
    reply_to: row.reply_to ?? null,
    daily_limit: row.daily_limit,
    verified_at: row.verified_at ?? null,
  }
}

export async function loadConnection(db: Db): Promise<StoredConnection | null> {
  const row = await db.d1.prepare('select * from email_connections where business_id = ?').bind(db.businessId).first()
  return row ? toConnection(row) : null
}

export async function saveConnection(db: Db, c: StoredConnection): Promise<StoredConnection> {
  const row = await db.d1.prepare(`insert into email_connections (business_id, provider, host, port, secure, username, password_enc, from_email, from_name, reply_to, daily_limit, verified_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict (business_id) do update set provider = excluded.provider, host = excluded.host, port = excluded.port, secure = excluded.secure,
      username = excluded.username, password_enc = excluded.password_enc, from_email = excluded.from_email, from_name = excluded.from_name,
      reply_to = excluded.reply_to, daily_limit = excluded.daily_limit, verified_at = excluded.verified_at, updated_at = excluded.updated_at
    returning *`)
    .bind(db.businessId, c.provider, c.host, c.port, c.secure ? 1 : 0, c.username, c.password_enc, c.from_email, c.from_name, c.reply_to ?? null, c.daily_limit, c.verified_at ?? null, now())
    .first()
  return toConnection(row!)
}

export async function deleteConnection(db: Db) {
  await db.d1.prepare('delete from email_connections where business_id = ?').bind(db.businessId).run()
}

// --- The home (M2.5 P3) and the business recap's suggestions (P4) -------------

export interface CampaignStats {
  campaign_id: string
  row_count: number
  need_fixing: number
  published: number
  opened: number
  views: number
  saved: number
  shared: number
  clicked: number
  last_change: string
}

/**
 * Per campaign of a year: rows, rows needing a fix, and among the published
 * ones (a link and no errors) how many were opened, viewed, saved, shared and
 * clicked. Reads only the recipients_home index.
 */
export async function campaignStats(db: Db, year: number): Promise<CampaignStats[]> {
  const live = 'r.token is not null and not r.has_errors'
  const { results } = await db.d1.prepare(`select c.id as campaign_id,
      count(r.campaign_id) as row_count,
      count(r.campaign_id) filter (where r.has_errors) as need_fixing,
      count(r.campaign_id) filter (where ${live}) as published,
      count(r.campaign_id) filter (where ${live} and r.view_count > 0) as opened,
      coalesce(sum(r.view_count) filter (where ${live}), 0) as views,
      count(r.campaign_id) filter (where ${live} and r.saved_at is not null) as saved,
      count(r.campaign_id) filter (where ${live} and r.shared_at is not null) as shared,
      count(r.campaign_id) filter (where ${live} and r.cta_clicked_at is not null) as clicked,
      max(c.updated_at, coalesce(max(r.updated_at), c.updated_at)) as last_change
    from campaigns c left join recipients r on r.campaign_id = c.id
    where c.business_id = ? and c.year = ?
    group by c.id`).bind(db.businessId, year).all<CampaignStats>()
  return results
}

/** The latest first views, saves, shares and button taps of a year's Highreels. */
export async function recentActivity(db: Db, year: number, limit: number): Promise<HomeActivity[]> {
  const { results } = await db.d1.prepare(`with mine as (
      select r.campaign_id, r.first_name, r.first_viewed_at, r.saved_at, r.shared_at, r.cta_clicked_at
      from recipients r join campaigns c on c.id = r.campaign_id
      where c.business_id = ? and c.year = ? and r.token is not null
    )
    select * from (
      select campaign_id, first_name, 'view' as event, first_viewed_at as at from mine where first_viewed_at is not null
      union all select campaign_id, first_name, 'save', saved_at from mine where saved_at is not null
      union all select campaign_id, first_name, 'share', shared_at from mine where shared_at is not null
      union all select campaign_id, first_name, 'cta', cta_clicked_at from mine where cta_clicked_at is not null
    ) order by at desc limit ?`).bind(db.businessId, year, Math.min(Math.max(limit, 1), 100)).all<HomeActivity>()
  return results
}

/**
 * Per customer campaign of a year: its published rows (a link, no errors) and
 * the sum of every numeric value in them ("195 customers got a Highreel",
 * "236,000 habits checked off"). Ranks aren't totals.
 */
export async function campaignSums(db: Db, year: number): Promise<Array<{ campaign_id: string, published: number, sums: Record<string, number> }>> {
  const [counts, sums] = await db.d1.batch<Record<string, any>>([
    db.d1.prepare(`select r.campaign_id, count(*) as published from recipients r join campaigns c on c.id = r.campaign_id
      where c.business_id = ? and c.year = ? and c.kind = 'customers' and r.token is not null and not r.has_errors
      group by r.campaign_id`).bind(db.businessId, year),
    db.d1.prepare(`select r.campaign_id, e.key, sum(e.value) as total from recipients r join campaigns c on c.id = r.campaign_id, json_each(r.data) as e
      where c.business_id = ? and c.year = ? and c.kind = 'customers' and r.token is not null and not r.has_errors
        and e.type in ('integer', 'real') and e.key not like 'computed\\_top%' escape '\\'
      group by r.campaign_id, e.key`).bind(db.businessId, year),
  ])
  const out = new Map<string, { campaign_id: string, published: number, sums: Record<string, number> }>()
  for (const c of counts!.results)
    out.set(c.campaign_id, { campaign_id: c.campaign_id, published: c.published, sums: {} })
  for (const s of sums!.results)
    out.get(s.campaign_id)!.sums[s.key] = s.total
  return [...out.values()]
}

export function requireUuid(value: string | undefined, what = 'id'): string {
  if (!value || !/^[0-9a-f-]{36}$/i.test(value))
    throw createError({ statusCode: 400, message: `Invalid ${what}` })
  return value
}
