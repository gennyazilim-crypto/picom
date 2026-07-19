-- Task 471: owner-scoped profile avatar and cover storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', true, 8388608, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "profile_media_read_authenticated" on storage.objects;
create policy "profile_media_read_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'profile-media');
drop policy if exists "profile_media_insert_own" on storage.objects;
create policy "profile_media_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('avatar', 'cover')
  and array_length(storage.foldername(name), 1) = 2
);
drop policy if exists "profile_media_update_own" on storage.objects;
create policy "profile_media_update_own"
on storage.objects for update to authenticated
using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (
  bucket_id = 'profile-media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] in ('avatar', 'cover')
);
drop policy if exists "profile_media_delete_own" on storage.objects;
create policy "profile_media_delete_own"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-media' and (storage.foldername(name))[1] = auth.uid()::text);
alter table public.profiles drop constraint if exists profiles_avatar_url_safe;
alter table public.profiles add constraint profiles_avatar_url_safe check (
  avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url !~* '^(javascript|data):')
);
alter table public.profile_details drop constraint if exists profiles_cover_url_safe;
alter table public.profile_details add constraint profiles_cover_url_safe check (
  cover_url is null or (char_length(cover_url) <= 2048 and cover_url !~* '^(javascript|data):')
);
-- Storage policy ownership prevents COMMENT ON POLICY in hosted Supabase.;
