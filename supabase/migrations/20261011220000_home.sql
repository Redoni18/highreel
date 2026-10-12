-- M2.5 P3: the business home (SPEC §8 M2.5 P3). Per-campaign counts for a
-- year and the latest recap activity, both computed as the signed-in user
-- (security invoker), so RLS limits them to the user's own business.
-- Also campaigns.kind (P4: a recap per customer, or one about the business)
-- and campaigns.updated_at for the home's "updated" column.

alter table campaigns add column kind text not null default 'customers'
  check (kind in ('customers', 'business'));

alter table campaigns add column updated_at timestamptz not null default now();
update campaigns set updated_at = coalesce(published_at, created_at);

create function touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger campaigns_touch before update on campaigns
  for each row execute function touch_updated_at();

-- One row per campaign of the year. "Published" counts rows a recipient can
-- open (a link and no errors); the engagement counts are among those.
create function campaign_stats(p_year int)
returns table (
  campaign_id uuid,
  row_count int,
  need_fixing int,
  published int,
  opened int,
  views int,
  saved int,
  shared int,
  clicked int,
  last_change timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    count(r.id)::int,
    count(r.id) filter (where r.errors <> '{}'::jsonb)::int,
    count(r.id) filter (where r.token is not null and r.errors = '{}'::jsonb)::int,
    count(r.id) filter (where r.token is not null and r.errors = '{}'::jsonb and r.view_count > 0)::int,
    coalesce(sum(r.view_count) filter (where r.token is not null and r.errors = '{}'::jsonb), 0)::int,
    count(r.id) filter (where r.token is not null and r.errors = '{}'::jsonb and r.saved_at is not null)::int,
    count(r.id) filter (where r.token is not null and r.errors = '{}'::jsonb and r.shared_at is not null)::int,
    count(r.id) filter (where r.token is not null and r.errors = '{}'::jsonb and r.cta_clicked_at is not null)::int,
    greatest(c.updated_at, max(r.updated_at))
  from campaigns c
  left join recipients r on r.campaign_id = c.id
  where c.year = p_year
  group by c.id;
$$;

-- The latest first views, saves, shares and button taps of a year's recaps.
create function recent_activity(p_year int, p_limit int default 20)
returns table (campaign_id uuid, first_name text, event text, at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  with mine as (
    select r.campaign_id, r.first_name, r.first_viewed_at, r.saved_at, r.shared_at, r.cta_clicked_at
    from recipients r
    join campaigns c on c.id = r.campaign_id
    where c.year = p_year and r.token is not null
  )
  select * from (
    select campaign_id, first_name, 'view', first_viewed_at from mine where first_viewed_at is not null
    union all
    select campaign_id, first_name, 'save', saved_at from mine where saved_at is not null
    union all
    select campaign_id, first_name, 'share', shared_at from mine where shared_at is not null
    union all
    select campaign_id, first_name, 'cta', cta_clicked_at from mine where cta_clicked_at is not null
  ) e
  order by 4 desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function campaign_stats(int), recent_activity(int, int) from public, anon;
grant execute on function campaign_stats(int), recent_activity(int, int) to authenticated;
revoke execute on function touch_updated_at() from public, anon, authenticated;
