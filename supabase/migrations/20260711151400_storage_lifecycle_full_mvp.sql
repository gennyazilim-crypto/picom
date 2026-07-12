begin;

-- Public identity assets are deliberately limited to non-confidential profile
-- and community branding. Message, DM, Radio, and Podcast content stays private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('message-attachments','message-attachments',false,10485760,array['image/png','image/jpeg','image/webp','image/gif']),
  ('direct-message-attachments','direct-message-attachments',false,10485760,array['image/png','image/jpeg','image/webp','image/gif']),
  ('audio-covers','audio-covers',false,5242880,array['image/png','image/jpeg','image/webp','image/gif']),
  ('podcast-audio','podcast-audio',false,104857600,array['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm']),
  ('profile-media','profile-media',true,8388608,array['image/png','image/jpeg','image/webp']),
  ('community-branding','community-branding',true,6291456,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Public object delivery uses known URLs. Do not grant bucket-wide listing.
drop policy if exists "profile_media_read_authenticated" on storage.objects;
drop policy if exists "public reads community branding" on storage.objects;

drop policy if exists "profile_media_insert_own" on storage.objects;
create policy "profile_media_insert_own" on storage.objects for insert to authenticated with check(
  bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text
  and name ~ '^[0-9a-f-]{36}/(avatar|cover)/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
);
drop policy if exists "profile_media_update_own" on storage.objects;
create policy "profile_media_update_own" on storage.objects for update to authenticated
using(bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text)
with check(bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text and name ~ '^[0-9a-f-]{36}/(avatar|cover)/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$');
drop policy if exists "profile_media_delete_own" on storage.objects;
create policy "profile_media_delete_own" on storage.objects for delete to authenticated
using(bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "managers upload community branding" on storage.objects;
create policy "managers upload community branding" on storage.objects for insert to authenticated with check(
  bucket_id='community-branding'
  and name ~ '^[0-9a-f-]{36}/(icon|banner)/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
  and public.effective_community_permission(((storage.foldername(name))[1])::uuid,'manageCommunity')
);
drop policy if exists "managers update community branding" on storage.objects;
create policy "managers update community branding" on storage.objects for update to authenticated
using(bucket_id='community-branding' and public.effective_community_permission(((storage.foldername(name))[1])::uuid,'manageCommunity'))
with check(bucket_id='community-branding' and name ~ '^[0-9a-f-]{36}/(icon|banner)/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$' and public.effective_community_permission(((storage.foldername(name))[1])::uuid,'manageCommunity'));
drop policy if exists "managers delete community branding" on storage.objects;
create policy "managers delete community branding" on storage.objects for delete to authenticated
using(bucket_id='community-branding' and public.effective_community_permission(((storage.foldername(name))[1])::uuid,'manageCommunity'));

create or replace function public.list_storage_orphan_candidates(older_than timestamptz default now()-interval '24 hours',result_limit integer default 500)
returns table(bucket_id text,object_name text,created_at timestamptz,reason text)
language sql stable security definer set search_path=public,storage,pg_temp as $$
  select storage_object.bucket_id,storage_object.name,storage_object.created_at,
    case storage_object.bucket_id
      when 'message-attachments' then 'unlinked_text_attachment'
      when 'direct-message-attachments' then 'unlinked_dm_attachment'
      when 'profile-media' then 'unreferenced_profile_media'
      when 'community-branding' then 'unreferenced_community_branding'
      when 'audio-covers' then 'unreferenced_audio_cover'
      when 'podcast-audio' then 'unreferenced_podcast_audio'
    end
  from storage.objects storage_object
  where storage_object.bucket_id in('message-attachments','direct-message-attachments','profile-media','community-branding','audio-covers','podcast-audio')
    and coalesce(storage_object.created_at,storage_object.updated_at)<older_than
    and case storage_object.bucket_id
      when 'message-attachments' then not exists(select 1 from public.attachments attachment where attachment.storage_path=storage_object.name and attachment.message_id is not null and attachment.status='attached')
      when 'direct-message-attachments' then not exists(select 1 from public.direct_message_attachments attachment where attachment.storage_path=storage_object.name)
      when 'profile-media' then not exists(select 1 from public.profiles profile left join public.profile_details details on details.user_id=profile.id where coalesce(profile.avatar_url,'') like '%'||storage_object.name||'%' or coalesce(details.cover_url,'') like '%'||storage_object.name||'%')
      when 'community-branding' then not exists(select 1 from public.communities community where coalesce(community.icon_url,'') like '%'||storage_object.name||'%' or coalesce(community.banner_url,'') like '%'||storage_object.name||'%')
      when 'audio-covers' then not exists(select 1 from public.radio_programs program where program.cover_storage_path=storage_object.name) and not exists(select 1 from public.radio_sessions session where session.cover_storage_path=storage_object.name) and not exists(select 1 from public.podcast_series series where series.cover_storage_path=storage_object.name) and not exists(select 1 from public.podcast_episodes episode where episode.cover_storage_path=storage_object.name)
      when 'podcast-audio' then not exists(select 1 from public.podcast_episodes episode where episode.audio_storage_path=storage_object.name)
      else false
    end
  order by storage_object.created_at,storage_object.id
  limit greatest(1,least(coalesce(result_limit,500),1000));
$$;

revoke all on function public.list_storage_orphan_candidates(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.list_storage_orphan_candidates(timestamptz,integer) to service_role;
comment on function public.list_storage_orphan_candidates(timestamptz,integer) is 'Server-only, read-only orphan inventory. Deletion requires the separately confirmed operator script.';

commit;
