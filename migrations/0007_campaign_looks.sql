-- Looks for the Highreels made before designs (SPEC M2.17). Until now a
-- Highreel was drawn in its business's colour (businesses.accent_color) and
-- its theme (settings.theme); now its look is settings.look = { design,
-- colorway } and businesses have no colour. So each existing campaign keeps
-- what it shows: its theme becomes the design, and its business's colour the
-- colourway when it's one of the ten the designs have (shared/templates/
-- designs.ts; they're the colours the business types gave). A colour typed in
-- by hand matches none and falls back to the design's first colourway
-- (cleanLook). Campaigns that already have a look are left alone.
update campaigns
set settings = json_set(settings, '$.look', json_object(
  'design', case when json_extract(settings, '$.theme') = 'paper' then 'paper' else 'stories' end,
  'colorway', coalesce((
    select case upper(b.accent_color)
      when '#4F46E5' then 'indigo'
      when '#0F766E' then 'teal'
      when '#7C3AED' then 'violet'
      when '#8F66F6' then 'lilac'
      when '#0EA5E9' then 'sky'
      when '#1F6F4A' then 'forest'
      when '#F5C518' then 'sunflower'
      when '#9A3412' then 'rust'
      when '#C8341B' then 'poppy'
      when '#E2457A' then 'pink'
    end
    from businesses b where b.id = campaigns.business_id
  ), case when json_extract(settings, '$.theme') = 'paper' then 'teal' else 'indigo' end)
))
where json_valid(settings) and json_extract(settings, '$.look') is null;
