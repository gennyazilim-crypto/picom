-- Production Desktop Notifications: extend the existing recipient-owned inbox.
-- Forward-only. No client can insert trusted notification event rows.
begin;

alter table public.notifications
  add column if not exists notification_type text,
  add column if not exists title_key text,
  add column if not exists body_key text,
  add column if not exists safe_metadata jsonb not null default '{}'::jsonb,
  add column if not exists resource_type text,
  add column if not exists resource_id uuid,
  add column if not exists delivery_attempted_at timestamptz,
  add column if not exists seen_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists dedupe_key text,
  add column if not exists expires_at timestamptz;

alter table public.notifications
  drop constraint if exists notifications_notification_type_check;
alter table public.notifications
  add constraint notifications_notification_type_check check (
    notification_type is null or notification_type in (
      'friend_request_received',
      'friend_request_accepted',
      'dm_received',
      'friend_online',
      'followed_user_live',
      'followed_publisher_live'
    )
  );

create unique index if not exists notifications_recipient_dedupe_key_once_idx
  on public.notifications(recipient_id, dedupe_key)
  where dedupe_key is not null;
create index if not exists notifications_recipient_desktop_unseen_idx
  on public.notifications(recipient_id, created_at desc)
  where notification_type is not null and seen_at is null and deleted_at is null;
create index if not exists notifications_recipient_desktop_undelivered_idx
  on public.notifications(recipient_id, created_at desc)
  where notification_type is not null and delivery_attempted_at is null and deleted_at is null;

revoke insert, delete on public.notifications from authenticated, anon;
grant select, update(read_at, deleted_at, seen_at, dismissed_at) on public.notifications to authenticated;

create or replace function public.desktop_notification_preference_enabled(target_user_id uuid, target_type text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    case target_type
      when 'friend_request_received' then settings.notification_settings ->> 'friendRequests'
      when 'friend_request_accepted' then settings.notification_settings ->> 'friendAcceptances'
      when 'dm_received' then settings.notification_settings ->> 'directMessages'
      when 'friend_online' then settings.notification_settings ->> 'friendOnline'
      when 'followed_user_live' then settings.notification_settings ->> 'followedUsersLive'
      when 'followed_publisher_live' then settings.notification_settings ->> 'followedPublishersLive'
      else 'false'
    end,
    case target_type when 'friend_online' then 'false' else 'true' end
  )::boolean
  from (select target_user_id as user_id) target
  left join public.user_settings settings on settings.user_id = target.user_id;
$$;

create or replace function public.insert_trusted_desktop_notification(
  target_recipient_id uuid,
  target_actor_id uuid,
  target_type text,
  target_resource_type text,
  target_resource_id uuid,
  target_dedupe_key text,
  target_context_kind text,
  target_context_label text,
  target_safe_metadata jsonb default '{}'::jsonb,
  target_deep_link text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_id uuid;
  category_value text;
  actor_name text;
begin
  if target_recipient_id is null
    or target_actor_id is null
    or target_recipient_id = target_actor_id
    or target_type is null
    or target_type not in (
      'friend_request_received','friend_request_accepted','dm_received','friend_online','followed_user_live','followed_publisher_live'
    )
    or target_resource_id is null
    or target_context_kind is null
    or target_context_kind not in ('community', 'dm', 'system')
    or target_dedupe_key is null
    or btrim(target_dedupe_key) = ''
    or not (
      (target_type in ('friend_request_received', 'friend_request_accepted') and target_resource_type = 'friend_request')
      or (target_type = 'dm_received' and target_resource_type = 'direct_message')
      or (target_type = 'friend_online' and target_resource_type = 'profile')
      or (target_type in ('followed_user_live', 'followed_publisher_live') and target_resource_type = 'live_stream')
    ) then
    return null;
  end if;
  if target_actor_id is not null and public.users_are_blocked(target_recipient_id, target_actor_id) then
    return null;
  end if;
  if not public.desktop_notification_preference_enabled(target_recipient_id, target_type) then
    return null;
  end if;
  select left(coalesce(nullif(btrim(profile.display_name), ''), profile.username, 'PICOM'), 160)
    into actor_name from public.profiles profile where profile.id = target_actor_id;
  category_value := case target_type
    when 'dm_received' then 'dm'
    when 'followed_user_live' then 'event'
    when 'followed_publisher_live' then 'event'
    else 'system'
  end;
  insert into public.notifications(
    recipient_id, actor_id, category, title, preview, context_kind, context_label,
    user_id, source_event_id, notification_type, title_key, body_key, safe_metadata,
    resource_type, resource_id, dedupe_key, deep_link
  ) values (
    target_recipient_id, target_actor_id, category_value, coalesce(actor_name, 'PICOM'), '',
    target_context_kind, left(coalesce(target_context_label, 'PICOM'), 160), target_actor_id,
    target_dedupe_key, target_type,
    'desktop.' || target_type || '.title', 'desktop.' || target_type || '.body',
    coalesce(target_safe_metadata, '{}'::jsonb) || jsonb_build_object('actor_display_name', coalesce(actor_name, 'PICOM')),
    target_resource_type, target_resource_id,
    target_dedupe_key, target_deep_link
  )
  on conflict (recipient_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into inserted_id;
  return inserted_id;
end;
$$;

revoke all on function public.desktop_notification_preference_enabled(uuid, text) from public, anon, authenticated;
revoke all on function public.insert_trusted_desktop_notification(uuid, uuid, text, text, uuid, text, text, text, jsonb, text) from public, anon, authenticated;

create or replace function public.bridge_friend_request_desktop_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  desktop_type text := case new.event_type when 'request_sent' then 'friend_request_received' else 'friend_request_accepted' end;
begin
  perform public.insert_trusted_desktop_notification(
    new.recipient_id, new.actor_id, desktop_type, 'friend_request', new.request_id,
    'desktop:' || desktop_type || ':' || new.id::text,
    'system', 'Friends',
    jsonb_build_object('actor_user_id', new.actor_id, 'request_id', new.request_id), null
  );
  return new;
end;
$$;
drop trigger if exists bridge_friend_request_desktop_notification on public.friend_request_notifications;
create trigger bridge_friend_request_desktop_notification
after insert on public.friend_request_notifications
for each row execute function public.bridge_friend_request_desktop_notification();

create or replace function public.create_direct_message_desktop_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient record;
  preview_text text;
begin
  if new.deleted_at is not null then return new; end if;
  preview_text := left(btrim(regexp_replace(new.body, E'[\\u0000-\\u001f\\u007f]', ' ', 'g')), 180);
  for recipient in
    select participant.user_id
    from public.direct_conversation_participants participant
    where participant.conversation_id = new.conversation_id
      and participant.user_id <> new.author_id
      and (participant.muted_until is null or participant.muted_until <= now())
      and participant.blocked_at is null
  loop
    perform public.insert_trusted_desktop_notification(
      recipient.user_id, new.author_id, 'dm_received', 'direct_message', new.id,
      'desktop:dm_received:' || new.id::text || ':' || recipient.user_id::text,
      'dm', 'Direct messages',
      jsonb_build_object(
        'actor_user_id', new.author_id,
        'conversation_id', new.conversation_id,
        'message_preview', preview_text
      ),
      null
    );
  end loop;
  return new;
end;
$$;
drop trigger if exists create_direct_message_desktop_notifications on public.direct_messages;
create trigger create_direct_message_desktop_notifications
after insert on public.direct_messages
for each row execute function public.create_direct_message_desktop_notifications();

create or replace function public.create_friend_online_desktop_notifications()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recipient record;
begin
  if not new.share_presence or new.status not in ('online', 'idle') then return new; end if;
  if tg_op = 'UPDATE' and old.share_presence and old.status in ('online', 'idle') then return new; end if;
  for recipient in
    select case when friendship.user_low_id = new.user_id then friendship.user_high_id else friendship.user_low_id end as user_id
    from public.friendships friendship
    where new.user_id in (friendship.user_low_id, friendship.user_high_id)
  loop
    if exists (
      select 1 from public.notifications notification
      where notification.recipient_id = recipient.user_id
        and notification.actor_id = new.user_id
        and notification.notification_type = 'friend_online'
        and notification.created_at > now() - interval '6 hours'
    ) then continue; end if;
    perform public.insert_trusted_desktop_notification(
      recipient.user_id, new.user_id, 'friend_online', 'profile', new.user_id,
      'desktop:friend_online:' || new.user_id::text || ':' || floor(extract(epoch from now()) / 21600)::text,
      'system', 'Friends', jsonb_build_object('actor_user_id', new.user_id), null
    );
  end loop;
  return new;
end;
$$;
drop trigger if exists create_friend_online_desktop_notifications on public.friend_presence;
create trigger create_friend_online_desktop_notifications
after insert or update of status, share_presence on public.friend_presence
for each row execute function public.create_friend_online_desktop_notifications();

-- Existing trusted live fanout already inserts public.notifications once per recipient/stream.
-- Classify its row before commit so the recipient's INSERT Realtime event is complete.
create or replace function public.classify_live_desktop_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_publisher boolean := false;
  live_type text;
  actor_name text;
begin
  if new.category <> 'event' or new.source_event_id !~ '^live-start:' then return new; end if;
  select exists (
    select 1 from public.publisher_streams stream
    where stream.owner_user_id = new.actor_id
      and stream.live_session_id::text = split_part(new.source_event_id, ':', 2)
      and stream.status = 'live'
  ) into is_publisher;
  live_type := case when is_publisher then 'followed_publisher_live' else 'followed_user_live' end;
  select left(coalesce(nullif(btrim(profile.display_name), ''), profile.username, 'PICOM'), 160)
    into actor_name from public.profiles profile where profile.id = new.actor_id;
  new.notification_type := live_type;
  new.title_key := 'desktop.' || live_type || '.title';
  new.body_key := 'desktop.' || live_type || '.body';
  new.safe_metadata := coalesce(new.safe_metadata, '{}'::jsonb) || jsonb_build_object(
    'actor_user_id', new.actor_id,
    'actor_display_name', coalesce(actor_name, 'PICOM'),
    'live_session_id', split_part(new.source_event_id, ':', 2),
    'stream_title', new.title
  );
  new.resource_type := 'live_stream';
  new.dedupe_key := coalesce(new.dedupe_key, new.source_event_id);
  return new;
end;
$$;
drop trigger if exists classify_live_desktop_notification on public.notifications;
create trigger classify_live_desktop_notification
before insert on public.notifications
for each row execute function public.classify_live_desktop_notification();

create or replace function public.claim_desktop_notification(target_notification_id uuid)
returns table(notification_id uuid, notification_type text, safe_metadata jsonb, created_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  update public.notifications notification
  set delivery_attempted_at = coalesce(notification.delivery_attempted_at, now())
  where notification.id = target_notification_id
    and notification.recipient_id = auth.uid()
    and notification.notification_type is not null
    and notification.delivery_attempted_at is null
    and notification.deleted_at is null
    and notification.dismissed_at is null
    and (notification.expires_at is null or notification.expires_at > now())
  returning notification.id, notification.notification_type, notification.safe_metadata, notification.created_at
  into notification_id, notification_type, safe_metadata, created_at;
  if notification_id is not null then return next; end if;
end;
$$;

create or replace function public.list_recent_desktop_notification_delivery_candidates(limit_count integer default 10)
returns table(notification_id uuid, notification_type text, safe_metadata jsonb, created_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  resolved_limit integer := greatest(1, least(coalesce(limit_count, 10), 10));
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  return query
  select notification.id, notification.notification_type, notification.safe_metadata, notification.created_at
  from public.notifications notification
  where notification.recipient_id = auth.uid()
    and notification.notification_type is not null
    and notification.delivery_attempted_at is null
    and notification.deleted_at is null
    and notification.dismissed_at is null
    and (notification.expires_at is null or notification.expires_at > now())
    and notification.created_at >= now() - interval '2 minutes'
  order by notification.created_at asc
  limit resolved_limit;
end;
$$;

create or replace function public.mark_desktop_notification_seen(target_notification_id uuid)
returns boolean
language sql
security invoker
set search_path = public, pg_temp
as $$
  with updated as (
    update public.notifications
    set seen_at = coalesce(seen_at, now())
    where id = target_notification_id
      and recipient_id = auth.uid()
      and delivery_attempted_at is not null
      and deleted_at is null
    returning 1
  ) select exists(select 1 from updated)
$$;

create or replace function public.dismiss_desktop_notification(target_notification_id uuid)
returns boolean
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.notifications
  set dismissed_at = coalesce(dismissed_at, now())
  where id = target_notification_id and recipient_id = auth.uid() and deleted_at is null
  returning true
$$;

create or replace function public.mark_desktop_notification_read(target_notification_id uuid)
returns boolean
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = target_notification_id and recipient_id = auth.uid() and deleted_at is null
  returning true
$$;

revoke all on function public.claim_desktop_notification(uuid) from public, anon;
revoke all on function public.list_recent_desktop_notification_delivery_candidates(integer) from public, anon;
revoke all on function public.dismiss_desktop_notification(uuid) from public, anon;
revoke all on function public.mark_desktop_notification_read(uuid) from public, anon;
revoke all on function public.mark_desktop_notification_seen(uuid) from public, anon;
grant execute on function public.claim_desktop_notification(uuid), public.list_recent_desktop_notification_delivery_candidates(integer), public.dismiss_desktop_notification(uuid), public.mark_desktop_notification_read(uuid), public.mark_desktop_notification_seen(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

comment on table public.notifications is
  'Recipient-private durable notification metadata. Trusted producers only; no credentials, tokens, HTML, signed URLs, or unbounded DM content.';

notify pgrst, 'reload schema';
commit;
