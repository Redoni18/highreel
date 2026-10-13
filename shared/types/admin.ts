// The admin pages' data (SPEC M2.15): accounts, their Highreels and payments,
// as counts. Never a sheet's rows: no customer's name, email or numbers.

import type { CampaignKind, CampaignStatus } from './recap'

export type Role = 'client' | 'admin'

/** Amounts per currency, in minor units: { usd: 9900 }. */
export type Money = Record<string, number>

/** What customers did with a set of Highreels (rows with a link and no errors). */
export interface Reach {
  /** customers' Highreels with a link */
  live: number
  opened: number
  saved: number
  shared: number
  clicked: number
}

export interface AdminUser extends Reach {
  id: string
  /** null for a demo session */
  email: string | null
  demo: boolean
  role: Role
  /** its address is blocked (migrations/0005_blocks.sql) */
  blocked: boolean
  created_at: string
  /** the latest session's last use (to the day: sessions are refreshed daily); null when none is left */
  last_seen: string | null
  business_id: string | null
  business: string | null
  /** Highreels made (campaigns) */
  highreels: number
  /** of them, published */
  published: number
  /** published but not paid for */
  unpaid: number
  /** Highreel emails sent through the business's account */
  emails: number
  /** paid payments */
  payments: number
  spent: Money
}

/** `blocked`: blocked addresses (`blocked` in AdminUsers), whether or not their account is still there */
export type UserKind = 'accounts' | 'demos' | 'admins' | 'blocked'

export interface AdminUsers {
  kind: UserKind
  counts: Record<UserKind, number>
  /** empty for `blocked` */
  users: AdminUser[]
  /** only for `blocked` */
  blocked: BlockedAddress[]
  /** more than the page holds (the newest are shown) */
  more: boolean
}

export interface AdminHighreel extends Reach {
  id: string
  name: string
  year: number
  template_key: string
  kind: CampaignKind
  status: CampaignStatus
  created_at: string
  published_at: string | null
  business_id: string
  business: string
  owner_id: string
  /** null for a demo */
  owner_email: string | null
  rows: number
  views: number
  /** paid payments for it */
  payments: number
  paid: Money
}

export interface AdminHighreels {
  demos: boolean
  highreels: AdminHighreel[]
  more: boolean
}

export interface AdminPayment {
  id: string
  business_id: string
  business: string
  owner_id: string
  owner_email: string | null
  campaign_id: string | null
  /** null once the campaign is deleted */
  campaign: string | null
  tier: string | null
  amount: number
  currency: string
  status: 'paid' | 'refunded'
  paid_at: string
  refunded_at: string | null
}

export interface AdminOverview {
  accounts: number
  demos: number
  admins: number
  /** blocked addresses */
  blocked: number
  /** accounts made in the last 7 days */
  joined_week: number
  /** accounts with a session used in the last 7 days */
  active_week: number
  /** accounts with at least one Highreel */
  makers: number
  highreels: number
  /** accounts with a published Highreel */
  publishers: number
  published: number
  unpaid: number
  reach: Reach
  payers: number
  payments: number
  refunded: number
  revenue: Money
  newest: AdminUser[]
  latest_published: AdminHighreel[]
  latest_payments: AdminPayment[]
}

/** A Highreel on a user's page: also how many of its customers were emailed or sent a WhatsApp. */
export interface AdminUserHighreel extends AdminHighreel {
  emailed: number
  whatsapp: number
}

export interface AdminUserDetail {
  user: AdminUser
  /** `email_provider`: the connected email account's provider (gmail, outlook, …), or null */
  business: { id: string, name: string, accent_color: string, website_url: string | null, created_at: string, email_provider: string | null } | null
  /** sessions that haven't ended */
  sessions: number
  highreels: AdminUserHighreel[]
  payments: AdminPayment[]
}

/** A blocked address: who blocked it and why, and its account if it still has one. */
export interface BlockedAddress {
  email: string
  reason: string | null
  created_at: string
  /** the address of the admin who blocked it; null once that account is gone */
  blocked_by: string | null
  /** the account with this address, if it wasn't removed */
  user_id: string | null
}
