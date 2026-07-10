-- Task 276: RLS-safe unread/read-state production integration.

grant select, insert, update on public.read_states to authenticated;
alter table public.read_states enable row level security;

drop policy if exists "read_states_select_own_visible_channel" on public.read_states;
create policy "read_states_select_own_visible_channel" on public.read_states
for select to authenticated
using (user_id = auth.uid() and public.can_view_channel(channel_id));

drop policy if exists "read_states_insert_own_visible_channel" on public.read_states;
create policy "read_states_insert_own_visible_channel" on public.read_states
for insert to authenticated
with check (user_id = auth.uid() and public.can_view_channel(channel_id));

drop policy if exists "read_states_update_own_visible_channel" on public.read_states;
create policy "read_states_update_own_visible_channel" on public.read_states
for update to authenticated
using (user_id = auth.uid() and public.can_view_channel(channel_id))
with check (user_id = auth.uid() and public.can_view_channel(channel_id));

create or replace function public.mark_channel_read(target_channel_id uuid, target_last_read_message_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_view_channel(target_channel_id) then
    raise exception 'channel access denied' using errcode = '42501';
  end if;

  if target_last_read_message_id is not null and not exists (
    select 1 from public.messages message
    where message.id = target_last_read_message_id and message.channel_id = target_channel_id
  ) then
    raise exception 'read marker does not belong to channel' using errcode = '23514';
  end if;

  insert into public.read_states (channel_id, user_id, last_read_message_id, updated_at)
  values (target_channel_id, auth.uid(), target_last_read_message_id, now())
  on conflict (channel_id, user_id) do update
  set last_read_message_id = excluded.last_read_message_id, updated_at = excluded.updated_at;
  return true;
end;
$$;

create or replace function public.get_my_community_unread_state(target_community_id uuid)
returns table(channel_id uuid, unread_count bigint, mention_count bigint, last_message_id uuid, last_read_message_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select
    channel.id,
    count(message.id) filter (
      where message.author_id <> auth.uid()
        and (read_message.id is null or (message.created_at, message.id) > (read_message.created_at, read_message.id))
    )::bigint as unread_count,
    count(message.id) filter (
      where message.author_id <> auth.uid()
        and (read_message.id is null or (message.created_at, message.id) > (read_message.created_at, read_message.id))
        and exists (
          select 1 from public.message_mentions mention
          where mention.message_id = message.id and mention.mentioned_user_id = auth.uid()
        )
    )::bigint as mention_count,
    latest_message.id as last_message_id,
    read_state.last_read_message_id
  from public.channels channel
  left join public.read_states read_state on read_state.channel_id = channel.id and read_state.user_id = auth.uid()
  left join public.messages read_message on read_message.id = read_state.last_read_message_id and read_message.channel_id = channel.id
  left join public.messages message on message.channel_id = channel.id and message.deleted_at is null
  left join lateral (
    select candidate.id from public.messages candidate
    where candidate.channel_id = channel.id and candidate.deleted_at is null
    order by candidate.created_at desc, candidate.id desc limit 1
  ) latest_message on true
  where auth.uid() is not null
    and channel.community_id = target_community_id
    and public.can_view_channel(channel.id)
  group by channel.id, read_state.last_read_message_id, read_message.id, read_message.created_at, latest_message.id
  order by channel.position, channel.id;
$$;

revoke all on function public.mark_channel_read(uuid, uuid) from public, anon;
revoke all on function public.get_my_community_unread_state(uuid) from public, anon;
grant execute on function public.mark_channel_read(uuid, uuid) to authenticated;
grant execute on function public.get_my_community_unread_state(uuid) to authenticated;
