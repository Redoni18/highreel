// The admin pages' SQL (SPEC M2.15): the one place that reads across
// businesses. Every function takes an `AdminDb`, which only requireAdmin()
// hands out (an account with the admin role), and every statement is a
// select: what the admin pages change (blocking and removing accounts) is in
// moderation.ts. They read accounts, businesses and
// counts (Highreels, rows, opens, emails sent, payments), never a sheet's
// contents: no statement here reads a row's raw, data, email or first name.
// tests/isolation.test.ts holds both rules.

import type { D1Database } from '@cloudflare/workers-types'
import type { AdminHighreel, AdminOverview, AdminPayment, AdminUser, AdminUserDetail, AdminUserHighreel, AdminUsers, BlockedAddress, Money, UserKind } from '#shared/types/admin'

/** The admin's view of the database: everything, read-only. */
export interface AdminDb {
  d1: D1Database
  adminId: string
}

/** Rows per list; the newest come first. */
export const ADMIN_LIST = 2000

const WEEK = 7 * 24 * 60 * 60_000

// What customers did with each campaign's Highreels, from the recipients_home
// index alone (like the home's counts): a row counts once it has a link and no
// errors. `where` narrows it to some campaigns (one business on its page).
function reach(where = '') {
  const live = 'r.token is not null and not r.has_errors'
  return `reach as (
    select r.campaign_id,
      count(*) as rows,
      count(*) filter (where ${live}) as live,
      count(*) filter (where ${live} and r.view_count > 0) as opened,
      coalesce(sum(r.view_count) filter (where ${live}), 0) as views,
      count(*) filter (where ${live} and r.saved_at is not null) as saved,
      count(*) filter (where ${live} and r.shared_at is not null) as shared,
      count(*) filter (where ${live} and r.cta_clicked_at is not null) as clicked
    from recipients r ${where}
    group by r.campaign_id
  )`
}

// Paid payments per campaign, and per business: their count and the amounts per currency.
const PAID_BY_CAMPAIGN = `paid as (
    select campaign_id, sum(n) as payments, json_group_object(currency, total) as amounts
    from (select campaign_id, currency, count(*) as n, sum(amount) as total from payments
      where status = 'paid' and campaign_id is not null group by campaign_id, currency)
    group by campaign_id
  )`
const PAID_BY_BUSINESS = `money as (
    select business_id, sum(n) as payments, json_group_object(currency, total) as amounts
    from (select business_id, currency, count(*) as n, sum(amount) as total from payments
      where status = 'paid' group by business_id, currency)
    group by business_id
  )`

const isDemo = 'coalesce(u."isAnonymous", 0) = 1'
// Published for customers without a payment (a business's own Highreel is free, SPEC §10).
const UNPAID = 'c.status = \'published\' and c.kind = \'customers\' and paid.campaign_id is null'
// Its address is on the block list (addresses are stored lowercased, like Better Auth's).
const isBlocked = 'exists (select 1 from blocked_emails x where x.email = lower(u.email))'

function money(value: unknown): Money {
  if (typeof value !== 'string')
    return {}
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === 'number')) as Money
  }
  catch {
    return {}
  }
}

const reachOf = (r: Record<string, any>) => ({
  live: r.live ?? 0,
  opened: r.opened ?? 0,
  saved: r.saved ?? 0,
  shared: r.shared ?? 0,
  clicked: r.clicked ?? 0,
})

function toUser(r: Record<string, any>): AdminUser {
  const demo = Boolean(r.demo)
  return {
    id: r.id,
    email: demo ? null : r.email,
    demo,
    role: r.role === 'admin' ? 'admin' : 'client',
    blocked: Boolean(r.blocked),
    created_at: r.created_at,
    last_seen: r.last_seen ?? null,
    business_id: r.business_id ?? null,
    business: r.business ?? null,
    highreels: r.highreels ?? 0,
    published: r.published ?? 0,
    unpaid: r.unpaid ?? 0,
    emails: r.emails ?? 0,
    payments: r.payments ?? 0,
    spent: money(r.spent),
    ...reachOf(r),
  }
}

function toHighreel(r: Record<string, any>): AdminHighreel {
  return {
    id: r.id,
    name: r.name,
    year: r.year,
    template_key: r.template_key,
    kind: r.kind === 'business' ? 'business' : 'customers',
    status: r.status,
    created_at: r.created_at,
    published_at: r.published_at ?? null,
    business_id: r.business_id,
    business: r.business,
    owner_id: r.owner_id,
    owner_email: r.demo ? null : r.owner_email,
    rows: r.rows ?? 0,
    views: r.views ?? 0,
    payments: r.payments ?? 0,
    paid: money(r.paid),
    ...reachOf(r),
  }
}

function toPayment(r: Record<string, any>): AdminPayment {
  return {
    id: r.id,
    business_id: r.business_id,
    business: r.business,
    owner_id: r.owner_id,
    owner_email: r.demo ? null : r.owner_email,
    campaign_id: r.campaign_id ?? null,
    campaign: r.campaign ?? null,
    tier: r.tier ?? null,
    amount: r.amount,
    net: typeof r.net === 'number' ? r.net : null,
    currency: r.currency,
    status: r.status === 'refunded' ? 'refunded' : 'paid',
    paid_at: r.paid_at,
    refunded_at: r.refunded_at ?? null,
  }
}

// --- Users ---------------------------------------------------------------------

// One user per row with their business's totals. `filter` and `order` finish the statement.
function usersStatement(admin: AdminDb, filter: string, order: string, binds: unknown[]) {
  return admin.d1.prepare(`with ${reach()},
    ${PAID_BY_CAMPAIGN},
    ${PAID_BY_BUSINESS},
    totals as (
      select c.business_id,
        count(*) as highreels,
        count(*) filter (where c.status = 'published') as published,
        count(*) filter (where ${UNPAID}) as unpaid,
        coalesce(sum(reach.live), 0) as live, coalesce(sum(reach.opened), 0) as opened, coalesce(sum(reach.saved), 0) as saved,
        coalesce(sum(reach.shared), 0) as shared, coalesce(sum(reach.clicked), 0) as clicked
      from campaigns c left join reach on reach.campaign_id = c.id left join paid on paid.campaign_id = c.id
      group by c.business_id
    ),
    sent as (select business_id, count(*) as emails from email_sends where kind = 'recap' and ok = 1 group by business_id)
    select u.id, u.email, ${isDemo} as demo, u.role, ${isBlocked} as blocked, u."createdAt" as created_at,
      (select max(s."updatedAt") from session s where s."userId" = u.id) as last_seen,
      b.id as business_id, b.name as business,
      totals.highreels, totals.published, totals.unpaid, totals.live, totals.opened, totals.saved, totals.shared, totals.clicked,
      sent.emails, money.payments, money.amounts as spent
    from "user" u
      left join businesses b on b.owner_id = u.id
      left join totals on totals.business_id = b.id
      left join sent on sent.business_id = b.id
      left join money on money.business_id = b.id
    ${filter} ${order}`).bind(...binds)
}

const KIND_FILTER: Record<Exclude<UserKind, 'blocked'>, string> = {
  accounts: `where not ${isDemo}`,
  demos: `where ${isDemo}`,
  admins: 'where u.role = \'admin\'',
}

/** Accounts, demos or admins, newest first, with what each made, sent and paid; or the blocked addresses. */
export async function adminUsers(admin: AdminDb, kind: UserKind): Promise<AdminUsers> {
  const [list, counts] = await admin.d1.batch<Record<string, any>>([
    kind === 'blocked'
      ? blockedStatement(admin, [ADMIN_LIST + 1])
      : usersStatement(admin, KIND_FILTER[kind], 'order by u."createdAt" desc limit ?', [ADMIN_LIST + 1]),
    admin.d1.prepare(`select count(*) filter (where not ${isDemo}) as accounts, count(*) filter (where ${isDemo}) as demos,
      count(*) filter (where u.role = 'admin') as admins, (select count(*) from blocked_emails) as blocked from "user" u`).bind(),
  ])
  const rows = list!.results
  const c = counts!.results[0] ?? {}
  return {
    kind,
    counts: { accounts: c.accounts ?? 0, demos: c.demos ?? 0, admins: c.admins ?? 0, blocked: c.blocked ?? 0 },
    users: kind === 'blocked' ? [] : rows.slice(0, ADMIN_LIST).map(toUser),
    blocked: kind === 'blocked' ? rows.slice(0, ADMIN_LIST) as BlockedAddress[] : [],
    more: rows.length > ADMIN_LIST,
  }
}

// Blocked addresses, newest first, with who blocked each and the account still using it.
function blockedStatement(admin: AdminDb, binds: unknown[]) {
  return admin.d1.prepare(`select x.email, x.reason, x.created_at, a.email as blocked_by, u.id as user_id
    from blocked_emails x
      left join "user" u on u.email = x.email and not ${isDemo}
      left join "user" a on a.id = x.blocked_by
    order by x.created_at desc limit ?`).bind(...binds)
}

// --- Highreels -----------------------------------------------------------------

function highreelsStatement(admin: AdminDb, filter: string, order: string, binds: unknown[], scope = '') {
  return admin.d1.prepare(`with ${reach(scope)},
    ${PAID_BY_CAMPAIGN}
    select c.id, c.name, c.year, c.template_key, c.kind, c.status, c.created_at, c.published_at,
      b.id as business_id, b.name as business, u.id as owner_id, u.email as owner_email, ${isDemo} as demo,
      reach.rows, reach.live, reach.opened, reach.views, reach.saved, reach.shared, reach.clicked,
      paid.payments, paid.amounts as paid
    from campaigns c
      join businesses b on b.id = c.business_id
      join "user" u on u.id = b.owner_id
      left join reach on reach.campaign_id = c.id
      left join paid on paid.campaign_id = c.id
    ${filter} ${order}`).bind(...binds)
}

/** Every Highreel (campaign), newest first; demos' only when asked. */
export async function adminHighreels(admin: AdminDb, demos: boolean) {
  const { results } = await highreelsStatement(admin, demos ? '' : `where not ${isDemo}`, 'order by c.created_at desc limit ?', [ADMIN_LIST + 1]).all<Record<string, any>>()
  return { demos, highreels: results.slice(0, ADMIN_LIST).map(toHighreel), more: results.length > ADMIN_LIST }
}

// --- Payments ------------------------------------------------------------------

function paymentsStatement(admin: AdminDb, filter: string, binds: unknown[]) {
  return admin.d1.prepare(`select p.id, p.business_id, b.name as business, u.id as owner_id, u.email as owner_email, ${isDemo} as demo,
      p.campaign_id, c.name as campaign, p.tier, p.amount, p.net, p.currency, p.status, p.paid_at, p.refunded_at
    from payments p
      join businesses b on b.id = p.business_id
      join "user" u on u.id = b.owner_id
      left join campaigns c on c.id = p.campaign_id
    ${filter} order by p.paid_at desc limit ?`).bind(...binds)
}

/** Every payment, newest first. */
export async function adminPayments(admin: AdminDb) {
  const { results } = await paymentsStatement(admin, '', [ADMIN_LIST + 1]).all<Record<string, any>>()
  return { payments: results.slice(0, ADMIN_LIST).map(toPayment), more: results.length > ADMIN_LIST }
}

// --- Overview ------------------------------------------------------------------

/** The whole service at a glance: accounts (demos apart), what they made and sent, and what came in. */
export async function adminOverview(admin: AdminDb, now = new Date()): Promise<AdminOverview> {
  const weekAgo = new Date(now.getTime() - WEEK).toISOString()
  const [people, made, takings, newest, published, payments] = await admin.d1.batch<Record<string, any>>([
    admin.d1.prepare(`select count(*) filter (where not ${isDemo}) as accounts, count(*) filter (where ${isDemo}) as demos,
        count(*) filter (where u.role = 'admin') as admins,
        count(*) filter (where not ${isDemo} and u."createdAt" > ?) as joined_week,
        count(*) filter (where not ${isDemo} and exists (select 1 from session s where s."userId" = u.id and s."updatedAt" > ?)) as active_week,
        (select count(*) from blocked_emails) as blocked
      from "user" u`).bind(weekAgo, weekAgo),
    admin.d1.prepare(`with ${reach()},
      ${PAID_BY_CAMPAIGN}
      select count(distinct c.business_id) as makers, count(*) as highreels,
        count(distinct c.business_id) filter (where c.status = 'published') as publishers,
        count(*) filter (where c.status = 'published') as published,
        count(*) filter (where ${UNPAID}) as unpaid,
        coalesce(sum(reach.live), 0) as live, coalesce(sum(reach.opened), 0) as opened, coalesce(sum(reach.saved), 0) as saved,
        coalesce(sum(reach.shared), 0) as shared, coalesce(sum(reach.clicked), 0) as clicked
      from campaigns c
        join businesses b on b.id = c.business_id
        join "user" u on u.id = b.owner_id
        left join reach on reach.campaign_id = c.id
        left join paid on paid.campaign_id = c.id
      where not ${isDemo}`).bind(),
    admin.d1.prepare(`select count(distinct business_id) filter (where status = 'paid') as payers,
        count(*) filter (where status = 'paid') as payments, count(*) filter (where status = 'refunded') as refunded,
        count(*) filter (where status = 'paid' and net is null) as unknown_net,
        (select json_group_object(currency, total) from (select currency, sum(amount) as total from payments where status = 'paid' group by currency)) as revenue,
        (select json_group_object(currency, total) from (select currency, sum(amount) as total from payments where status = 'paid' and net is not null group by currency)) as revenue_known,
        (select json_group_object(currency, total) from (select currency, sum(net) as total from payments where status = 'paid' and net is not null group by currency)) as net,
        (select json_group_object(currency, total) from (select currency, sum(amount) as total from payments where status = 'refunded' group by currency)) as refunds
      from payments`).bind(),
    usersStatement(admin, KIND_FILTER.accounts, 'order by u."createdAt" desc limit ?', [8]),
    highreelsStatement(admin, `where c.published_at is not null and not ${isDemo}`, 'order by c.published_at desc limit ?', [8]),
    paymentsStatement(admin, '', [8]),
  ])
  const p = people!.results[0] ?? {}
  const m = made!.results[0] ?? {}
  const pay = takings!.results[0] ?? {}
  return {
    accounts: p.accounts ?? 0,
    demos: p.demos ?? 0,
    admins: p.admins ?? 0,
    blocked: p.blocked ?? 0,
    joined_week: p.joined_week ?? 0,
    active_week: p.active_week ?? 0,
    makers: m.makers ?? 0,
    highreels: m.highreels ?? 0,
    publishers: m.publishers ?? 0,
    published: m.published ?? 0,
    unpaid: m.unpaid ?? 0,
    reach: reachOf(m),
    payers: pay.payers ?? 0,
    payments: pay.payments ?? 0,
    refunded: pay.refunded ?? 0,
    revenue: money(pay.revenue),
    revenue_known: money(pay.revenue_known),
    net: money(pay.net),
    refunds: money(pay.refunds),
    unknown_net: pay.unknown_net ?? 0,
    newest: newest!.results.map(toUser),
    latest_published: published!.results.map(toHighreel),
    latest_payments: payments!.results.map(toPayment),
  }
}

// --- One user ------------------------------------------------------------------

/** A user's page: the account, its business, every Highreel with how it went out, and its payments; null if there's no such user. */
export async function adminUser(admin: AdminDb, userId: string): Promise<AdminUserDetail | null> {
  const [users, businesses, sessions] = await admin.d1.batch<Record<string, any>>([
    usersStatement(admin, 'where u.id = ?', 'limit 1', [userId]),
    admin.d1.prepare(`select b.id, b.name, b.website_url, b.created_at, e.provider as email_provider
      from businesses b left join email_connections e on e.business_id = b.id where b.owner_id = ?`).bind(userId),
    admin.d1.prepare('select count(*) as n from session where "userId" = ? and "expiresAt" > ?').bind(userId, new Date().toISOString()),
  ])
  const user = users!.results[0]
  if (!user)
    return null
  const business = businesses!.results[0] as AdminUserDetail['business'] | undefined
  if (!business)
    return { user: toUser(user), business: null, sessions: sessions!.results[0]?.n ?? 0, highreels: [], payments: [] }

  // Only this business's rows, and the two marks the home's index doesn't hold.
  const [highreels, sends, payments] = await admin.d1.batch<Record<string, any>>([
    highreelsStatement(admin, 'where c.business_id = ?', 'order by c.created_at desc limit ?', [business.id, business.id, ADMIN_LIST], 'where r.campaign_id in (select id from campaigns where business_id = ?)'),
    admin.d1.prepare(`select r.campaign_id, count(*) filter (where r.emailed_at is not null) as emailed, count(*) filter (where r.whatsapp_at is not null) as whatsapp
      from recipients r where r.campaign_id in (select id from campaigns where business_id = ?) group by r.campaign_id`).bind(business.id),
    paymentsStatement(admin, 'where p.business_id = ?', [business.id, ADMIN_LIST]),
  ])
  const sent = new Map(sends!.results.map(s => [s.campaign_id as string, s]))
  return {
    user: toUser(user),
    business,
    sessions: sessions!.results[0]?.n ?? 0,
    highreels: highreels!.results.map((r): AdminUserHighreel => ({
      ...toHighreel(r),
      emailed: sent.get(r.id)?.emailed ?? 0,
      whatsapp: sent.get(r.id)?.whatsapp ?? 0,
    })),
    payments: payments!.results.map(toPayment),
  }
}
