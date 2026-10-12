-- M2.9: recap emails go through the business's own email account (SMTP), never
-- from Recap's address (SPEC M2.9, the owner's pick on 2026-10-12). One
-- connection per business, used by every recap. The password is encrypted by
-- the server (AES-GCM with a key only the server has), so even the owner's own
-- session only ever sees ciphertext; routes never return it.
--
-- And WhatsApp, one tap per person: when the business opened that person's chat.

create table email_connections (
  business_id uuid primary key references businesses(id) on delete cascade,
  provider text not null,
  host text not null,
  port int not null check (port between 1 and 65535),
  -- implicit TLS (465); otherwise STARTTLS where the server offers it
  secure boolean not null default false,
  username text not null default '',
  password_enc text not null default '',
  from_email text not null,
  from_name text not null,
  reply_to text,
  daily_limit int not null default 2000 check (daily_limit between 1 and 100000),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table email_connections enable row level security;
create policy "owner reads email connection" on email_connections
  for select to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())));
create policy "owner creates email connection" on email_connections
  for insert to authenticated
  with check (business_id in (select id from businesses where owner_id = (select auth.uid())));
create policy "owner updates email connection" on email_connections
  for update to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from businesses where owner_id = (select auth.uid())));
create policy "owner deletes email connection" on email_connections
  for delete to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())));
grant select, insert, update, delete on email_connections to authenticated;

alter table recipients add column whatsapp_at timestamptz;
grant update (whatsapp_at) on recipients to authenticated;
