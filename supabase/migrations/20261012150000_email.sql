-- M2.8: Recap emails each person their recap (SPEC M2.8, the owner's pick on
-- 2026-10-12). Three things to keep: when a row was emailed (the Sheet shows
-- it), who unsubscribed from a business's recaps, and a log of every email
-- sent (the daily limit counts it; owners can read it and add to it, never
-- change it, so clearing emailed_at doesn't reset the limit). The log holds
-- no addresses: deleting a campaign's rows deletes them everywhere.

alter table recipients
  add column emailed_at timestamptz,
  add column email_error text;
grant update (emailed_at, email_error) on recipients to authenticated;

-- Opt-outs, per business: someone who unsubscribes from one business's
-- recaps still gets other businesses'. Addresses are stored lowercased.
create table email_optouts (
  business_id uuid not null references businesses(id) on delete cascade,
  email text not null check (email = lower(email)),
  created_at timestamptz not null default now(),
  primary key (business_id, email)
);
alter table email_optouts enable row level security;
create policy "owner reads opt-outs" on email_optouts
  for select to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())));
grant select on email_optouts to authenticated;
-- Only the unsubscribe route writes here, addressed by a recap token (secret key).
grant select, insert on email_optouts to service_role;

create table email_sends (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete set null,
  recipient_id uuid references recipients(id) on delete set null,
  kind text not null check (kind in ('recap', 'test')),
  ok boolean not null,
  error text,
  provider_id text,
  created_at timestamptz not null default now()
);
create index email_sends_business_time on email_sends (business_id, created_at);
alter table email_sends enable row level security;
create policy "owner reads sends" on email_sends
  for select to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())));
create policy "owner logs sends" on email_sends
  for insert to authenticated
  with check (
    business_id in (select id from businesses where owner_id = (select auth.uid()))
    and (campaign_id is null or campaign_id in (
      select c.id from campaigns c join businesses b on b.id = c.business_id
      where b.owner_id = (select auth.uid()))));
grant select, insert on email_sends to authenticated;
grant select on email_sends to service_role;
