// Shapes that cross the API boundary (server routes ↔ workspace ↔ recap).

import type { CustomColumn, ParsedRow, RawRow, RowErrors, SlideSetting } from '../templates/types'

/** How a logo is drawn on recaps, share images and link previews (Your brand, SPEC M2.6). */
export type LogoShape = 'circle' | 'square'

export interface Business {
  id: string
  name: string
  accent_color: string
  logo_shape: LogoShape
  /** R2 key of the logo: {business_id}/logo/{uuid}.png (M2c, M2.14 P2) */
  logo_path: string | null
  /** Signed URL for showing the logo; filled in by the server */
  logo_url: string | null
  website_url: string | null
}

/** A group photo shown to every recipient of a campaign (SPEC M2c). */
export interface CampaignPhoto {
  id: string
  /** R2 key: {business_id}/{campaign_id}/{uuid}.webp (M2.14 P2) */
  path: string
  caption: string
  width: number
  height: number
  /** Signed URL for showing it; filled in by the server, never stored */
  url?: string
}

export interface CampaignSettings {
  /** "habits checked off": the label after items_created */
  items_label: string
  /** Campaign-wide note, used when a row has no personal_note */
  founder_note: string
  cta_label: string
  cta_url: string
  /** Overrides for the cover and slide copy, by slide key; blank means the template default */
  copy: Record<string, string>
  /** Up to 6 group photos, in slide order */
  photos: CampaignPhoto[]
  /** Put the first photo on the share image (off: it may show other people's children) */
  photo_in_share_image: boolean
  /** When the business confirmed it may share these photos */
  photos_consent_at: string | null
  /** Visual theme (M2h) */
  theme: 'stories' | 'paper'
  /** Recipients pick their number from three before it's revealed (M2.5 P1) */
  guess_first: boolean
  /** The business's own columns on top of the template's (M2.7) */
  columns?: CustomColumn[]
  /** The recap's slide list (M2.7); null or missing: the template's own */
  slides?: SlideSetting[] | null
  /** The email Highreel sends (M2.8); blank parts use the defaults in shared/utils/email.ts */
  email?: { subject: string, body: string }
  /** When the business confirmed these people are its customers and expect its email (M2.8) */
  email_consent_at?: string | null
  /** The WhatsApp message (M2.9): its text and the country code for numbers written without one */
  whatsapp?: { body: string, country: string }
}

export type CampaignStatus = 'draft' | 'published' | 'archived'

/** A recap for each customer (a sheet), or one recap about the business itself (SPEC M2.5 P4). */
export type CampaignKind = 'customers' | 'business'

export interface Campaign {
  id: string
  business_id: string
  name: string
  template_key: string
  kind: CampaignKind
  year: number
  settings: CampaignSettings
  status: CampaignStatus
  published_at: string | null
  /** A sheet upload that didn't finish (it arrives in parts, SPEC M2.14 P1): publishing waits for it. */
  importing?: boolean
  /** The sizes paid for and not refunded (TierKey, shared/utils/pricing.ts; SPEC §10). */
  paid: string[]
}

export interface Workspace {
  business: Business
  campaign: Campaign
}

/** POST /api/campaigns: the new campaign, and its business for the workspace to open with (SPEC §7.7). */
export interface CreatedCampaign extends Campaign {
  business: Business
}

export interface CampaignSummary {
  id: string
  name: string
  year: number
  template_key: string
  kind: CampaignKind
  status: CampaignStatus
  published_at: string | null
  created_at: string
  row_count: number
}

/** GET /api/workspace: the user's business and all its campaigns, newest first. */
export interface WorkspaceIndex {
  business: Business
  campaigns: CampaignSummary[]
  anonymous: boolean
}

/** A campaign on the home, with its counts for the year (SPEC M2.5 P3). */
export interface HomeCampaign extends CampaignSummary {
  need_fixing: number
  /** rows a recipient can open: a link and no errors */
  published: number
  opened: number
  views: number
  saved: number
  shared: number
  clicked: number
  updated_at: string
}

export interface HomeActivity {
  campaign_id: string
  first_name: string | null
  event: 'view' | 'save' | 'share' | 'cta'
  at: string
}

/** GET /api/home?year= */
export interface HomeData {
  business: Business
  anonymous: boolean
  year: number
  /** years that have campaigns, plus the current one, newest first */
  years: number[]
  /** campaigns in any year (0 means a brand-new account) */
  total: number
  campaigns: HomeCampaign[]
  activity: HomeActivity[]
}

export interface Recipient {
  id: string
  row_index: number
  customer_id: string
  raw: RawRow
  data: ParsedRow
  errors: RowErrors
  token: string | null
  view_count: number
  first_viewed_at: string | null
  saved_at: string | null
  shared_at: string | null
  cta_clicked_at: string | null
  /** When Highreel emailed this row its recap (M2.8), and why the last try failed */
  emailed_at?: string | null
  email_error?: string | null
  /** When its WhatsApp chat was opened from Share (M2.9) */
  whatsapp_at?: string | null
}

/**
 * What a recap needs: first name and the values its slides use. Never the
 * email or the id column (SPEC §5).
 */
export interface RecapRecipient {
  first_name: string
  /** Only columns the template's slides and share stats read */
  values: Record<string, string | number | null>
  note: string | null
  /** The template's "since" date, YYYY-MM-DD */
  since: string | null
}

export interface RecapPayload {
  template_key: string
  year: number
  business: Pick<Business, 'name' | 'accent_color' | 'logo_url' | 'website_url'> & { logo_shape?: LogoShape }
  /** Photos carry signed URLs; storage paths never reach recap pages */
  settings: CampaignSettings
  recipient: RecapRecipient
}

export type RecapEventType = 'view' | 'share' | 'save' | 'cta'

export interface PatchRecipientResponse {
  row: Recipient
  /** Other rows whose duplicate errors changed because of this edit */
  others: Recipient[]
}

/** POST /api/campaigns/:id/publish: counts; the browser reloads the rows. */
export interface PublishResponse {
  published: number
  skipped: number
}

/** Whop's checkout this server uses (SPEC §10): 'sandbox' takes test cards. */
export type CheckoutEnvironment = 'sandbox' | 'production'

/** POST /api/campaigns/:id/checkout: a Whop checkout for this campaign's size. */
export interface CheckoutSession {
  /** Whop's checkout configuration, `ch_…`, for the embedded checkout */
  id: string
  /** Whop's own checkout page for the same purchase */
  purchase_url: string
  environment: CheckoutEnvironment
  tier: string
  /** customers it covers */
  max: number
  /** USD cents */
  price: number
  upgrade: boolean
}

/** POST /api/campaigns/:id/checkout/confirm: the payment as Whop has it, and what the campaign is paid for now. */
export interface CheckoutConfirmation {
  /** paid: recorded; pending: Whop is still collecting it; failed: nothing was taken */
  status: 'paid' | 'pending' | 'failed'
  paid: string[]
}

/** GET /api/campaigns/:id/recipients?after=: a page of rows in sheet order, and where the next one starts. */
export interface RecipientPage {
  rows: Recipient[]
  next: number | null
}
