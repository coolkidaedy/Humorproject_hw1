-- Run in the EXISTING project's SQL editor after reviewing current Storage policies.
-- This script changes Storage only. It does not change profiles, name nullability,
-- the existing handle_new_user trigger, or any public table's RLS setting.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
-- If avatars already exists, verify its public setting, 2 MB limit, and MIME list
-- in the dashboard; this script deliberately preserves existing bucket settings.
-- Uploads use unique filenames; overwrite/UPDATE permission is not needed.
drop policy if exists "assignment3_avatar_insert" on storage.objects;
create policy "assignment3_avatar_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "assignment3_avatar_select" on storage.objects;
create policy "assignment3_avatar_select" on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "assignment3_avatar_delete" on storage.objects;
create policy "assignment3_avatar_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
-- Public bucket URLs allow anyone with the URL to view the photo.
-- SELECT/DELETE allow cleanup of a new upload if the profile save fails.
-- Existing broader Storage policies are OR'ed with these; inspect them separately.
