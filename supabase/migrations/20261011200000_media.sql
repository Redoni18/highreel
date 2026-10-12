-- M2c: logo and group photos (SPEC §8 M2c). One private bucket; the first
-- folder of every path is the owning business, and only its owner can read
-- or write there. Recap pages get short-lived signed URLs from the server.

alter table businesses rename column logo_url to logo_path;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "owner reads media" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = (select auth.uid())));

create policy "owner uploads media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = (select auth.uid())));

create policy "owner updates media" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = (select auth.uid())))
  with check (bucket_id = 'media' and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = (select auth.uid())));

create policy "owner deletes media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] in (
    select id::text from public.businesses where owner_id = (select auth.uid())));
