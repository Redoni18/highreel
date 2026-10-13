-- Highreel's database on D1 (SPEC M2.14 P1). Apply with
--   corepack pnpm db:migrate        (local, .wrangler/state/v3)
--   wrangler d1 migrations apply highreel --remote   (P7)
--
-- How it's laid out:
-- - D1 has no row-level security. Every workspace query filters by the
--   signed-in user's business in the data layer (server/utils/db.ts); token
--   routes look rows up by token only (recap.ts, unsubscribe.ts).
--   `check:isolation` and tests/isolation.test.ts hold that line.
-- - ids are text (crypto.randomUUID() in code); times are ISO 8601 text in one
--   format (new Date().toISOString(), or the same from strftime below) so they
--   sort and compare as text; JSON is text checked with json_valid; booleans
--   are 0/1.
-- - No SQL functions or triggers: recording a view, bulk updates, a campaign's
--   counts, recent activity and sums are queries in the data layer, which
--   also sets campaigns.updated_at.

create table businesses (
  id text primary key,
  -- One business per user. 0002_auth.sql makes it `references user(id)`
  -- once Better Auth's tables exist.
  owner_id text not null unique,
  name text not null,
  accent_color text not null default '#111111',
  logo_path text,
  logo_shape text not null default 'circle' check (logo_shape in ('circle', 'square')),
  website_url text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

create table campaigns (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  name text not null,
  template_key text not null default 'app',
  -- a recap per customer (a sheet), or one about the business (SPEC M2.5 P4)
  kind text not null default 'customers' check (kind in ('customers', 'business')),
  year integer not null,
  settings text not null default '{}' check (json_valid(settings)),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- A sheet arrives in parts of 5,000 rows (P1): the next part expected while
  -- an upload is unfinished, else null. Publish waits for a complete sheet.
  import_next integer,
  published_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index campaigns_business on campaigns (business_id, year);

create table recipients (
  id text primary key,
  campaign_id text not null references campaigns(id) on delete cascade,
  row_index integer not null,                          -- order in the uploaded sheet
  customer_id text not null,                           -- the id column's value
  first_name text,
  email text,
  raw text not null default '{}' check (json_valid(raw)),       -- cells as uploaded/edited (the grid)
  data text not null default '{}' check (json_valid(data)),     -- parsed values (the recap)
  errors text not null default '{}' check (json_valid(errors)), -- { column: message }
  -- Written with errors by the data layer. A plain column, not a generated one:
  -- SQLite never treats an index holding a generated column as covering, and
  -- the home must read recipients_home alone. The check keeps the two in step.
  has_errors integer not null default 0 check (has_errors = (errors <> '{}')),
  token text unique,                                   -- set at publish
  view_count integer not null default 0,
  first_viewed_at text,
  saved_at text,
  shared_at text,
  cta_clicked_at text,
  emailed_at text,                                     -- M2.8
  email_error text,
  whatsapp_at text,                                    -- M2.9
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create unique index recipients_order on recipients (campaign_id, row_index);
create index recipients_customer on recipients (campaign_id, customer_id);
-- duplicates are allowed in drafts (so the grid can show them); never among published rows
create unique index recipients_published_customer on recipients (campaign_id, customer_id) where token is not null;
-- The home's counts and activity read only this index, never the wide JSON
-- columns (D1 runs one query at a time per database): `explain query plan`
-- says USING COVERING INDEX recipients_home.
create index recipients_home on recipients (campaign_id, has_errors, token, view_count, first_viewed_at, saved_at, shared_at, cta_clicked_at, updated_at, first_name);

-- Opt-outs, per business: someone who unsubscribes from one business's
-- Highreels still gets other businesses'. Addresses are stored lowercased.
-- Only the unsubscribe routes write here.
create table email_optouts (
  business_id text not null references businesses(id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (business_id, email)
);

-- Every email sent, for the account's daily limit. Holds no addresses. The
-- workspace adds to it and never changes or clears it.
create table email_sends (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  campaign_id text references campaigns(id) on delete set null,
  recipient_id text references recipients(id) on delete set null,
  kind text not null check (kind in ('recap', 'test')),
  ok integer not null check (ok in (0, 1)),
  error text,
  provider_id text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
create index email_sends_business_time on email_sends (business_id, created_at);
-- Deleting a campaign or re-importing its sheet nulls these; without the
-- indexes each deleted row would scan the log.
create index email_sends_campaign on email_sends (campaign_id);
create index email_sends_recipient on email_sends (recipient_id);

-- The business's own email account for Highreel emails (M2.9). The password
-- is encrypted by the server (server/utils/secrets.ts) and never returned.
create table email_connections (
  business_id text primary key references businesses(id) on delete cascade,
  provider text not null,
  host text not null,
  port integer not null check (port between 1 and 65535),
  -- implicit TLS (465); otherwise STARTTLS where the server offers it
  secure integer not null default 0 check (secure in (0, 1)),
  username text not null default '',
  password_enc text not null default '',
  from_email text not null,
  from_name text not null,
  reply_to text,
  daily_limit integer not null default 2000 check (daily_limit between 1 and 100000),
  verified_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Addresses that bounced, per business (M2.11): never emailed by this
-- business again. Nobody edits or clears entries.
create table email_bounces (
  business_id text not null references businesses(id) on delete cascade,
  email text not null check (email = lower(email)),
  reason text not null check (length(reason) <= 200),
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  primary key (business_id, email)
);
