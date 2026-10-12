-- Recap schema, M1 (SPEC §7.4). The server talks to these tables with the
-- service role only; RLS is on with no policies until accounts arrive in M2.

create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id),          -- null for the M1 demo
  name text not null,
  accent_color text not null default '#111111',
  logo_url text,
  website_url text,
  created_at timestamptz not null default now()
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,                                -- "2026 recap"
  template_key text not null default 'app',
  year int not null,
  settings jsonb not null default '{}'::jsonb,       -- items_label, slide copy, founder_note, cta_label, cta_url
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index on campaigns (business_id);

create table recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  row_index int not null,                            -- order in the uploaded sheet
  customer_id text not null,
  first_name text,
  email text,
  raw jsonb not null default '{}'::jsonb,            -- cells exactly as uploaded/edited (what the grid shows)
  data jsonb not null default '{}'::jsonb,           -- parsed, typed values (what the recap uses)
  errors jsonb not null default '{}'::jsonb,         -- { column: message }
  token text unique,                                 -- set at publish
  view_count int not null default 0,
  first_viewed_at timestamptz,
  saved_at timestamptz,
  shared_at timestamptz,
  cta_clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on recipients (campaign_id, row_index);
create index on recipients (campaign_id, customer_id);
-- duplicates are allowed in drafts (so the grid can show them); never among published rows
create unique index recipients_published_customer on recipients (campaign_id, customer_id) where token is not null;

alter table businesses enable row level security;
alter table campaigns  enable row level security;
alter table recipients enable row level security;
-- M1: no policies (server uses the service role). M2: owner policies via businesses.owner_id = auth.uid().

-- Current Supabase doesn't grant new tables to the API roles by default.
-- Only the server's service role gets in; anon/authenticated get nothing until M2.
grant select, insert, update, delete on businesses, campaigns, recipients to service_role;

-- First-party counters for a recap (SPEC §7.5). One atomic update per event,
-- so concurrent views don't lose increments.
create function record_recap_event(p_token text, p_type text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  found_row boolean;
begin
  update recipients set
    view_count      = view_count + (case when p_type = 'view' then 1 else 0 end),
    first_viewed_at = case when p_type = 'view'  then coalesce(first_viewed_at, now()) else first_viewed_at end,
    saved_at        = case when p_type = 'save'  then coalesce(saved_at, now())        else saved_at end,
    shared_at       = case when p_type = 'share' then coalesce(shared_at, now())       else shared_at end,
    cta_clicked_at  = case when p_type = 'cta'   then coalesce(cta_clicked_at, now())  else cta_clicked_at end
  where token = p_token;
  get diagnostics found_row = row_count;
  return found_row;
end;
$$;

revoke execute on function record_recap_event(text, text) from public, anon, authenticated;
grant execute on function record_recap_event(text, text) to service_role;
