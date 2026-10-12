-- M2.11: addresses that bounced, per business. Recap emails go out through the
-- business's own email account (M2.9), and its provider counts every bounce
-- against it: enough of them and the account gets limited. An address whose
-- mail server said it doesn't exist (or whose domain takes no mail) goes here
-- and no recap of this business is sent to it again, this year or next.
-- Like opt-outs, it holds addresses, per business; unlike opt-outs the owner
-- writes it (the send route runs as them). Nobody edits or clears entries: a
-- corrected address in the Sheet is a new address.
create table email_bounces (
  business_id uuid not null references businesses(id) on delete cascade,
  email text not null check (email = lower(email)),
  reason text not null check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (business_id, email)
);
alter table email_bounces enable row level security;
create policy "owner reads bounces" on email_bounces
  for select to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())));
create policy "owner records bounces" on email_bounces
  for insert to authenticated
  with check (business_id in (select id from businesses where owner_id = (select auth.uid())));
grant select, insert on email_bounces to authenticated;
