-- Task 444: atomic ownership transfer and recoverable community archive.
-- Community data is retained; normal clients cannot read or mutate archived community content.

alter table public.communities
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete restrict,
  add column if not exists archive_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'communities_archive_reason_length') then
    alter table public.communities
      add constraint communities_archive_reason_length
      check (archive_reason is null or char_length(archive_reason) <= 500);
  end if;
end
$$;

create index if not exists communities_active_owner_idx
  on public.communities(owner_id, created_at)
  where archived_at is null;

create or replace function public.is_active_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.communities community
    where community.id = target_community_id and community.archived_at is null
  );
$$;

create or replace function public.is_community_owner(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.communities community
    where community.id = target_community_id
      and community.archived_at is null
      and community.owner_id = auth.uid()
  );
$$;

create or replace function public.is_community_member(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members membership
    join public.communities community on community.id = membership.community_id
    where membership.community_id = target_community_id
      and membership.user_id = auth.uid()
      and community.archived_at is null
  );
$$;

create or replace function public.has_community_role_level(target_community_id uuid, minimum_level integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members membership
    join public.roles role on role.id = membership.role_id
    join public.communities community on community.id = membership.community_id
    where membership.community_id = target_community_id
      and membership.user_id = auth.uid()
      and community.archived_at is null
      and role.level >= minimum_level
  );
$$;

create or replace function public.can_read_public_community(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.communities community
    where community.id = target_community_id
      and community.archived_at is null
      and community.visibility = 'public'
  );
$$;

create or replace function public.can_read_public_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels channel
    join public.communities community on community.id = channel.community_id
    where channel.id = target_channel_id
      and community.archived_at is null
      and community.visibility = 'public'
      and community.public_read_enabled = true
      and channel.is_private = false
      and channel.public_read_enabled = true
  );
$$;

grant execute on function public.is_active_community(uuid) to anon, authenticated;
grant execute on function public.is_community_owner(uuid) to authenticated;
grant execute on function public.is_community_member(uuid) to authenticated;
grant execute on function public.has_community_role_level(uuid, integer) to anon, authenticated;
grant execute on function public.can_read_public_community(uuid) to anon, authenticated;
grant execute on function public.can_read_public_channel(uuid) to anon, authenticated;

drop policy if exists "active communities are visible" on public.communities;
create policy "active communities are visible"
on public.communities as restrictive
for select to anon, authenticated
using (archived_at is null);

drop policy if exists "active community roles guard" on public.roles;
create policy "active community roles guard"
on public.roles as restrictive
for all to authenticated
using (public.is_active_community(community_id))
with check (public.is_active_community(community_id));

drop policy if exists "active community members guard" on public.community_members;
create policy "active community members guard"
on public.community_members as restrictive
for all to authenticated
using (public.is_active_community(community_id))
with check (public.is_active_community(community_id));

drop policy if exists "active community categories guard" on public.channel_categories;
create policy "active community categories guard"
on public.channel_categories as restrictive
for all to authenticated
using (public.is_active_community(community_id))
with check (public.is_active_community(community_id));

drop policy if exists "active community channels guard" on public.channels;
create policy "active community channels guard"
on public.channels as restrictive
for all to anon, authenticated
using (public.is_active_community(community_id))
with check (public.is_active_community(community_id));

drop policy if exists "active community messages guard" on public.messages;
create policy "active community messages guard"
on public.messages as restrictive
for all to anon, authenticated
using (public.is_active_community(community_id))
with check (public.is_active_community(community_id));

drop policy if exists "active community attachments guard" on public.attachments;
create policy "active community attachments guard"
on public.attachments as restrictive
for select to anon, authenticated
using (
  exists (
    select 1 from public.messages message
    where message.id = attachments.message_id
      and public.is_active_community(message.community_id)
  )
);

drop policy if exists "active radio communities guard" on public.radio_sessions;
create policy "active radio communities guard"
on public.radio_sessions as restrictive
for all to authenticated
using (public.is_active_community(community_id))
with check (public.is_active_community(community_id));

drop policy if exists "active podcast communities guard" on public.podcast_episodes;
create policy "active podcast communities guard"
on public.podcast_episodes as restrictive
for all to authenticated
using (public.is_active_community(community_id))
with check (public.is_active_community(community_id));

create or replace function public.transfer_community_ownership(
  target_community_id uuid,
  target_new_owner_id uuid,
  confirmation_community_name text
)
returns table(
  community_id uuid,
  previous_owner_id uuid,
  new_owner_id uuid,
  transferred_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_community public.communities%rowtype;
  target_membership public.community_members%rowtype;
  owner_role_id uuid;
  previous_owner_role_id uuid;
  transfer_time timestamptz := now();
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into target_community
  from public.communities community
  where community.id = target_community_id
  for update;

  if target_community.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if target_community.archived_at is not null then raise exception 'COMMUNITY_ARCHIVED' using errcode = '55000'; end if;
  if target_community.owner_id <> auth.uid() then raise exception 'COMMUNITY_TRANSFER_OWNER_REQUIRED' using errcode = '42501'; end if;
  if btrim(coalesce(confirmation_community_name, '')) <> target_community.name then raise exception 'COMMUNITY_TRANSFER_CONFIRMATION_MISMATCH' using errcode = '22023'; end if;
  if target_new_owner_id = auth.uid() then raise exception 'COMMUNITY_TRANSFER_TARGET_INVALID' using errcode = '22023'; end if;

  select * into target_membership
  from public.community_members membership
  where membership.community_id = target_community_id and membership.user_id = target_new_owner_id
  for update;

  if target_membership.id is null then raise exception 'COMMUNITY_TRANSFER_TARGET_NOT_MEMBER' using errcode = '23503'; end if;

  select role.id into owner_role_id
  from public.roles role
  where role.community_id = target_community_id and lower(role.name) = 'owner' and role.level >= 100
  order by role.level desc
  limit 1;

  select role.id into previous_owner_role_id
  from public.roles role
  where role.community_id = target_community_id and lower(role.name) <> 'owner' and role.level < 100
  order by case when lower(role.name) = 'admin' then 0 when lower(role.name) = 'member' then 2 else 1 end, role.level desc
  limit 1;

  if owner_role_id is null or previous_owner_role_id is null then raise exception 'COMMUNITY_TRANSFER_ROLE_CONFIGURATION_INVALID' using errcode = '23514'; end if;

  update public.community_members
  set role_id = previous_owner_role_id
  where community_members.community_id = target_community_id and community_members.user_id = auth.uid();

  update public.community_members
  set role_id = owner_role_id
  where community_members.id = target_membership.id;

  update public.communities
  set owner_id = target_new_owner_id, updated_at = transfer_time
  where communities.id = target_community_id;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_community_id, auth.uid(), 'community_update', 'ownership_transfer', target_new_owner_id, 'Community ownership transferred atomically');

  return query select target_community_id, auth.uid(), target_new_owner_id, transfer_time;
end;
$$;

create or replace function public.archive_community(
  target_community_id uuid,
  confirmation_community_name text,
  archive_reason text default 'Owner requested safe community archive'
)
returns table(community_id uuid, archived_at timestamptz, archived_by uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_community public.communities%rowtype;
  archive_time timestamptz := now();
  clean_reason text := left(coalesce(nullif(btrim(archive_reason), ''), 'Owner requested safe community archive'), 500);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into target_community
  from public.communities community
  where community.id = target_community_id
  for update;

  if target_community.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if target_community.owner_id <> auth.uid() then raise exception 'COMMUNITY_ARCHIVE_OWNER_REQUIRED' using errcode = '42501'; end if;
  if target_community.archived_at is not null then raise exception 'COMMUNITY_ALREADY_ARCHIVED' using errcode = '55000'; end if;
  if btrim(coalesce(confirmation_community_name, '')) <> target_community.name then raise exception 'COMMUNITY_ARCHIVE_CONFIRMATION_MISMATCH' using errcode = '22023'; end if;

  update public.communities
  set archived_at = archive_time,
      archived_by = auth.uid(),
      archive_reason = clean_reason,
      visibility = 'private',
      public_read_enabled = false,
      discovery_listed = false,
      updated_at = archive_time
  where communities.id = target_community_id;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_community_id, auth.uid(), 'community_update', 'community_archive', target_community_id, clean_reason);

  return query select target_community_id, archive_time, auth.uid();
end;
$$;

revoke all on function public.transfer_community_ownership(uuid, uuid, text) from public, anon;
revoke all on function public.archive_community(uuid, text, text) from public, anon;
grant execute on function public.transfer_community_ownership(uuid, uuid, text) to authenticated;
grant execute on function public.archive_community(uuid, text, text) to authenticated;

comment on function public.transfer_community_ownership(uuid, uuid, text) is
  'Owner-only atomic ownership and role transfer to an existing active member, with append-only audit evidence.';
comment on function public.archive_community(uuid, text, text) is
  'Owner-only recoverable archive. Community rows and audit/security history are retained; normal access is blocked.';
