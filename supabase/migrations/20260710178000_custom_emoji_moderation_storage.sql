alter table public.community_emojis
  add column if not exists storage_path text,
  add column if not exists moderation_status text not null default 'active'
    check (moderation_status in ('active', 'disabled')),
  add column if not exists disabled_at timestamptz;

alter table public.community_emojis
  add constraint community_emojis_storage_path_safe
  check (storage_path is null or storage_path ~ '^communities/[0-9a-f-]{36}/emojis/[0-9a-f-]{36}\.(png|jpg|webp|gif)$') not valid;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-emojis', 'community-emojis', false, 524288, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community_emojis_visible_select" on public.community_emojis;
create policy "community_emojis_visible_select" on public.community_emojis for select to authenticated
using (
  moderation_status = 'active' and deleted_at is null and exists (
    select 1 from public.communities community where community.id = community_id and (
      community.visibility = 'public' or exists (
        select 1 from public.community_members member where member.community_id = community.id and member.user_id = auth.uid()
      )
    )
  )
);

create policy "community_emojis_manager_select" on public.community_emojis for select to authenticated
using (public.can_manage_channel_webhooks(community_id));

revoke insert, update, delete on public.community_emojis from anon;

create policy "community_emoji_storage_read" on storage.objects for select to authenticated
using (
  bucket_id = 'community-emojis'
  and name ~ '^communities/[0-9a-f-]{36}/emojis/[0-9a-f-]{36}\.(png|jpg|webp|gif)$'
  and exists (
    select 1 from public.communities community
    where community.id = ((storage.foldername(name))[2])::uuid
      and (community.visibility = 'public' or exists (
        select 1 from public.community_members member where member.community_id = community.id and member.user_id = auth.uid()
      ))
  )
);

create policy "community_emoji_storage_manager_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-emojis'
  and name ~ '^communities/[0-9a-f-]{36}/emojis/[0-9a-f-]{36}\.(png|jpg|webp|gif)$'
  and public.can_manage_channel_webhooks(((storage.foldername(name))[2])::uuid)
);

create policy "community_emoji_storage_manager_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'community-emojis'
  and name ~ '^communities/[0-9a-f-]{36}/emojis/[0-9a-f-]{36}\.(png|jpg|webp|gif)$'
  and public.can_manage_channel_webhooks(((storage.foldername(name))[2])::uuid)
);

comment on table public.community_emojis is 'Community-scoped custom emoji metadata. Assets are private and served through signed URLs.';
