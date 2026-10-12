-- M2.5 P4: the business's own recap (SPEC §8 M2.5 P4). campaigns.kind came
-- with the home migration. This adds the totals its form suggests ("195
-- customers got a recap", "236,000 habits checked off"): per customer
-- campaign of a year, the published row count and the sum of every numeric
-- value, as the signed-in user (security invoker: RLS applies).

create function campaign_sums(p_year int)
returns table (campaign_id uuid, published int, sums jsonb)
language sql
stable
security invoker
set search_path = public
as $$
  with mine as (
    select r.campaign_id, r.data
    from recipients r
    join campaigns c on c.id = r.campaign_id
    where c.year = p_year and c.kind = 'customers'
      and r.token is not null and r.errors = '{}'::jsonb
  ),
  totals as (
    select m.campaign_id, e.key, sum((e.value)::numeric) as total
    from mine m, jsonb_each(m.data) e
    where jsonb_typeof(e.value) = 'number' and e.key <> 'computed_top_percent'
    group by m.campaign_id, e.key
  )
  select c.campaign_id, c.published, coalesce(jsonb_object_agg(t.key, t.total) filter (where t.key is not null), '{}'::jsonb)
  from (select campaign_id, count(*)::int as published from mine group by campaign_id) c
  left join totals t on t.campaign_id = c.campaign_id
  group by c.campaign_id, c.published;
$$;

revoke execute on function campaign_sums(int) from public, anon;
grant execute on function campaign_sums(int) to authenticated;
