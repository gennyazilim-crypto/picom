create table if not exists public.community_sticker_packs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9_]{2,32}$'),
  description text not null default '' check (char_length(description) <= 240),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  moderation_status text not null default 'active' check (moderation_status in ('active','disabled')),
  deleted_at timestamptz,
  unique (community_id, name)
);

alter table public.community_stickers
  add column if not exists pack_id uuid references public.community_sticker_packs(id) on delete restrict,
  add column if not exists title text not null default 'Sticker' check (char_length(title) between 1 and 80),
  add column if not exists storage_path text,
  add column if not exists moderation_status text not null default 'active' check (moderation_status in ('active','disabled')),
  add column if not exists disabled_at timestamptz;

alter table public.community_sticker_packs enable row level security;
grant select, insert, update on public.community_sticker_packs to authenticated;

create policy "sticker_packs_visible_select" on public.community_sticker_packs for select to authenticated
using (deleted_at is null and moderation_status = 'active' and exists (select 1 from public.communities community where community.id = community_id and (community.visibility = 'public' or exists (select 1 from public.community_members member where member.community_id = community.id and member.user_id = auth.uid()))));
create policy "sticker_packs_manager_select" on public.community_sticker_packs for select to authenticated using (public.can_manage_channel_webhooks(community_id));
create policy "sticker_packs_manager_insert" on public.community_sticker_packs for insert to authenticated with check (created_by = auth.uid() and public.can_manage_channel_webhooks(community_id));
create policy "sticker_packs_manager_update" on public.community_sticker_packs for update to authenticated using (public.can_manage_channel_webhooks(community_id)) with check (public.can_manage_channel_webhooks(community_id));

drop policy if exists "community_stickers_visible_select" on public.community_stickers;
create policy "community_stickers_visible_select" on public.community_stickers for select to authenticated
using (deleted_at is null and moderation_status = 'active' and exists (select 1 from public.community_sticker_packs pack where pack.id = pack_id and pack.community_id = community_id and pack.deleted_at is null and pack.moderation_status = 'active'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-stickers', 'community-stickers', false, 2097152, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "community_sticker_storage_read" on storage.objects for select to authenticated
using (bucket_id = 'community-stickers' and name ~ '^communities/[0-9a-f-]{36}/sticker-packs/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|gif)$' and exists (select 1 from public.communities community where community.id = ((storage.foldername(name))[2])::uuid and (community.visibility = 'public' or exists (select 1 from public.community_members member where member.community_id = community.id and member.user_id = auth.uid()))));
create policy "community_sticker_storage_manager_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'community-stickers' and name ~ '^communities/[0-9a-f-]{36}/sticker-packs/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|gif)$' and public.can_manage_channel_webhooks(((storage.foldername(name))[2])::uuid));
create policy "community_sticker_storage_manager_delete" on storage.objects for delete to authenticated
using (bucket_id = 'community-stickers' and name ~ '^communities/[0-9a-f-]{36}/sticker-packs/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|gif)$' and public.can_manage_channel_webhooks(((storage.foldername(name))[2])::uuid));

comment on table public.community_sticker_packs is 'Community-owned sticker packs. Marketplace publication is intentionally unsupported.';
