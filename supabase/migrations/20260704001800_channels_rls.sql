-- RLS policies for public.channels
-- Community members can read non-private channels; community owners manage channels.

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
      and public.is_community_member(channel.community_id)
      and (
        channel.is_private = false
        or public.is_community_owner(channel.community_id)
      )
  );
$$;
grant execute on function public.can_view_channel(uuid) to authenticated;
grant select, insert, update, delete on public.channels to authenticated;
alter table public.channels enable row level security;
drop policy if exists "channels_select_visible_to_member" on public.channels;
create policy "channels_select_visible_to_member"
on public.channels
for select
to authenticated
using (
  public.is_community_member(community_id)
  and (
    is_private = false
    or public.is_community_owner(community_id)
  )
);
drop policy if exists "channels_insert_owner" on public.channels;
create policy "channels_insert_owner"
on public.channels
for insert
to authenticated
with check (public.is_community_owner(community_id));
drop policy if exists "channels_update_owner" on public.channels;
create policy "channels_update_owner"
on public.channels
for update
to authenticated
using (public.is_community_owner(community_id))
with check (public.is_community_owner(community_id));
drop policy if exists "channels_delete_owner" on public.channels;
create policy "channels_delete_owner"
on public.channels
for delete
to authenticated
using (public.is_community_owner(community_id));
