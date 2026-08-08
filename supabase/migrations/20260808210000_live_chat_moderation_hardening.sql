-- Live Chat RPCs, authorization helpers, RLS policies, realtime (TASK28).
-- Depends on 20260808200000_live_chat_core.

begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.live_chat_append_audit(
  target_stream_id uuid,
  target_actor uuid,
  target_event_type text,
  target_target_user uuid default null,
  target_message_id uuid default null,
  target_reason text default null,
  target_correlation_id text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_id uuid;
  safe_meta jsonb := coalesce(target_metadata, '{}'::jsonb);
begin
  if jsonb_typeof(safe_meta) is distinct from 'object' then
    safe_meta := '{}'::jsonb;
  end if;
  safe_meta := safe_meta - 'body' - 'plaintext' - 'secret' - 'token' - 'email' - 'phone';

  insert into public.live_chat_audit_events (
    stream_id, actor_user_id, target_user_id, message_id, event_type, reason, correlation_id, metadata
  ) values (
    target_stream_id, target_actor, target_target_user, target_message_id, target_event_type,
    left(coalesce(target_reason, ''), 500), target_correlation_id, safe_meta
  )
  returning id into event_id;
  return event_id;
end;
$$;

revoke all on function public.live_chat_append_audit(uuid, uuid, text, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.live_chat_append_audit(uuid, uuid, text, uuid, uuid, text, text, jsonb)
  to service_role;

create or replace function public.live_chat_is_stream_owner(target_stream_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.publisher_streams s
    where s.id = target_stream_id
      and s.owner_user_id = auth.uid()
  );
$$;

create or replace function public.live_chat_is_active_moderator(target_stream_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.live_chat_is_stream_owner(target_stream_id)
    or exists (
      select 1 from public.live_chat_moderators m
      where m.stream_id = target_stream_id
        and m.user_id = auth.uid()
        and m.revoked_at is null
    );
$$;

create or replace function public.live_chat_can_platform_moderate()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.is_root_owner()
    or public.has_platform_permission('publisher.moderate_live'),
    false
  );
$$;

create or replace function public.live_chat_can_moderate(target_stream_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.live_chat_is_active_moderator(target_stream_id)
    or public.live_chat_can_platform_moderate();
$$;

create or replace function public.live_chat_stream_chat_eligible(target_stream_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.publisher_streams s
    where s.id = target_stream_id
      and s.status in ('ready', 'connecting', 'live', 'reconnecting', 'ending', 'ended')
  );
$$;

create or replace function public.live_chat_stream_send_eligible(target_stream_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.publisher_streams s
    where s.id = target_stream_id
      and s.status in ('connecting', 'live', 'reconnecting')
  );
$$;

create or replace function public.live_chat_is_banned(target_stream_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.live_chat_bans b
    where b.stream_id = target_stream_id
      and b.banned_user_id = target_user_id
      and b.revoked_at is null
  );
$$;

create or replace function public.live_chat_active_timeout_expires(target_stream_id uuid, target_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select max(t.expires_at)
  from public.live_chat_timeouts t
  where t.stream_id = target_stream_id
    and t.user_id = target_user_id
    and t.expires_at > now();
$$;

create or replace function public.live_chat_user_is_verified(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.verification_badges vb
    where vb.subject_type = 'user'
      and vb.subject_id = target_user_id
      and vb.status = 'active'
      and vb.badge_kind in ('verified_user', 'verified', 'profile_reviewed', 'picom_staff')
  );
$$;

create or replace function public.live_chat_user_follows_owner(target_stream_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.publisher_streams s
    join public.user_follows f
      on f.follower_id = target_user_id
     and f.followed_id = s.owner_user_id
    where s.id = target_stream_id
  );
$$;

create or replace function public.live_chat_normalize_body(raw_body text)
returns text
language sql
immutable
as $$
  select left(
    btrim(regexp_replace(regexp_replace(coalesce(raw_body, ''), E'[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', '', 'g'), E'\\s+', ' ', 'g')),
    1000
  );
$$;

create or replace function public.live_chat_body_fingerprint(normalized_body text)
returns text
language sql
immutable
as $$
  select encode(extensions.digest(lower(normalized_body), 'sha256'), 'hex');
$$;

create or replace function public.live_chat_contains_url(normalized_body text)
returns boolean
language sql
immutable
as $$
  select normalized_body ~* '(https?://|www\\.|[a-z0-9-]+\\.(com|net|org|gg|io|co|me|tv|xyz|app)(/|\\s|$))'
    or normalized_body ~* 'javascript:\\s*'
    or normalized_body ~* 'data:\\s*text/html';
$$;

create or replace function public.live_chat_consume_rate_limit(
  target_user_id uuid,
  target_stream_id uuid,
  target_action text,
  max_attempts integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / window_seconds) * window_seconds);
  current_attempts integer;
begin
  insert into public.live_chat_rate_limits (user_id, stream_id, action, window_started_at, attempts)
  values (target_user_id, target_stream_id, target_action, window_start, 1)
  on conflict (user_id, stream_id, action, window_started_at)
  do update set attempts = public.live_chat_rate_limits.attempts + 1
  returning attempts into current_attempts;

  delete from public.live_chat_rate_limits
  where window_started_at < now() - make_interval(secs => greatest(window_seconds * 4, 3600));

  return current_attempts <= max_attempts;
end;
$$;

revoke all on function public.live_chat_consume_rate_limit(uuid, uuid, text, integer, integer)
  from public, anon;
grant execute on function public.live_chat_consume_rate_limit(uuid, uuid, text, integer, integer)
  to authenticated, service_role;

create or replace function public.ensure_live_chat_settings(target_stream_id uuid)
returns public.live_chat_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  settings_row public.live_chat_settings%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row from public.publisher_streams where id = target_stream_id;
  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if stream_row.owner_user_id <> actor_id
     and not public.live_chat_can_platform_moderate() then
    raise exception 'LIVE_CHAT_SETTINGS_FORBIDDEN' using errcode = '42501';
  end if;

  insert into public.live_chat_settings (stream_id, owner_user_id, live_session_id)
  values (stream_row.id, stream_row.owner_user_id, stream_row.live_session_id)
  on conflict (stream_id) do update
    set live_session_id = coalesce(excluded.live_session_id, public.live_chat_settings.live_session_id),
        updated_at = now()
  returning * into settings_row;

  return settings_row;
end;
$$;

revoke all on function public.ensure_live_chat_settings(uuid) from public, anon;
grant execute on function public.ensure_live_chat_settings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Send / list / viewer state
-- ---------------------------------------------------------------------------
create or replace function public.send_live_chat_message(
  target_stream_id uuid,
  message_body text,
  target_reply_to_message_id uuid default null,
  target_idempotency_key text default null
)
returns public.live_chat_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  settings_row public.live_chat_settings%rowtype;
  normalized text;
  fingerprint text;
  idem text := nullif(btrim(coalesce(target_idempotency_key, '')), '');
  timeout_until timestamptz;
  recent_dup integer;
  result_row public.live_chat_messages%rowtype;
  is_privileged boolean;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_profile_is_active_account(actor_id) then
    raise exception 'LIVE_CHAT_ACCOUNT_RESTRICTED' using errcode = '42501';
  end if;

  select * into stream_row from public.publisher_streams where id = target_stream_id for share;
  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.live_chat_stream_send_eligible(target_stream_id) then
    raise exception 'LIVE_CHAT_STREAM_NOT_LIVE' using errcode = '55000';
  end if;

  insert into public.live_chat_settings (stream_id, owner_user_id, live_session_id)
  values (stream_row.id, stream_row.owner_user_id, stream_row.live_session_id)
  on conflict (stream_id) do nothing;

  select * into settings_row from public.live_chat_settings where stream_id = target_stream_id for share;

  if not settings_row.chat_enabled or settings_row.emergency_locked then
    raise exception 'LIVE_CHAT_DISABLED' using errcode = '55000';
  end if;

  is_privileged := public.live_chat_can_moderate(target_stream_id);

  if public.live_chat_is_banned(target_stream_id, actor_id) then
    raise exception 'LIVE_CHAT_BANNED' using errcode = '42501';
  end if;

  timeout_until := public.live_chat_active_timeout_expires(target_stream_id, actor_id);
  if timeout_until is not null then
    raise exception 'LIVE_CHAT_TIMED_OUT' using errcode = '42501',
      hint = timeout_until::text;
  end if;

  if settings_row.followers_only
     and not is_privileged
     and actor_id <> stream_row.owner_user_id
     and not public.live_chat_user_follows_owner(target_stream_id, actor_id) then
    raise exception 'LIVE_CHAT_FOLLOWERS_ONLY' using errcode = '42501';
  end if;

  if settings_row.verified_only
     and not is_privileged
     and actor_id <> stream_row.owner_user_id
     and not public.live_chat_user_is_verified(actor_id) then
    raise exception 'LIVE_CHAT_VERIFIED_ONLY' using errcode = '42501';
  end if;

  normalized := public.live_chat_normalize_body(message_body);
  if char_length(normalized) < 1 then
    raise exception 'LIVE_CHAT_EMPTY' using errcode = '22023';
  end if;
  if char_length(normalized) > settings_row.max_message_length then
    raise exception 'LIVE_CHAT_MESSAGE_TOO_LONG' using errcode = '22023';
  end if;
  if not settings_row.links_allowed and public.live_chat_contains_url(normalized) then
    raise exception 'LIVE_CHAT_LINKS_NOT_ALLOWED' using errcode = '22023';
  end if;
  if normalized ~* 'javascript:\\s*' or normalized ~* 'data:\\s*text/html' then
    raise exception 'LIVE_CHAT_UNSAFE_URL' using errcode = '22023';
  end if;

  -- Anti-spam: long repeated character runs / emoji floods
  if normalized ~ '(.)\\1{19,}' then
    raise exception 'LIVE_CHAT_SPAM_REJECTED' using errcode = '22023';
  end if;

  fingerprint := public.live_chat_body_fingerprint(normalized);

  if idem is not null then
    if char_length(idem) > 120 then
      raise exception 'LIVE_CHAT_IDEMPOTENCY_INVALID' using errcode = '22023';
    end if;
    select * into result_row
    from public.live_chat_messages
    where stream_id = target_stream_id
      and sender_user_id = actor_id
      and client_idempotency_key = idem;
    if found then
      return result_row;
    end if;
  end if;

  if target_reply_to_message_id is not null
     and not exists (
       select 1 from public.live_chat_messages r
       where r.id = target_reply_to_message_id
         and r.stream_id = target_stream_id
         and r.moderation_state = 'visible'
     ) then
    raise exception 'LIVE_CHAT_REPLY_INVALID' using errcode = '22023';
  end if;

  if not is_privileged then
    if not public.live_chat_consume_rate_limit(actor_id, target_stream_id, 'burst', 5, 10) then
      raise exception 'LIVE_CHAT_RATE_LIMITED' using errcode = '54000', hint = '10';
    end if;
    if not public.live_chat_consume_rate_limit(actor_id, target_stream_id, 'sustained', 30, 60) then
      raise exception 'LIVE_CHAT_RATE_LIMITED' using errcode = '54000', hint = '60';
    end if;

    if settings_row.slow_mode_seconds > 0 then
      if exists (
        select 1 from public.live_chat_messages m
        where m.stream_id = target_stream_id
          and m.sender_user_id = actor_id
          and m.created_at > now() - make_interval(secs => settings_row.slow_mode_seconds)
          and m.moderation_state = 'visible'
        for update
      ) then
        raise exception 'LIVE_CHAT_SLOW_MODE' using errcode = '54000',
          hint = settings_row.slow_mode_seconds::text;
      end if;
    end if;

    select count(*) into recent_dup
    from public.live_chat_messages m
    where m.stream_id = target_stream_id
      and m.sender_user_id = actor_id
      and m.body_fingerprint = fingerprint
      and m.created_at > now() - interval '60 seconds';
    if recent_dup >= 2 then
      raise exception 'LIVE_CHAT_DUPLICATE_SPAM' using errcode = '22023';
    end if;
  end if;

  insert into public.live_chat_messages (
    stream_id, live_session_id, sender_user_id, message_type, body,
    reply_to_message_id, client_idempotency_key, body_fingerprint
  ) values (
    target_stream_id, stream_row.live_session_id, actor_id, 'text', normalized,
    target_reply_to_message_id, idem, fingerprint
  )
  returning * into result_row;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'MESSAGE_SENT', null, result_row.id, null, null,
    jsonb_build_object('message_type', 'text')
  );

  return result_row;
end;
$$;

revoke all on function public.send_live_chat_message(uuid, text, uuid, text) from public, anon;
grant execute on function public.send_live_chat_message(uuid, text, uuid, text) to authenticated;

create or replace function public.list_live_chat_messages(
  target_stream_id uuid,
  target_limit integer default 50,
  before_created_at timestamptz default null,
  before_id uuid default null
)
returns setof public.live_chat_messages
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  lim integer := greatest(1, least(coalesce(target_limit, 50), 100));
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_stream_chat_eligible(target_stream_id) then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  select m.*
  from public.live_chat_messages m
  where m.stream_id = target_stream_id
    and (
      m.moderation_state = 'visible'
      or m.sender_user_id = actor_id
      or public.live_chat_can_moderate(target_stream_id)
    )
    and (
      before_created_at is null
      or (m.created_at, m.id) < (before_created_at, coalesce(before_id, '00000000-0000-0000-0000-000000000000'::uuid))
    )
  order by m.created_at desc, m.id desc
  limit lim;
end;
$$;

revoke all on function public.list_live_chat_messages(uuid, integer, timestamptz, uuid) from public, anon;
grant execute on function public.list_live_chat_messages(uuid, integer, timestamptz, uuid) to authenticated;

create or replace function public.get_live_chat_viewer_state(target_stream_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  settings_row public.live_chat_settings%rowtype;
  stream_row public.publisher_streams%rowtype;
  timeout_until timestamptz;
  pinned public.live_chat_messages%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row from public.publisher_streams where id = target_stream_id;
  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into settings_row from public.live_chat_settings where stream_id = target_stream_id;
  if not found then
    settings_row.chat_enabled := true;
    settings_row.slow_mode_seconds := 0;
    settings_row.followers_only := false;
    settings_row.verified_only := false;
    settings_row.links_allowed := true;
    settings_row.reactions_enabled := true;
    settings_row.max_message_length := 500;
    settings_row.emergency_locked := false;
  end if;

  timeout_until := public.live_chat_active_timeout_expires(target_stream_id, actor_id);
  if settings_row.pinned_message_id is not null then
    select * into pinned from public.live_chat_messages where id = settings_row.pinned_message_id;
  end if;

  return jsonb_build_object(
    'streamId', target_stream_id,
    'streamStatus', stream_row.status,
    'chatEnabled', coalesce(settings_row.chat_enabled, true) and not coalesce(settings_row.emergency_locked, false),
    'emergencyLocked', coalesce(settings_row.emergency_locked, false),
    'slowModeSeconds', coalesce(settings_row.slow_mode_seconds, 0),
    'followersOnly', coalesce(settings_row.followers_only, false),
    'verifiedOnly', coalesce(settings_row.verified_only, false),
    'linksAllowed', coalesce(settings_row.links_allowed, true),
    'reactionsEnabled', coalesce(settings_row.reactions_enabled, true),
    'maxMessageLength', coalesce(settings_row.max_message_length, 500),
    'isOwner', stream_row.owner_user_id = actor_id,
    'isModerator', public.live_chat_is_active_moderator(target_stream_id),
    'canModerate', public.live_chat_can_moderate(target_stream_id),
    'isBanned', public.live_chat_is_banned(target_stream_id, actor_id),
    'timeoutExpiresAt', timeout_until,
    'followsOwner', public.live_chat_user_follows_owner(target_stream_id, actor_id),
    'isVerified', public.live_chat_user_is_verified(actor_id),
    'pinnedMessage', case
      when pinned.id is null or pinned.moderation_state <> 'visible' then null
      else jsonb_build_object(
        'id', pinned.id,
        'body', pinned.body,
        'senderUserId', pinned.sender_user_id,
        'createdAt', pinned.created_at
      )
    end
  );
end;
$$;

revoke all on function public.get_live_chat_viewer_state(uuid) from public, anon;
grant execute on function public.get_live_chat_viewer_state(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Moderation actions
-- ---------------------------------------------------------------------------
create or replace function public.remove_live_chat_message(
  target_message_id uuid,
  target_reason text default null
)
returns public.live_chat_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  message_row public.live_chat_messages%rowtype;
  result_row public.live_chat_messages%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into message_row from public.live_chat_messages where id = target_message_id for update;
  if not found then
    raise exception 'LIVE_CHAT_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.live_chat_can_moderate(message_row.stream_id) then
    raise exception 'LIVE_CHAT_MODERATION_FORBIDDEN' using errcode = '42501';
  end if;

  update public.live_chat_messages
  set
    moderation_state = 'deleted_by_moderator',
    deleted_at = now(),
    deleted_by = actor_id,
    body = case when char_length(body) > 0 then body else body end
  where id = target_message_id
  returning * into result_row;

  update public.live_chat_settings
  set pinned_message_id = null, updated_at = now()
  where stream_id = message_row.stream_id
    and pinned_message_id = target_message_id;

  perform public.live_chat_append_audit(
    message_row.stream_id, actor_id, 'MESSAGE_REMOVED', message_row.sender_user_id,
    target_message_id, target_reason, null, jsonb_build_object('moderation_state', 'deleted_by_moderator')
  );
  return result_row;
end;
$$;

revoke all on function public.remove_live_chat_message(uuid, text) from public, anon;
grant execute on function public.remove_live_chat_message(uuid, text) to authenticated;

create or replace function public.pin_live_chat_message(target_message_id uuid)
returns public.live_chat_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  message_row public.live_chat_messages%rowtype;
  settings_row public.live_chat_settings%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into message_row from public.live_chat_messages where id = target_message_id;
  if not found or message_row.moderation_state <> 'visible' then
    raise exception 'LIVE_CHAT_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.live_chat_can_moderate(message_row.stream_id) then
    raise exception 'LIVE_CHAT_PIN_FORBIDDEN' using errcode = '42501';
  end if;

  perform public.ensure_live_chat_settings(message_row.stream_id);

  update public.live_chat_settings
  set pinned_message_id = target_message_id, updated_at = now()
  where stream_id = message_row.stream_id
  returning * into settings_row;

  perform public.live_chat_append_audit(
    message_row.stream_id, actor_id, 'MESSAGE_PINNED', message_row.sender_user_id,
    target_message_id, null, null, '{}'::jsonb
  );
  return settings_row;
end;
$$;

revoke all on function public.pin_live_chat_message(uuid) from public, anon;
grant execute on function public.pin_live_chat_message(uuid) to authenticated;

create or replace function public.unpin_live_chat_message(target_stream_id uuid)
returns public.live_chat_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  settings_row public.live_chat_settings%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_is_active_moderator(target_stream_id)
     and not public.live_chat_can_platform_moderate() then
    raise exception 'LIVE_CHAT_PIN_FORBIDDEN' using errcode = '42501';
  end if;

  update public.live_chat_settings
  set pinned_message_id = null, updated_at = now()
  where stream_id = target_stream_id
  returning * into settings_row;

  if not found then
    raise exception 'LIVE_CHAT_SETTINGS_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'MESSAGE_UNPINNED', null, null, null, null, '{}'::jsonb
  );
  return settings_row;
end;
$$;

revoke all on function public.unpin_live_chat_message(uuid) from public, anon;
grant execute on function public.unpin_live_chat_message(uuid) to authenticated;

create or replace function public.timeout_live_chat_user(
  target_stream_id uuid,
  target_user_id uuid,
  duration_seconds integer,
  target_reason text default null
)
returns public.live_chat_timeouts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.live_chat_timeouts%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_can_moderate(target_stream_id) then
    raise exception 'LIVE_CHAT_MODERATION_FORBIDDEN' using errcode = '42501';
  end if;
  if duration_seconds not in (60, 300, 600, 1800, 3600, 86400) then
    raise exception 'LIVE_CHAT_TIMEOUT_DURATION_INVALID' using errcode = '22023';
  end if;
  if target_user_id = actor_id then
    raise exception 'LIVE_CHAT_TIMEOUT_SELF_DENIED' using errcode = '42501';
  end if;
  if public.live_chat_is_stream_owner(target_stream_id)
     is false
     and exists (
       select 1 from public.publisher_streams s
       where s.id = target_stream_id and s.owner_user_id = target_user_id
     ) then
    raise exception 'LIVE_CHAT_TIMEOUT_OWNER_DENIED' using errcode = '42501';
  end if;

  insert into public.live_chat_timeouts (stream_id, user_id, expires_at, reason, created_by)
  values (
    target_stream_id,
    target_user_id,
    now() + make_interval(secs => duration_seconds),
    left(coalesce(target_reason, ''), 500),
    actor_id
  )
  returning * into result_row;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'USER_TIMED_OUT', target_user_id, null, target_reason, null,
    jsonb_build_object('duration_seconds', duration_seconds)
  );
  return result_row;
end;
$$;

revoke all on function public.timeout_live_chat_user(uuid, uuid, integer, text) from public, anon;
grant execute on function public.timeout_live_chat_user(uuid, uuid, integer, text) to authenticated;

create or replace function public.ban_live_chat_user(
  target_stream_id uuid,
  target_user_id uuid,
  target_reason text default null
)
returns public.live_chat_bans
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.live_chat_bans%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_can_moderate(target_stream_id) then
    raise exception 'LIVE_CHAT_MODERATION_FORBIDDEN' using errcode = '42501';
  end if;
  if target_user_id = actor_id then
    raise exception 'LIVE_CHAT_BAN_SELF_DENIED' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.publisher_streams s
    where s.id = target_stream_id and s.owner_user_id = target_user_id
  ) and not public.live_chat_can_platform_moderate() then
    raise exception 'LIVE_CHAT_BAN_OWNER_DENIED' using errcode = '42501';
  end if;

  select * into result_row
  from public.live_chat_bans
  where stream_id = target_stream_id
    and banned_user_id = target_user_id
    and revoked_at is null
  for update;

  if found then
    perform public.live_chat_append_audit(
      target_stream_id, actor_id, 'USER_BANNED', target_user_id, null, target_reason, null,
      jsonb_build_object('idempotent', true)
    );
    return result_row;
  end if;

  insert into public.live_chat_bans (stream_id, banned_user_id, created_by, reason)
  values (target_stream_id, target_user_id, actor_id, left(coalesce(target_reason, ''), 500))
  returning * into result_row;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'USER_BANNED', target_user_id, null, target_reason, null, '{}'::jsonb
  );
  return result_row;
end;
$$;

revoke all on function public.ban_live_chat_user(uuid, uuid, text) from public, anon;
grant execute on function public.ban_live_chat_user(uuid, uuid, text) to authenticated;

create or replace function public.unban_live_chat_user(
  target_stream_id uuid,
  target_user_id uuid,
  target_reason text default null
)
returns public.live_chat_bans
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.live_chat_bans%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_can_moderate(target_stream_id) then
    raise exception 'LIVE_CHAT_MODERATION_FORBIDDEN' using errcode = '42501';
  end if;

  update public.live_chat_bans
  set revoked_at = now(), revoked_by = actor_id
  where stream_id = target_stream_id
    and banned_user_id = target_user_id
    and revoked_at is null
  returning * into result_row;

  if not found then
    raise exception 'LIVE_CHAT_BAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'USER_UNBANNED', target_user_id, null, target_reason, null, '{}'::jsonb
  );
  return result_row;
end;
$$;

revoke all on function public.unban_live_chat_user(uuid, uuid, text) from public, anon;
grant execute on function public.unban_live_chat_user(uuid, uuid, text) to authenticated;

create or replace function public.assign_stream_moderator(
  target_stream_id uuid,
  target_user_id uuid
)
returns public.live_chat_moderators
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.live_chat_moderators%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_is_stream_owner(target_stream_id)
     and not public.live_chat_can_platform_moderate() then
    raise exception 'LIVE_CHAT_ASSIGN_MOD_FORBIDDEN' using errcode = '42501';
  end if;
  if target_user_id = actor_id and not public.live_chat_is_stream_owner(target_stream_id) then
    raise exception 'LIVE_CHAT_SELF_PROMOTE_DENIED' using errcode = '42501';
  end if;
  if not public.publisher_profile_is_active_account(target_user_id) then
    raise exception 'LIVE_CHAT_TARGET_INACTIVE' using errcode = '22023';
  end if;

  insert into public.live_chat_moderators (stream_id, user_id, assigned_by, revoked_at, revoked_by)
  values (target_stream_id, target_user_id, actor_id, null, null)
  on conflict (stream_id, user_id) do update
    set revoked_at = null,
        revoked_by = null,
        assigned_by = excluded.assigned_by,
        created_at = now()
  returning * into result_row;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'MODERATOR_ASSIGNED', target_user_id, null, null, null, '{}'::jsonb
  );
  return result_row;
end;
$$;

revoke all on function public.assign_stream_moderator(uuid, uuid) from public, anon;
grant execute on function public.assign_stream_moderator(uuid, uuid) to authenticated;

create or replace function public.remove_stream_moderator(
  target_stream_id uuid,
  target_user_id uuid
)
returns public.live_chat_moderators
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.live_chat_moderators%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_is_stream_owner(target_stream_id)
     and not public.live_chat_can_platform_moderate() then
    raise exception 'LIVE_CHAT_ASSIGN_MOD_FORBIDDEN' using errcode = '42501';
  end if;

  update public.live_chat_moderators
  set revoked_at = now(), revoked_by = actor_id
  where stream_id = target_stream_id
    and user_id = target_user_id
    and revoked_at is null
  returning * into result_row;

  if not found then
    raise exception 'LIVE_CHAT_MODERATOR_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'MODERATOR_REMOVED', target_user_id, null, null, null, '{}'::jsonb
  );
  return result_row;
end;
$$;

revoke all on function public.remove_stream_moderator(uuid, uuid) from public, anon;
grant execute on function public.remove_stream_moderator(uuid, uuid) to authenticated;

create or replace function public.list_stream_moderators(target_stream_id uuid)
returns setof public.live_chat_moderators
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_can_moderate(target_stream_id)
     and not public.live_chat_is_stream_owner(target_stream_id) then
    raise exception 'LIVE_CHAT_LIST_MODS_FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select * from public.live_chat_moderators
  where stream_id = target_stream_id and revoked_at is null
  order by created_at asc;
end;
$$;

revoke all on function public.list_stream_moderators(uuid) from public, anon;
grant execute on function public.list_stream_moderators(uuid) to authenticated;

create or replace function public.update_live_chat_settings(
  target_stream_id uuid,
  target_chat_enabled boolean default null,
  target_slow_mode_seconds integer default null,
  target_followers_only boolean default null,
  target_verified_only boolean default null,
  target_links_allowed boolean default null,
  target_reactions_enabled boolean default null,
  target_max_message_length integer default null,
  target_emergency_locked boolean default null,
  target_emergency_lock_reason text default null
)
returns public.live_chat_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  settings_row public.live_chat_settings%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_emergency_locked is not null and target_emergency_locked
     and not public.live_chat_can_platform_moderate()
     and not public.live_chat_is_stream_owner(target_stream_id) then
    raise exception 'LIVE_CHAT_EMERGENCY_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.live_chat_is_stream_owner(target_stream_id)
     and not public.live_chat_can_platform_moderate() then
    raise exception 'LIVE_CHAT_SETTINGS_FORBIDDEN' using errcode = '42501';
  end if;

  perform public.ensure_live_chat_settings(target_stream_id);

  if target_slow_mode_seconds is not null
     and target_slow_mode_seconds not in (0, 5, 10, 30, 60, 120) then
    raise exception 'LIVE_CHAT_SLOW_MODE_INVALID' using errcode = '22023';
  end if;

  update public.live_chat_settings
  set
    chat_enabled = coalesce(target_chat_enabled, chat_enabled),
    slow_mode_seconds = coalesce(target_slow_mode_seconds, slow_mode_seconds),
    followers_only = coalesce(target_followers_only, followers_only),
    verified_only = coalesce(target_verified_only, verified_only),
    links_allowed = coalesce(target_links_allowed, links_allowed),
    reactions_enabled = coalesce(target_reactions_enabled, reactions_enabled),
    max_message_length = coalesce(target_max_message_length, max_message_length),
    emergency_locked = coalesce(target_emergency_locked, emergency_locked),
    emergency_lock_reason = case
      when target_emergency_locked is true then left(coalesce(target_emergency_lock_reason, emergency_lock_reason, ''), 500)
      when target_emergency_locked is false then null
      else emergency_lock_reason
    end,
    updated_at = now()
  where stream_id = target_stream_id
  returning * into settings_row;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'CHAT_SETTINGS_UPDATED', null, null,
    target_emergency_lock_reason, null,
    jsonb_build_object(
      'chat_enabled', settings_row.chat_enabled,
      'slow_mode_seconds', settings_row.slow_mode_seconds,
      'emergency_locked', settings_row.emergency_locked
    )
  );
  return settings_row;
end;
$$;

revoke all on function public.update_live_chat_settings(uuid, boolean, integer, boolean, boolean, boolean, boolean, integer, boolean, text)
  from public, anon;
grant execute on function public.update_live_chat_settings(uuid, boolean, integer, boolean, boolean, boolean, boolean, integer, boolean, text)
  to authenticated;

create or replace function public.react_live_chat_message(
  target_message_id uuid,
  target_reaction_key text
)
returns public.live_chat_reactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  message_row public.live_chat_messages%rowtype;
  settings_row public.live_chat_settings%rowtype;
  result_row public.live_chat_reactions%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_reaction_key not in ('like', 'love', 'laugh', 'wow', 'sad', 'angry') then
    raise exception 'LIVE_CHAT_REACTION_INVALID' using errcode = '22023';
  end if;

  select * into message_row from public.live_chat_messages where id = target_message_id;
  if not found or message_row.moderation_state <> 'visible' then
    raise exception 'LIVE_CHAT_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if public.live_chat_is_banned(message_row.stream_id, actor_id) then
    raise exception 'LIVE_CHAT_BANNED' using errcode = '42501';
  end if;
  if public.live_chat_active_timeout_expires(message_row.stream_id, actor_id) is not null then
    raise exception 'LIVE_CHAT_TIMED_OUT' using errcode = '42501';
  end if;

  select * into settings_row from public.live_chat_settings where stream_id = message_row.stream_id;
  if found and (not settings_row.reactions_enabled or not settings_row.chat_enabled or settings_row.emergency_locked) then
    raise exception 'LIVE_CHAT_REACTIONS_DISABLED' using errcode = '55000';
  end if;

  if not public.live_chat_consume_rate_limit(actor_id, message_row.stream_id, 'reaction', 20, 60) then
    raise exception 'LIVE_CHAT_RATE_LIMITED' using errcode = '54000', hint = '60';
  end if;

  insert into public.live_chat_reactions (message_id, user_id, reaction_key)
  values (target_message_id, actor_id, target_reaction_key)
  on conflict (message_id, user_id, reaction_key) do nothing
  returning * into result_row;

  if not found then
    select * into result_row
    from public.live_chat_reactions
    where message_id = target_message_id
      and user_id = actor_id
      and reaction_key = target_reaction_key;
  end if;
  return result_row;
end;
$$;

revoke all on function public.react_live_chat_message(uuid, text) from public, anon;
grant execute on function public.react_live_chat_message(uuid, text) to authenticated;

create or replace function public.report_live_chat_message(
  target_stream_id uuid,
  target_message_id uuid,
  target_user_id uuid,
  target_category text,
  target_description text default ''
)
returns public.live_chat_reports
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  result_row public.live_chat_reports%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_category not in ('spam', 'harassment', 'hate', 'sexual', 'scam', 'other') then
    raise exception 'LIVE_CHAT_REPORT_CATEGORY_INVALID' using errcode = '22023';
  end if;
  if target_message_id is not null and not exists (
    select 1 from public.live_chat_messages m
    where m.id = target_message_id and m.stream_id = target_stream_id
  ) then
    raise exception 'LIVE_CHAT_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.live_chat_consume_rate_limit(actor_id, target_stream_id, 'report', 10, 3600) then
    raise exception 'LIVE_CHAT_RATE_LIMITED' using errcode = '54000', hint = '3600';
  end if;

  if exists (
    select 1 from public.live_chat_reports r
    where r.stream_id = target_stream_id
      and r.reporter_user_id = actor_id
      and r.target_user_id = target_user_id
      and r.category = target_category
      and r.status = 'open'
      and r.message_id is not distinct from target_message_id
  ) then
    raise exception 'LIVE_CHAT_REPORT_DUPLICATE' using errcode = '23505';
  end if;

  insert into public.live_chat_reports (
    stream_id, reporter_user_id, message_id, target_user_id, category, description
  ) values (
    target_stream_id, actor_id, target_message_id, target_user_id, target_category,
    left(coalesce(target_description, ''), 1000)
  )
  returning * into result_row;

  perform public.live_chat_append_audit(
    target_stream_id, actor_id, 'MESSAGE_REPORTED', target_user_id, target_message_id,
    target_category, null, jsonb_build_object('category', target_category)
  );
  return result_row;
end;
$$;

revoke all on function public.report_live_chat_message(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function public.report_live_chat_message(uuid, uuid, uuid, text, text) to authenticated;

create or replace function public.list_live_chat_moderation_snapshot(target_stream_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.live_chat_can_moderate(target_stream_id) then
    raise exception 'LIVE_CHAT_MODERATION_FORBIDDEN' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'moderators', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id, 'assignedBy', m.assigned_by, 'createdAt', m.created_at
      ) order by m.created_at)
      from public.live_chat_moderators m
      where m.stream_id = target_stream_id and m.revoked_at is null
    ), '[]'::jsonb),
    'timeouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'userId', t.user_id, 'expiresAt', t.expires_at, 'reason', t.reason
      ) order by t.expires_at desc)
      from public.live_chat_timeouts t
      where t.stream_id = target_stream_id and t.expires_at > now()
    ), '[]'::jsonb),
    'bans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'userId', b.banned_user_id, 'reason', b.reason, 'createdAt', b.created_at
      ) order by b.created_at desc)
      from public.live_chat_bans b
      where b.stream_id = target_stream_id and b.revoked_at is null
    ), '[]'::jsonb),
    'recentAudit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'eventType', a.event_type, 'actorUserId', a.actor_user_id,
        'targetUserId', a.target_user_id, 'messageId', a.message_id,
        'reason', a.reason, 'createdAt', a.created_at
      ) order by a.created_at desc)
      from (
        select * from public.live_chat_audit_events
        where stream_id = target_stream_id
        order by created_at desc
        limit 40
      ) a
    ), '[]'::jsonb),
    'openReports', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'category', r.category, 'targetUserId', r.target_user_id,
        'messageId', r.message_id, 'createdAt', r.created_at
      ) order by r.created_at desc)
      from public.live_chat_reports r
      where r.stream_id = target_stream_id and r.status = 'open'
      limit 40
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_live_chat_moderation_snapshot(uuid) from public, anon;
grant execute on function public.list_live_chat_moderation_snapshot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS policies (SELECT only; no authenticated writes)
-- ---------------------------------------------------------------------------
drop policy if exists live_chat_settings_select on public.live_chat_settings;
create policy live_chat_settings_select
  on public.live_chat_settings for select to authenticated
  using (
    public.live_chat_stream_chat_eligible(stream_id)
    or owner_user_id = auth.uid()
    or public.live_chat_can_moderate(stream_id)
  );

drop policy if exists live_chat_messages_select on public.live_chat_messages;
create policy live_chat_messages_select
  on public.live_chat_messages for select to authenticated
  using (
    public.live_chat_stream_chat_eligible(stream_id)
    and (
      moderation_state = 'visible'
      or sender_user_id = auth.uid()
      or public.live_chat_can_moderate(stream_id)
    )
  );

drop policy if exists live_chat_reactions_select on public.live_chat_reactions;
create policy live_chat_reactions_select
  on public.live_chat_reactions for select to authenticated
  using (
    exists (
      select 1 from public.live_chat_messages m
      where m.id = message_id
        and public.live_chat_stream_chat_eligible(m.stream_id)
    )
  );

drop policy if exists live_chat_moderators_select on public.live_chat_moderators;
create policy live_chat_moderators_select
  on public.live_chat_moderators for select to authenticated
  using (
    public.live_chat_can_moderate(stream_id)
    or public.live_chat_is_stream_owner(stream_id)
  );

drop policy if exists live_chat_timeouts_select on public.live_chat_timeouts;
create policy live_chat_timeouts_select
  on public.live_chat_timeouts for select to authenticated
  using (
    user_id = auth.uid()
    or public.live_chat_can_moderate(stream_id)
  );

drop policy if exists live_chat_bans_select on public.live_chat_bans;
create policy live_chat_bans_select
  on public.live_chat_bans for select to authenticated
  using (
    banned_user_id = auth.uid()
    or public.live_chat_can_moderate(stream_id)
  );

drop policy if exists live_chat_reports_deny_select on public.live_chat_reports;
create policy live_chat_reports_deny_select
  on public.live_chat_reports for select to authenticated
  using (
    reporter_user_id = auth.uid()
    or public.live_chat_can_moderate(stream_id)
  );

drop policy if exists live_chat_audit_owner_select on public.live_chat_audit_events;
create policy live_chat_audit_owner_select
  on public.live_chat_audit_events for select to authenticated
  using (
    public.live_chat_is_stream_owner(stream_id)
    or public.live_chat_can_platform_moderate()
  );

-- Realtime publication (authenticated consumers still RLS-gated).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.live_chat_messages;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.live_chat_settings;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

alter table public.live_chat_messages replica identity full;
alter table public.live_chat_settings replica identity full;

grant execute on function public.live_chat_is_stream_owner(uuid) to authenticated;
grant execute on function public.live_chat_is_active_moderator(uuid) to authenticated;
grant execute on function public.live_chat_can_moderate(uuid) to authenticated;
grant execute on function public.live_chat_can_platform_moderate() to authenticated;

commit;
