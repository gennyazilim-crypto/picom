-- Community role-aware menu and public visitor access foundation.
-- Frontend role checks are UX only; these policies keep read/write boundaries in Postgres.

alter table public.communities
  add column if not exists visibility text not null default 'private',
  add column if not exists public_read_enabled boolean not null default false;
alter table public.channels
  add column if not exists public_read_enabled boolean not null default true;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'communities_visibility_check') then
    alter table public.communities
      add constraint communities_visibility_check check (visibility in ('public', 'private'));
  end if;
end $$;
create index if not exists idx_communities_visibility_public_read
  on public.communities(visibility, public_read_enabled);
create index if not exists idx_channels_public_read
  on public.channels(community_id, is_private, public_read_enabled);
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
    where membership.community_id = target_community_id
      and membership.user_id = auth.uid()
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
    select 1
    from public.communities community
    where community.id = target_community_id
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
      and community.visibility = 'public'
      and community.public_read_enabled = true
      and channel.is_private = false
      and channel.public_read_enabled = true
  );
$$;
grant execute on function public.has_community_role_level(uuid, integer) to anon, authenticated;
grant execute on function public.can_read_public_community(uuid) to anon, authenticated;
grant execute on function public.can_read_public_channel(uuid) to anon, authenticated;
grant select on public.communities to anon, authenticated;
grant select on public.channels to anon, authenticated;
grant select on public.messages to anon, authenticated;
grant select on public.attachments to anon, authenticated;
drop policy if exists "communities_select_owned_or_member" on public.communities;
create policy "communities_select_member_or_public"
on public.communities
for select
to anon, authenticated
using (
  visibility = 'public'
  or owner_id = auth.uid()
  or public.is_community_member(id)
);
drop policy if exists "channels_select_visible_to_member" on public.channels;
create policy "channels_select_visible_to_member_or_public"
on public.channels
for select
to anon, authenticated
using (
  public.can_read_public_channel(id)
  or (
    public.is_community_member(community_id)
    and (
      is_private = false
      or public.is_community_owner(community_id)
      or public.has_community_role_level(community_id, 80)
    )
  )
);
create or replace function public.can_view_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels channel
    where channel.id = target_channel_id
      and (
        public.can_read_public_channel(channel.id)
        or (
          public.is_community_member(channel.community_id)
          and (
            channel.is_private = false
            or public.is_community_owner(channel.community_id)
            or public.has_community_role_level(channel.community_id, 80)
          )
        )
      )
  );
$$;
grant execute on function public.can_view_channel(uuid) to anon, authenticated;
create or replace function public.can_send_message_to_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels channel
    where channel.id = target_channel_id
      and channel.type = 'text'
      and public.is_community_member(channel.community_id)
      and public.can_view_channel(channel.id)
  );
$$;
grant execute on function public.can_send_message_to_channel(uuid) to authenticated;
drop policy if exists "messages_select_visible_channel" on public.messages;
create policy "messages_select_visible_channel_or_public"
on public.messages
for select
to anon, authenticated
using (public.can_view_channel(channel_id));
drop policy if exists "community_members_insert_owner_or_self_owner" on public.community_members;
create policy "community_members_insert_owner_or_public_self_join"
on public.community_members
for insert
to authenticated
with check (
  public.is_community_owner(community_id)
  or (
    user_id = auth.uid()
    and exists (
      select 1
      from public.communities community
      where community.id = community_members.community_id
        and community.visibility = 'public'
    )
    and (
      community_members.role_id is null
      or exists (
        select 1
        from public.roles role
        where role.id = community_members.role_id
          and role.community_id = community_members.community_id
          and role.name = 'Member'
          and role.level <= 10
      )
    )
  )
);
drop policy if exists "community_members_delete_owner" on public.community_members;
create policy "community_members_delete_owner_or_self_leave"
on public.community_members
for delete
to authenticated
using (
  public.is_community_owner(community_id)
  or (
    user_id = auth.uid()
    and not public.is_community_owner(community_id)
  )
);
-- Attachments already follow public.can_view_message(), which calls public.can_view_channel().
-- Private channel attachments remain hidden from visitors because public.can_read_public_channel()
-- requires is_private = false and channel public_read_enabled = true.;
