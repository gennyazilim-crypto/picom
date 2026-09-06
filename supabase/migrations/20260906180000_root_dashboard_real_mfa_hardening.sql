-- Root authorization hardening only; no role grants or account changes.
-- Forward-only: preserve historical migrations and all existing RPC signatures.
begin;
create or replace function public.confirm_privileged_step_up(challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  -- Check server-verified assurance at both confirmation and consumption.
  if (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode = '42501';
  end if;
  if challenge_id is null then
    raise exception 'STEP_UP_CHALLENGE_INVALID' using errcode = '22023';
  end if;

  update public.privileged_step_up_challenges challenge
  set confirmed_at = now()
  where challenge.id = challenge_id
    and challenge.user_id = auth.uid()
    and challenge.confirmed_at is null
    and challenge.expires_at > now();

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'STEP_UP_CHALLENGE_INVALID' using errcode = '22023';
  end if;

  perform public.write_root_dashboard_audit(
    'step_up_confirm',
    'step_up',
    challenge_id::text,
    null,
    null,
    challenge_id,
    '{}'::jsonb,
    jsonb_build_object('confirmed', true),
    'ok'
  );

  return true;
end;
$$;
create or replace function public.require_or_consume_step_up(
  action_key text,
  challenge_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_key text := left(trim(coalesce(action_key, '')), 80);
  matched_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  -- Check server-verified assurance at both confirmation and consumption.
  if (auth.jwt() ->> 'aal') is distinct from 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode = '42501';
  end if;
  if char_length(clean_key) < 1 then
    raise exception 'STEP_UP_ACTION_INVALID' using errcode = '22023';
  end if;

  select challenge.id
    into matched_id
  from public.privileged_step_up_challenges challenge
  where challenge.user_id = auth.uid()
    and challenge.action_key = clean_key
    and challenge.confirmed_at is not null
    and challenge.confirmed_at >= now() - interval '5 minutes'
    and challenge.expires_at > now()
    and (challenge_id is null or challenge.id = challenge_id)
  order by challenge.confirmed_at desc
  limit 1
  for update;

  if matched_id is null then
    raise exception 'STEP_UP_REQUIRED' using errcode = '42501';
  end if;

  -- Consume: prevent reuse of the same challenge
  update public.privileged_step_up_challenges
  set expires_at = now()
  where id = matched_id;

  perform public.write_root_dashboard_audit(
    'step_up_consume',
    'step_up',
    matched_id::text,
    null,
    null,
    matched_id,
    '{}'::jsonb,
    jsonb_build_object('action_key', clean_key),
    'ok'
  );

  return matched_id;
end;
$$;
create or replace function public.list_root_dashboard_module_v1(
  module_name text,
  page_cursor_created_at timestamptz default null,
  page_cursor_id text default null,
  page_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  safe_limit integer := least(greatest(coalesce(page_limit, 25), 1), 50);
  result jsonb;
  required_perm text := 'dashboard.read';
begin
  if module_name in ('voice_rooms') then
    required_perm := 'voice.read';
  elsif module_name in ('radio_sessions') then
    required_perm := 'radio.read';
  elsif module_name in ('podcast_shows') then
    required_perm := 'podcast.read';
  elsif module_name in ('notifications_ops') then
    required_perm := 'notifications.read';
  elsif module_name in ('content_reports') then
    required_perm := 'reports.read';
  elsif module_name in ('dm_safety_reports') then
    required_perm := 'dm_safety.read';
  elsif module_name in ('support_tickets', 'support_team') then
    required_perm := 'support.read';
  elsif module_name in ('ad_campaigns', 'ad_creative_review', 'advertising_team') then
    required_perm := 'ads.read';
  elsif module_name in ('subscriptions', 'finance_approvals') then
    required_perm := 'finance.read';
  elsif module_name in ('incidents', 'security_alerts', 'security_team') then
    required_perm := 'incidents.read';
  elsif module_name in ('moderation_team') then
    required_perm := 'reports.read';
  end if;

  if not public.has_platform_permission(required_perm) then
    raise exception 'APP_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if module_name = 'support_tickets' then
    with candidates as (
      select ticket.id::text id, ticket.subject label, ticket.category || ' · ' || ticket.priority detail, ticket.status, ticket.created_at
      from public.support_tickets ticket
      where page_cursor_created_at is null
        or (ticket.created_at, ticket.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by ticket.created_at desc, ticket.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'support_team' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, 'active' status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.role_key in ('support_manager', 'support_agent')
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'ad_campaigns' then
    with candidates as (
      select campaign.id::text id, campaign.name label, campaign.objective || ' · spend ' || campaign.spend_cents::text detail, campaign.status, campaign.created_at
      from public.ad_campaigns campaign
      where page_cursor_created_at is null
        or (campaign.created_at, campaign.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by campaign.created_at desc, campaign.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'ad_creative_review' then
    with candidates as (
      select campaign.id::text id, campaign.name label, campaign.review_status detail, campaign.status, campaign.created_at
      from public.ad_campaigns campaign
      where campaign.review_status in ('pending', 'in_review', 'rejected')
        and (page_cursor_created_at is null or (campaign.created_at, campaign.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by campaign.created_at desc, campaign.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'advertising_team' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, 'active' status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.role_key in ('ads_manager', 'ads_operator', 'ads_reviewer')
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'subscriptions' then
    with candidates as (
      select record.id::text id, record.plan_key label, record.status || ' · ' || record.currency detail, record.status, record.created_at
      from public.subscription_records record
      where page_cursor_created_at is null
        or (record.created_at, record.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by record.created_at desc, record.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'finance_approvals' then
    with candidates as (
      select request.id::text id, request.request_type label, request.amount_cents::text || ' ' || request.currency detail, request.status, request.created_at
      from public.finance_approval_requests request
      where page_cursor_created_at is null
        or (request.created_at, request.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by request.created_at desc, request.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'incidents' then
    with candidates as (
      select incident.id::text id, incident.title label, incident.severity detail, incident.status, incident.created_at
      from public.platform_incidents incident
      where page_cursor_created_at is null
        or (incident.created_at, incident.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by incident.created_at desc, incident.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'security_alerts' then
    with candidates as (
      select event.id::text id, replace(event.event_type, '_', ' ') label, event.reason_code detail, event.severity status, event.created_at
      from public.abuse_events event
      where event.severity in ('high', 'critical')
        and event.created_at >= now() - interval '7 days'
        and (page_cursor_created_at is null or (event.created_at, event.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by event.created_at desc, event.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'security_team' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, 'active' status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.role_key in ('security_manager', 'security_analyst')
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'moderation_team' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, 'active' status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.role_key in ('trust_safety_manager', 'moderator')
        and assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'role_assignments' then
    with candidates as (
      select assignment.id::text id, profile.display_name label, assignment.role_key detail, assignment.scope_type status, assignment.created_at
      from public.platform_role_assignments assignment
      join public.profiles profile on profile.id = assignment.user_id
      where assignment.revoked_at is null
        and (assignment.expires_at is null or assignment.expires_at > now())
        and (page_cursor_created_at is null or (assignment.created_at, assignment.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by assignment.created_at desc, assignment.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'audit_logs' then
    with candidates as (
      select audit.id::text id, audit.action_type label, audit.target_type detail, coalesce(audit.result, 'recorded') status, audit.created_at
      from public.root_dashboard_audit audit
      where page_cursor_created_at is null
        or (audit.created_at, audit.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '0'))
      order by audit.created_at desc, audit.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'feature_flags' then
    with candidates as (
      select flag.flag_key id, flag.flag_key label, flag.description detail, case when flag.enabled then 'enabled' else 'disabled' end status, flag.updated_at created_at
      from public.remote_feature_flags flag
      where page_cursor_created_at is null
        or (flag.updated_at, flag.flag_key) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by flag.updated_at desc, flag.flag_key desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'voice_rooms' then
    with candidates as (
      select
        session.id::text id,
        coalesce(room.title, session.provider_room_name) label,
        room.mode || ' · ' || session.status || ' · p' || session.participant_count::text detail,
        session.status,
        session.created_at
      from public.meeting_sessions session
      join public.meeting_rooms room on room.id = session.room_id
      where room.mode in ('voice', 'meeting', 'stage')
        and (page_cursor_created_at is null
          or (session.created_at, session.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by session.created_at desc, session.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'radio_sessions' then
    with candidates as (
      select
        session.id::text id,
        session.title label,
        session.status || ' · listeners ' || session.listener_count::text detail,
        session.status,
        session.created_at
      from public.radio_sessions session
      where page_cursor_created_at is null
        or (session.created_at, session.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by session.created_at desc, session.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'podcast_shows' then
    with candidates as (
      select
        series.id::text id,
        series.title label,
        case when series.is_active then 'active' else 'inactive' end detail,
        case when series.is_active then 'active' else 'inactive' end status,
        series.created_at
      from public.podcast_series series
      where page_cursor_created_at is null
        or (series.created_at, series.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
      order by series.created_at desc, series.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'notifications_ops' then
    if to_regclass('public.notifications') is null then
      result := jsonb_build_object('items', '[]'::jsonb, 'has_more', false, 'next_cursor', null);
    else
      with candidates as (
        select
          n.id::text id,
          n.title label,
          n.category || ' · ' || n.context_kind detail,
          case when n.read_at is null then 'unread' else 'read' end status,
          n.created_at
        from public.notifications n
        where n.deleted_at is null
          and (page_cursor_created_at is null
            or (n.created_at, n.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
        order by n.created_at desc, n.id desc
        limit safe_limit + 1
      ),
      page as (select * from candidates limit safe_limit)
      select jsonb_build_object(
        'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
        'has_more', (select count(*) > safe_limit from candidates),
        'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
      ) into result;
    end if;

  elsif module_name in ('content_reports', 'reports') then
    with candidates as (
      select
        report.id::text id,
        report.target_type || ' report' label,
        report.reason || ' · ' || coalesce(report.status, 'open') detail,
        report.status,
        report.created_at
      from public.reports report
      where coalesce(report.target_type, '') <> 'direct_message'
        and report.conversation_id is null
        and (page_cursor_created_at is null
          or (report.created_at, report.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, '')))
      order by report.created_at desc, report.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  elsif module_name = 'dm_safety_reports' then
    with candidates as (
      select
        report.id::text id,
        'DM safety report' label,
        report.reason || ' · ' || report.status detail,
        report.status,
        report.created_at
      from public.reports report
      where (
          report.target_type = 'direct_message'
          or report.conversation_id is not null
        )
        and (
          page_cursor_created_at is null
          or (report.created_at, report.id::text) < (page_cursor_created_at, coalesce(page_cursor_id, ''))
        )
      order by report.created_at desc, report.id desc
      limit safe_limit + 1
    ),
    page as (select * from candidates limit safe_limit)
    select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc, id desc) from page), '[]'::jsonb),
      'has_more', (select count(*) > safe_limit from candidates),
      'next_cursor', (select jsonb_build_object('created_at', created_at, 'id', id) from page order by created_at asc, id asc limit 1)
    ) into result;

  else
    raise exception 'ROOT_DASHBOARD_MODULE_INVALID' using errcode = '22023';
  end if;

  return result;
end;
$$;
create or replace function public.get_root_dashboard_command_search_v1(
  query text,
  result_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := lower(trim(coalesce(query, '')));
  safe_limit integer := least(greatest(coalesce(result_limit, 20), 1), 20);
  results jsonb := '[]'::jsonb;
begin
  if not public.has_platform_permission('search.command') then
    raise exception 'APP_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if char_length(q) < 2 then
    return jsonb_build_object('items', '[]'::jsonb, 'query', query, 'limit', safe_limit);
  end if;

  with ticket_hits as (
    select 'support_ticket'::text entity_type, ticket.id::text entity_id,
           ticket.subject label, ticket.ticket_number detail, ticket.created_at
    from public.support_tickets ticket
    where lower(ticket.subject) like '%' || q || '%'
       or lower(ticket.ticket_number) like '%' || q || '%'
    order by ticket.created_at desc
    limit safe_limit
  ),
  campaign_hits as (
    select 'ad_campaign'::text, campaign.id::text, campaign.name, campaign.status, campaign.created_at
    from public.ad_campaigns campaign
    where lower(campaign.name) like '%' || q || '%'
    order by campaign.created_at desc
    limit safe_limit
  ),
  incident_hits as (
    select 'incident'::text, incident.id::text, incident.title, incident.severity, incident.created_at
    from public.platform_incidents incident
    where lower(incident.title) like '%' || q || '%'
    order by incident.created_at desc
    limit safe_limit
  ),
  profile_hits as (
    select 'profile'::text, profile.id::text,
           coalesce(nullif(profile.display_name, ''), profile.username) label,
           '@' || profile.username detail,
           profile.created_at
    from public.profiles profile
    where lower(profile.username) like '%' || q || '%'
       or lower(coalesce(profile.display_name, '')) like '%' || q || '%'
    order by profile.created_at desc
    limit safe_limit
  ),
  community_hits as (
    select 'community'::text, community.id::text, community.name, community.visibility, community.created_at
    from public.communities community
    where lower(community.name) like '%' || q || '%'
    order by community.created_at desc
    limit safe_limit
  ),
  combined as (
    select * from ticket_hits
    union all select * from campaign_hits
    union all select * from incident_hits
    union all select * from profile_hits
    union all select * from community_hits
    order by created_at desc
    limit safe_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'entity_type', entity_type,
    'entity_id', entity_id,
    'label', label,
    'detail', detail,
    'created_at', created_at
  ) order by created_at desc), '[]'::jsonb)
  into results
  from combined;

  return jsonb_build_object(
    'items', results,
    'query', query,
    'limit', safe_limit
  );
end;
$$;
commit;
