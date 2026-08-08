-- TASK27 hardening: LiveKit Ingress is the only OBS credential authority;
-- webhook can advance ready/connecting -> live; owners cannot self-mint fake keys.

begin;

grant execute on function public.user_can_broadcast_on_picom_live(uuid) to service_role;

-- Allow ready -> live so ingress_started can promote after prepare without a
-- separate connecting hop when OBS publishes immediately. connecting remains
-- the preferred client "Start" hop for OBS.
create or replace function public.publisher_stream_transition_allowed(
  from_status text,
  to_status text
)
returns boolean
language sql
immutable
as $$
  select case
    when from_status is null or to_status is null then false
    when from_status = to_status then false
    when from_status = 'draft' then to_status in ('scheduled', 'ready', 'cancelled')
    when from_status = 'scheduled' then to_status in ('draft', 'ready', 'cancelled')
    when from_status = 'ready' then to_status in ('connecting', 'live', 'scheduled', 'draft', 'cancelled')
    when from_status = 'connecting' then to_status in ('live', 'failed', 'ending')
    when from_status = 'live' then to_status in ('reconnecting', 'ending', 'failed')
    when from_status = 'reconnecting' then to_status in ('live', 'ending', 'failed')
    when from_status = 'ending' then to_status in ('ended', 'failed')
    else false
  end;
$$;

revoke all on function public.publisher_stream_transition_allowed(text, text) from public, anon;
grant execute on function public.publisher_stream_transition_allowed(text, text) to authenticated, service_role;

create or replace function public.update_publisher_stream(
  target_stream_id uuid,
  target_title text default null,
  target_description text default null,
  target_category text default null,
  target_tags text[] default null,
  target_visibility text default null,
  target_moderation_mode text default null,
  target_scheduled_at timestamptz default null,
  target_cover_storage_path text default null,
  target_clear_cover boolean default false
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if stream_row.status not in ('draft', 'scheduled', 'ready') then
    raise exception 'STREAM_NOT_EDITABLE' using errcode = '55000';
  end if;

  if target_title is not null
     and char_length(public.publisher_stream_normalize_title(target_title)) < 2 then
    raise exception 'STREAM_TITLE_INVALID' using errcode = '22023';
  end if;

  update public.publisher_streams
  set
    title = case
      when target_title is null then title
      else public.publisher_stream_normalize_title(target_title)
    end,
    description = case
      when target_description is null then description
      else left(
        btrim(regexp_replace(target_description, E'[\\u0000-\\u001f\\u007f]', '', 'g')),
        2000
      )
    end,
    category = case
      when target_category is null then category
      else left(btrim(coalesce(nullif(target_category, ''), category)), 64)
    end,
    tags = coalesce(target_tags, tags),
    visibility = case
      when target_visibility in ('public', 'unlisted', 'private') then target_visibility
      else visibility
    end,
    moderation_mode = case
      when target_moderation_mode in ('standard', 'strict', 'relaxed') then target_moderation_mode
      else moderation_mode
    end,
    scheduled_at = coalesce(target_scheduled_at, scheduled_at),
    cover_storage_path = case
      when target_clear_cover then null
      when target_cover_storage_path is not null then target_cover_storage_path
      else cover_storage_path
    end,
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_UPDATED',
    stream_row.status,
    result_row.status,
    null,
    null,
    jsonb_build_object('fields', 'metadata')
  );

  return result_row;
end;
$$;

revoke all on function public.update_publisher_stream(uuid, text, text, text, text[], text, text, timestamptz, text, boolean)
  from public, anon;
grant execute on function public.update_publisher_stream(uuid, text, text, text, text[], text, text, timestamptz, text, boolean)
  to authenticated;

create or replace function public.transition_publisher_stream(
  target_stream_id uuid,
  target_to_status text,
  target_reason text default null,
  target_correlation_id text default null
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  is_service boolean := coalesce(auth.jwt()->>'role', '') = 'service_role';
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
  event_type text;
  active_cred public.publisher_stream_credentials%rowtype;
begin
  if not is_service and actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not is_service then
    if stream_row.owner_user_id <> actor_id then
      raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
    end if;
    if not public.publisher_stream_can_manage() then
      raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
    end if;
  end if;

  if target_to_status not in (
    'draft', 'scheduled', 'ready', 'connecting', 'live', 'reconnecting',
    'ending', 'ended', 'cancelled', 'failed'
  ) then
    raise exception 'STREAM_STATUS_INVALID' using errcode = '22023';
  end if;

  if not public.publisher_stream_transition_allowed(stream_row.status, target_to_status) then
    raise exception 'STREAM_TRANSITION_DENIED' using errcode = '55000';
  end if;

  -- OBS: clients may enter connecting after ingress provision; live requires
  -- provider evidence (PUBLISHING). Service/webhook may promote to live.
  if not is_service and stream_row.ingest_mode = 'OBS_EXTERNAL' then
    if target_to_status = 'live' and stream_row.connection_state <> 'PUBLISHING' then
      raise exception 'STREAM_OBS_NOT_PUBLISHING' using errcode = '55000';
    end if;
    if target_to_status = 'connecting' then
      select * into active_cred
      from public.publisher_stream_credentials
      where stream_id = target_stream_id
        and status = 'active'
      limit 1;
      if not found or active_cred.provider_ingress_id is null then
        raise exception 'STREAM_OBS_INGRESS_REQUIRED' using errcode = '55000';
      end if;
    end if;
  end if;

  if target_to_status = 'connecting' and actor_id is not null then
    if not public.consume_publisher_stream_rate_limit(actor_id, 'start_broadcast', 20, 3600) then
      raise exception 'STREAM_START_RATE_LIMITED' using errcode = '54000';
    end if;
  end if;
  if target_to_status = 'reconnecting' and actor_id is not null then
    if not public.consume_publisher_stream_rate_limit(actor_id, 'reconnect', 60, 3600) then
      raise exception 'STREAM_RECONNECT_RATE_LIMITED' using errcode = '54000';
    end if;
  end if;

  update public.publisher_streams
  set
    status = target_to_status,
    started_at = case
      when target_to_status = 'live' then coalesce(started_at, now())
      else started_at
    end,
    ended_at = case
      when target_to_status in ('ended', 'cancelled', 'failed') then coalesce(ended_at, now())
      else ended_at
    end,
    connection_state = case
      when target_to_status = 'connecting' then 'WAITING'
      when target_to_status = 'live' then 'PUBLISHING'
      when target_to_status = 'reconnecting' then 'UNHEALTHY'
      when target_to_status = 'ending' then 'DISCONNECTED'
      when target_to_status in ('ended', 'cancelled', 'failed') then 'DISCONNECTED'
      else connection_state
    end,
    health_status = case
      when target_to_status = 'live' then 'GOOD'
      when target_to_status = 'reconnecting' then 'DEGRADED'
      when target_to_status in ('ending', 'ended', 'cancelled', 'failed') then 'DISCONNECTED'
      else health_status
    end,
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  event_type := public.publisher_stream_audit_event_for_transition(target_to_status);

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    event_type,
    stream_row.status,
    target_to_status,
    target_reason,
    target_correlation_id,
    jsonb_build_object('ingest_mode', result_row.ingest_mode)
  );

  return result_row;
end;
$$;

revoke all on function public.transition_publisher_stream(uuid, text, text, text) from public, anon;
grant execute on function public.transition_publisher_stream(uuid, text, text, text) to authenticated, service_role;

-- OBS credentials must come from LiveKit Ingress edge (real stream keys).
create or replace function public.create_publisher_stream_credential(target_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'STREAM_CREDENTIAL_USE_INGRESS_EDGE'
    using errcode = '55000',
          hint = 'Call livekit-ingress action provisionForStream for OBS_EXTERNAL credentials.';
end;
$$;

revoke all on function public.create_publisher_stream_credential(uuid) from public, anon;
grant execute on function public.create_publisher_stream_credential(uuid) to authenticated;

create or replace function public.rotate_publisher_stream_credential(target_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'STREAM_CREDENTIAL_USE_INGRESS_EDGE'
    using errcode = '55000',
          hint = 'Call livekit-ingress action provisionForStream to rotate OBS credentials (deletes prior ingress).';
end;
$$;

revoke all on function public.rotate_publisher_stream_credential(uuid) from public, anon;
grant execute on function public.rotate_publisher_stream_credential(uuid) to authenticated;

-- Revoke DB row after edge DeleteIngress. Returns provider_ingress_id for clients
-- that need to delete first; preferred path is edge action=delete then this RPC.
create or replace function public.revoke_publisher_stream_credential(target_stream_id uuid)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
  revoked_count integer;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;

  update public.publisher_stream_credentials
  set
    status = 'revoked',
    revoked_at = coalesce(revoked_at, now()),
    provider_ingress_id = null
  where stream_id = target_stream_id
    and status = 'active';
  get diagnostics revoked_count = row_count;

  -- Idempotent when edge delete already revoked the active credential.
  if revoked_count = 0 and stream_row.connection_state <> 'REVOKED' then
    raise exception 'STREAM_CREDENTIAL_NOT_ACTIVE' using errcode = 'P0002';
  end if;

  update public.publisher_streams
  set
    connection_state = 'REVOKED',
    health_status = 'DISCONNECTED',
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_CREDENTIAL_REVOKED',
    stream_row.status,
    result_row.status,
    null,
    null,
    jsonb_build_object('connection_state', 'REVOKED', 'provider_deleted', true)
  );

  return result_row;
end;
$$;

revoke all on function public.revoke_publisher_stream_credential(uuid) from public, anon;
grant execute on function public.revoke_publisher_stream_credential(uuid) to authenticated;

-- Read-only connection probe: never invent CONNECTED/PUBLISHING.
create or replace function public.test_publisher_stream_credential(target_stream_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  stream_row public.publisher_streams%rowtype;
  cred_row public.publisher_stream_credentials%rowtype;
  tested_at timestamptz := now();
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;
  if stream_row.owner_user_id <> actor_id then
    raise exception 'STREAM_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if not public.publisher_stream_can_manage() then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into cred_row
  from public.publisher_stream_credentials
  where stream_id = target_stream_id
    and status = 'active'
  for update;

  if not found then
    raise exception 'STREAM_CREDENTIAL_NOT_ACTIVE' using errcode = 'P0002';
  end if;

  if not public.consume_publisher_stream_rate_limit(actor_id, 'connection_test', 30, 3600) then
    raise exception 'STREAM_CONNECTION_TEST_RATE_LIMITED' using errcode = '54000';
  end if;

  update public.publisher_stream_credentials
  set last_tested_at = tested_at
  where id = cred_row.id;

  perform public.publisher_stream_append_audit(
    target_stream_id,
    actor_id,
    'STREAM_CONNECTION_TEST',
    stream_row.status,
    stream_row.status,
    null,
    null,
    jsonb_build_object(
      'connection_state', stream_row.connection_state,
      'provider_ingress_present', cred_row.provider_ingress_id is not null,
      'read_only', true
    )
  );

  return jsonb_build_object(
    'connection_state', stream_row.connection_state,
    'tested_at', tested_at,
    'provider_ingress_present', cred_row.provider_ingress_id is not null
  );
end;
$$;

revoke all on function public.test_publisher_stream_credential(uuid) from public, anon;
grant execute on function public.test_publisher_stream_credential(uuid) to authenticated;

create or replace function public.service_apply_publisher_stream_ingress_event(
  target_stream_id uuid,
  target_event_type text,
  target_connection_state text default null,
  target_health_status text default null,
  target_provider_ingress_id text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns public.publisher_streams
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stream_row public.publisher_streams%rowtype;
  result_row public.publisher_streams%rowtype;
  safe_metadata jsonb := coalesce(target_metadata, '{}'::jsonb);
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if jsonb_typeof(safe_metadata) is distinct from 'object' then
    raise exception 'STREAM_INGRESS_METADATA_INVALID' using errcode = '22023';
  end if;

  select * into stream_row
  from public.publisher_streams
  where id = target_stream_id
  for update;

  if not found then
    raise exception 'STREAM_NOT_FOUND' using errcode = 'P0002';
  end if;

  if target_connection_state is not null and target_connection_state not in (
    'NOT_CONNECTED', 'WAITING', 'CONNECTED', 'PUBLISHING',
    'UNHEALTHY', 'DISCONNECTED', 'REVOKED'
  ) then
    raise exception 'STREAM_CONNECTION_STATE_INVALID' using errcode = '22023';
  end if;
  if target_health_status is not null and target_health_status not in (
    'EXCELLENT', 'GOOD', 'DEGRADED', 'POOR', 'DISCONNECTED'
  ) then
    raise exception 'STREAM_HEALTH_STATUS_INVALID' using errcode = '22023';
  end if;

  update public.publisher_streams
  set
    connection_state = coalesce(target_connection_state, connection_state),
    health_status = coalesce(target_health_status, health_status),
    metadata = metadata || (safe_metadata - 'plaintext_secret' - 'secret' - 'stream_key'),
    updated_at = now()
  where id = target_stream_id
  returning * into result_row;

  if target_provider_ingress_id is not null then
    update public.publisher_stream_credentials
    set provider_ingress_id = target_provider_ingress_id
    where stream_id = target_stream_id
      and status = 'active';
  end if;

  if target_event_type in ('ingress_started', 'track_published') then
    if public.publisher_stream_transition_allowed(result_row.status, 'connecting') then
      result_row := public.transition_publisher_stream(
        target_stream_id, 'connecting', target_event_type, null
      );
    end if;
    if public.publisher_stream_transition_allowed(result_row.status, 'live') then
      result_row := public.transition_publisher_stream(
        target_stream_id, 'live', target_event_type, null
      );
    end if;
  elsif target_event_type in ('ingress_ended', 'ingress_finished') then
    if public.publisher_stream_transition_allowed(result_row.status, 'reconnecting') then
      result_row := public.transition_publisher_stream(
        target_stream_id, 'reconnecting', target_event_type, null
      );
    elsif public.publisher_stream_transition_allowed(result_row.status, 'ending') then
      result_row := public.transition_publisher_stream(
        target_stream_id, 'ending', target_event_type, null
      );
      if public.publisher_stream_transition_allowed(result_row.status, 'ended') then
        result_row := public.transition_publisher_stream(
          target_stream_id, 'ended', target_event_type, null
        );
      end if;
    end if;
  elsif target_event_type in ('ingress_failed', 'ingress_error')
     and public.publisher_stream_transition_allowed(result_row.status, 'failed') then
    result_row := public.transition_publisher_stream(
      target_stream_id, 'failed', target_event_type, null
    );
  else
    perform public.publisher_stream_append_audit(
      target_stream_id,
      null,
      'STREAM_TRANSITION',
      stream_row.status,
      result_row.status,
      target_event_type,
      null,
      jsonb_build_object(
        'source', 'ingress_webhook',
        'event_type', target_event_type,
        'connection_state', result_row.connection_state,
        'health_status', result_row.health_status
      )
    );
  end if;

  return result_row;
end;
$$;

revoke all on function public.service_apply_publisher_stream_ingress_event(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.service_apply_publisher_stream_ingress_event(uuid, text, text, text, text, jsonb)
  to service_role;

comment on function public.create_publisher_stream_credential(uuid) is
  'OBS credentials are provisioned exclusively via livekit-ingress edge (CreateIngress).';

commit;
