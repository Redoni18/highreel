-- M2a: accounts and isolation (SPEC §8 M2a). Every business sees only its
-- own data: the workspace talks to Postgres as the signed-in user, and these
-- policies decide what that user can touch. The secret key is only used for
-- token-addressed recap reads and counters.

-- The M1 demo business had no owner; nothing can reach it under RLS.
delete from businesses where owner_id is null;

alter table businesses alter column owner_id set not null;
alter table businesses alter column owner_id set default auth.uid();
alter table businesses drop constraint businesses_owner_id_fkey;
alter table businesses add constraint businesses_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete cascade;
-- One business per user for now (SPEC M2a.4).
create unique index businesses_owner on businesses (owner_id);

-- businesses: the owner only
create policy "owner reads business" on businesses
  for select to authenticated using (owner_id = (select auth.uid()));
create policy "owner creates business" on businesses
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "owner updates business" on businesses
  for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes business" on businesses
  for delete to authenticated using (owner_id = (select auth.uid()));

-- campaigns: belong to a business the user owns
create policy "owner reads campaigns" on campaigns
  for select to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())));
create policy "owner creates campaigns" on campaigns
  for insert to authenticated
  with check (business_id in (select id from businesses where owner_id = (select auth.uid())));
create policy "owner updates campaigns" on campaigns
  for update to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())))
  with check (business_id in (select id from businesses where owner_id = (select auth.uid())));
create policy "owner deletes campaigns" on campaigns
  for delete to authenticated
  using (business_id in (select id from businesses where owner_id = (select auth.uid())));

-- recipients: belong to a campaign of a business the user owns
create policy "owner reads recipients" on recipients
  for select to authenticated
  using (campaign_id in (
    select c.id from campaigns c join businesses b on b.id = c.business_id
    where b.owner_id = (select auth.uid())));
create policy "owner creates recipients" on recipients
  for insert to authenticated
  with check (campaign_id in (
    select c.id from campaigns c join businesses b on b.id = c.business_id
    where b.owner_id = (select auth.uid())));
create policy "owner updates recipients" on recipients
  for update to authenticated
  using (campaign_id in (
    select c.id from campaigns c join businesses b on b.id = c.business_id
    where b.owner_id = (select auth.uid())))
  with check (campaign_id in (
    select c.id from campaigns c join businesses b on b.id = c.business_id
    where b.owner_id = (select auth.uid())));
create policy "owner deletes recipients" on recipients
  for delete to authenticated
  using (campaign_id in (
    select c.id from campaigns c join businesses b on b.id = c.business_id
    where b.owner_id = (select auth.uid())));

-- Signed-in users get table access; the policies above narrow it to their rows.
-- anon still gets nothing: recaps are served by the server by token.
grant select, insert, update, delete on businesses, campaigns to authenticated;
grant select, insert, delete on recipients to authenticated;
-- The view/save/share/click counters are written only by the server (secret
-- key) from recap pages, so owners can't edit them. (A column-level revoke
-- would do nothing next to a table-level grant, hence the column list.)
grant update (row_index, customer_id, first_name, email, raw, data, errors, token, updated_at)
  on recipients to authenticated;

-- Publish writes data/errors/token for many rows at once. PostgREST's upsert
-- would also rewrite id and campaign_id (which owners can't update), so this
-- runs one UPDATE as the calling user: RLS and the column grants still apply.
create function bulk_update_recipients(p_rows jsonb)
returns setof recipients
language sql
security invoker
set search_path = public
as $$
  update recipients r set
    customer_id = x.customer_id,
    data = x.data,
    errors = x.errors,
    token = x.token,
    updated_at = now()
  from jsonb_to_recordset(p_rows) as x(id uuid, customer_id text, data jsonb, errors jsonb, token text)
  where r.id = x.id
  returning r.*;
$$;
revoke execute on function bulk_update_recipients(jsonb) from public, anon;
grant execute on function bulk_update_recipients(jsonb) to authenticated;
