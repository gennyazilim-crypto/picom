-- DM conversation peers see live friend_presence (not static profiles.status).
begin;

create or replace function public.shares_active_direct_conversation(viewer_id uuid, other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.direct_conversation_participants mine
    join public.direct_conversations conversation
      on conversation.id = mine.conversation_id
      and conversation.type = 'direct'
      and conversation.superseded_by is null
    join public.direct_conversation_participants other
      on other.conversation_id = mine.conversation_id
      and other.user_id = other_user_id
    where mine.user_id = viewer_id
      and viewer_id is not null
      and other_user_id is not null
      and viewer_id <> other_user_id
  );
$$;

revoke all on function public.shares_active_direct_conversation(uuid, uuid) from public;
grant execute on function public.shares_active_direct_conversation(uuid, uuid) to authenticated;

drop policy if exists friend_presence_self_or_friend_read on public.friend_presence;
create policy friend_presence_self_or_friend_read
on public.friend_presence for select to authenticated
using (
  user_id = auth.uid()
  or (
    share_presence
    and (
      exists (
        select 1 from public.friendships friendship
        where friendship.user_low_id = least(auth.uid(), friend_presence.user_id)
          and friendship.user_high_id = greatest(auth.uid(), friend_presence.user_id)
      )
      or public.shares_active_direct_conversation(auth.uid(), friend_presence.user_id)
    )
  )
);

create or replace function public.list_direct_conversation_presence(target_user_ids uuid[])
returns table(user_id uuid, status text, status_text text, last_seen_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select target.user_id,
    case
      when presence.share_presence and presence.last_seen_at > now() - interval '100 seconds' then presence.status
      else 'offline'
    end,
    case
      when not coalesce(presence.share_presence, false)
        or presence.last_seen_at is null
        or presence.last_seen_at <= now() - interval '100 seconds' then 'Offline'
      when presence.status = 'online' then 'Online'
      when presence.status = 'idle' then 'Idle'
      when presence.status = 'dnd' then 'Busy'
      else 'Offline'
    end,
    presence.last_seen_at
  from unnest(coalesce(target_user_ids, array[]::uuid[])) target(user_id)
  left join public.friend_presence presence on presence.user_id = target.user_id
  where auth.uid() is not null
    and public.shares_active_direct_conversation(auth.uid(), target.user_id);
$$;

revoke all on function public.list_direct_conversation_presence(uuid[]) from public;
grant execute on function public.list_direct_conversation_presence(uuid[]) to authenticated;

create or replace function public.list_direct_conversations(result_limit integer default 50)
returns table(
  id uuid,
  participant_user_id uuid,
  participant_name text,
  participant_username text,
  participant_status text,
  participant_status_text text,
  last_message_preview text,
  updated_at timestamptz,
  unread_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    conversation.id,
    other.user_id,
    profile.display_name,
    profile.username,
    case
      when presence.share_presence and presence.last_seen_at > now() - interval '100 seconds' then presence.status
      else 'offline'
    end,
    case
      when not coalesce(presence.share_presence, false)
        or presence.last_seen_at is null
        or presence.last_seen_at <= now() - interval '100 seconds' then 'Offline'
      when presence.status = 'online' then 'Online'
      when presence.status = 'idle' then 'Idle'
      when presence.status = 'dnd' then 'Busy'
      else 'Offline'
    end,
    left(coalesce(last_message.body, ''), 160),
    greatest(conversation.updated_at, coalesce(conversation.last_message_at, conversation.updated_at)),
    (
      select count(*)::integer
      from public.direct_messages unread
      where unread.conversation_id = conversation.id
        and unread.author_id <> auth.uid()
        and unread.deleted_at is null
        and unread.created_at > coalesce(mine.last_read_at, 'epoch'::timestamptz)
    )
  from public.direct_conversation_participants mine
  join public.direct_conversations conversation
    on conversation.id = mine.conversation_id
    and conversation.type = 'direct'
    and conversation.superseded_by is null
    and conversation.participant_low_id is not null
  join public.direct_conversation_participants other
    on other.conversation_id = conversation.id
    and other.user_id <> auth.uid()
  join public.profiles profile on profile.id = other.user_id
  left join public.friend_presence presence on presence.user_id = other.user_id
  left join lateral (
    select message.body
    from public.direct_messages message
    where message.conversation_id = conversation.id
      and message.deleted_at is null
    order by message.created_at desc, id desc
    limit 1
  ) last_message on true
  where mine.user_id = auth.uid()
    and mine.archived_at is null
    and public.is_direct_conversation_participant(conversation.id)
    and (select count(*) from public.direct_conversation_participants participant where participant.conversation_id = conversation.id) = 2
  order by coalesce(conversation.last_message_at, conversation.updated_at) desc
  limit greatest(1, least(coalesce(result_limit, 50), 50));
$$;

comment on function public.shares_active_direct_conversation(uuid, uuid) is
  'True when viewer and other share a non-superseded 1:1 direct conversation.';
comment on function public.list_direct_conversation_presence(uuid[]) is
  'Live presence for active DM peers only; custom profile status text is never exposed.';
comment on function public.list_direct_conversations(integer) is
  'DM inbox rows with live presence from friend_presence heartbeats.';

commit;
