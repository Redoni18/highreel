-- Roles and payments (SPEC M2.15).

-- Every account is a client. An admin also gets the admin pages (/app/admin),
-- which read every business's account details and counts, never its sheets
-- (server/utils/admin.ts). Better Auth knows the column as a user field the
-- browser can't set (`input: false` in server/utils/auth.ts), and nothing in
-- the app changes it: the owner makes someone an admin by hand,
--   corepack pnpm exec wrangler d1 execute highreel --remote --command "update \"user\" set role = 'admin' where email = 'you@example.com'"
-- and takes it back with role = 'client'. Sessions are checked in D1 on every
-- request, so either takes effect on the next one.
alter table "user" add column "role" text not null default 'client' check ("role" in ('client', 'admin'));

-- Payments (SPEC §10): one row per payment, written by the checkout's webhook
-- (Whop's payment.succeeded; payment.refunded marks it refunded), never from
-- the browser or the return page. Until checkout is built nothing writes
-- here, and the admin pages show no payments.
create table payments (
  id text primary key,
  business_id text not null references businesses(id) on delete cascade,
  -- what was bought; a deleted campaign keeps the payment
  campaign_id text references campaigns(id) on delete set null,
  provider text not null default 'whop' check (provider in ('whop')),
  -- the provider's payment id: a webhook delivered twice is still one row
  provider_id text not null,
  -- the size bought (SPEC §10), e.g. 'founding', '1k', '10k', '50k'
  tier text check (tier is null or length(tier) <= 20),
  -- what the business paid before tax, in the currency's minor units (cents)
  amount integer not null check (amount >= 0),
  currency text not null check (length(currency) = 3 and currency = lower(currency)),
  status text not null check (status in ('paid', 'refunded')),
  paid_at text not null,
  refunded_at text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  check ((status = 'refunded') = (refunded_at is not null)),
  unique (provider, provider_id)
);
create index payments_business on payments (business_id, paid_at);
create index payments_campaign on payments (campaign_id);
