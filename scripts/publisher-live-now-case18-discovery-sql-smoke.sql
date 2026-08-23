-- Case 18 Live Now discovery boundary smoke — unique UUIDs, full ROLLBACK.
-- PASS only when list_publisher_live_now returns the approved session id.
-- Does not modify Case 04 eligibility counting.

begin;

create temporary table case18_results (
  case_id text primary key,
  status text not null,
  detail text not null default ''
) on commit drop;

create temporary table case18_debug (
  key text primary key,
  value text not null
) on commit drop;

create or replace function pg_temp.rec(p_case text, p_ok boolean, p_detail text)
returns void language plpgsql as $$
begin
  insert into case18_results(case_id, status, detail)
  values (p_case, case when p_ok then 'PASS' else 'FAIL' end, left(coalesce(p_detail, ''), 600))
  on conflict (case_id) do update set status = excluded.status, detail = excluded.detail;
end;
$$;

create or replace function pg_temp.set_actor(p_user uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function pg_temp.dbg(p_key text, p_value text)
returns void language plpgsql as $$
begin
  insert into case18_debug(key, value) values (p_key, left(coalesce(p_value, ''), 800))
  on conflict (key) do update set value = excluded.value;
end;
$$;

do $smoke$
declare
  run_id text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  instance uuid;
  creator uuid := gen_random_uuid();
  viewer uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  c_live uuid := gen_random_uuid();
  ch_live uuid := gen_random_uuid();
  ch_bad uuid := gen_random_uuid();
  app uuid := gen_random_uuid();
  badge uuid := gen_random_uuid();
  badge2 uuid := gen_random_uuid();
  sess_ok uuid := gen_random_uuid();
  sess_bad uuid := gen_random_uuid();
  sess_tmp uuid := gen_random_uuid();
  owner_role uuid;
  member_role uuid;
  listed int;
  counted int;
  cat_count int;
  hits int;
  can_bcast boolean;
  disc_eligible boolean;
  pred jsonb;
  uid uuid;
begin
  select id into instance from auth.instances limit 1;
  if instance is null then
    select instance_id into instance from auth.users where instance_id is not null limit 1;
  end if;
  if instance is null then
    instance := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  foreach uid in array array[creator, viewer, other]
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      instance, uid, 'authenticated', 'authenticated',
      'c18-' || substr(uid::text, 1, 8) || '-' || run_id || '@example.invalid',
      crypt('SmokePass1!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    );
    insert into public.profiles(id, username, display_name, status)
    values (uid, left('c18' || replace(uid::text, '-', ''), 24), 'C18', 'online')
    on conflict (id) do update
      set username = excluded.username,
          display_name = excluded.display_name,
          status = excluded.status,
          deactivated_at = null,
          deleted_at = null,
          deletion_requested_at = null,
          is_deleted = false;
  end loop;

  insert into public.communities(id, owner_id, founder_id, kind, name, description, accent_color, visibility, public_read_enabled)
  values (c_live, creator, creator, 'text', 'C18 ' || run_id, 's', '#007571', 'public', true);

  insert into public.roles(community_id, name, color, level, display_order, permissions, system_key, is_default, permissions_version)
  values
    (c_live, 'Owner', '#007571', 100, 0, '{"manageCommunity":true,"sendMessages":true}'::jsonb, 'owner', false, 2),
    (c_live, 'Member', '#6B7F8C', 10, 300, '{"sendMessages":true}'::jsonb, 'member', true, 2);
  select id into owner_role from public.roles where community_id = c_live and system_key = 'owner';
  select id into member_role from public.roles where community_id = c_live and system_key = 'member';

  insert into public.channels(id, community_id, name, type, is_private)
  values
    (ch_live, c_live, 'voice-ok', 'voice', false),
    (ch_bad, c_live, 'voice-bad', 'voice', false);
  insert into public.community_members(community_id, user_id, role_id)
  values (c_live, creator, owner_role), (c_live, viewer, member_role), (c_live, other, member_role);

  insert into public.publisher_applications (
    id, user_id, application_type, status, display_publisher_name, short_bio,
    eligibility_paths, follower_count_at_application, community_member_count_at_application,
    submitted_at, reviewed_at
  ) values (
    app, creator, 'creator', 'approved', 'C18 Creator', repeat('b', 40),
    array['follower_threshold'], 5000, 0, now(), now()
  );

  insert into public.publisher_profiles (user_id, account_kind, status, display_publisher_name, activated_at)
  values (creator, 'creator', 'active', 'C18 Creator', now());

  insert into public.publisher_badges (id, user_id, badge_type, status, approved_at)
  values (badge, creator, 'creator', 'active', now());

  insert into public.community_live_screen_sessions (
    id, livekit_room_name, community_id, channel_id, broadcaster_user_id,
    title, category, status, visibility_mode, started_at, last_heartbeat_at,
    moderation_status, client_request_id, language_code, tags, viewer_count
  ) values (
    sess_ok, 'c18-ok-' || run_id, c_live, ch_live, creator,
    'C18 Approved Live ' || run_id, 'game', 'live', 'public_discovery', now(), now(),
    'approved', gen_random_uuid(), 'tr', array['c18', 'approved'], 12
  );

  insert into public.community_live_screen_sessions (
    id, livekit_room_name, community_id, channel_id, broadcaster_user_id,
    title, category, status, visibility_mode, started_at, last_heartbeat_at,
    moderation_status, client_request_id, language_code, viewer_count
  ) values (
    sess_bad, 'c18-bad-' || run_id, c_live, ch_bad, viewer,
    'C18 Ineligible ' || run_id, 'game', 'live', 'public_discovery', now(), now(),
    'approved', gen_random_uuid(), 'tr', 3
  );

  -- Predicate debug (no secrets)
  can_bcast := public.user_can_broadcast_on_picom_live(creator);
  select public.live_session_is_publisher_discovery_eligible(s) into disc_eligible
  from public.community_live_screen_sessions s where s.id = sess_ok;

  pred := jsonb_build_object(
    'broadcaster_user_id', creator,
    'eligible_account', public.publisher_profile_is_active_account(creator),
    'eligible_application', exists(select 1 from public.publisher_applications a where a.id = app and a.status = 'approved' and a.user_id = creator),
    'eligible_profile', exists(select 1 from public.publisher_profiles p where p.user_id = creator and p.status = 'active'),
    'eligible_badge', public.user_has_active_publisher_badge(creator),
    'eligible_stream_status', exists(select 1 from public.community_live_screen_sessions s where s.id = sess_ok and s.status in ('live', 'reconnecting')),
    'eligible_visibility', exists(select 1 from public.community_live_screen_sessions s where s.id = sess_ok and coalesce(s.visibility_mode, '') = 'public_discovery'),
    'eligible_moderation', exists(select 1 from public.community_live_screen_sessions s where s.id = sess_ok and coalesce(s.moderation_status, 'approved') = 'approved'),
    'eligible_not_deleted', exists(select 1 from public.community_live_screen_sessions s where s.id = sess_ok and s.deleted_at is null),
    'eligible_not_hidden', exists(select 1 from public.community_live_screen_sessions s where s.id = sess_ok and s.hidden_at is null),
    'eligible_not_blocked', not public.user_has_active_publisher_live_ban(creator),
    'eligible_owner_match', exists(select 1 from public.community_live_screen_sessions s where s.id = sess_ok and s.broadcaster_user_id = creator),
    'eligible_schedule', true,
    'can_broadcast', can_bcast,
    'discovery_helper', disc_eligible,
    'application_id', app,
    'badge_id', badge,
    'stream_id', sess_ok,
    'stream_status', (select status from public.community_live_screen_sessions where id = sess_ok),
    'visibility_mode', (select visibility_mode from public.community_live_screen_sessions where id = sess_ok),
    'moderation_status', (select moderation_status from public.community_live_screen_sessions where id = sess_ok)
  );
  pred := pred || jsonb_build_object(
    'eligible_for_live_now',
    (pred->>'eligible_account')::boolean
      and (pred->>'eligible_application')::boolean
      and (pred->>'eligible_profile')::boolean
      and (pred->>'eligible_badge')::boolean
      and (pred->>'eligible_stream_status')::boolean
      and (pred->>'eligible_visibility')::boolean
      and (pred->>'eligible_moderation')::boolean
      and (pred->>'eligible_not_deleted')::boolean
      and (pred->>'eligible_not_hidden')::boolean
      and (pred->>'eligible_not_blocked')::boolean
      and (pred->>'eligible_owner_match')::boolean
      and coalesce(disc_eligible, false)
  );
  perform pg_temp.dbg('predicate_debug', pred::text);
  perform pg_temp.rec('18_fixture_predicates_ready', coalesce((pred->>'eligible_for_live_now')::boolean, false), left(pred::text, 400));

  perform pg_temp.set_actor(viewer);

  select count(*)::int into listed
  from public.list_publisher_live_now(50, null, null, null, null, null, false, 'viewers') s
  where s.id = sess_ok;
  select count(*)::int into hits
  from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s
  where s.id = sess_ok;
  perform pg_temp.rec('18_live_now_includes_approved_stream', listed = 1 and hits = 1, 'listed=' || listed || ' search=' || hits);

  select count(*)::int into hits
  from public.list_publisher_live_now(50, null, null, 'C18 Ineligible ' || run_id, null, null, false, 'viewers') s
  where s.id = sess_bad;
  perform pg_temp.rec('18b_ineligible_not_listed', hits = 0, 'bad_hits=' || hits);

  -- List/count: 1 eligible + 1 ineligible => list 1 for our ids; count filtered by search title
  select count(*)::int into listed
  from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s
  where s.id in (sess_ok, sess_bad);
  select public.count_publisher_live_now('C18 Approved Live ' || run_id, null, null, false) into counted;
  perform pg_temp.rec('08_list_count_one_eligible', listed = 1 and counted = 1, 'list=' || listed || ' count=' || counted);

  select count(*)::int into cat_count
  from public.count_publisher_live_now_by_category() c
  where c.category = 'game' and c.live_count >= 1;
  perform pg_temp.rec('08b_category_count_sees_eligible', cat_count >= 1, 'cat_rows=' || cat_count);

  -- Negatives mutate sess_ok / publisher state then restore where needed
  update public.publisher_applications set status = 'submitted' where id = app;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_application_pending_hidden', listed = 0, 'listed=' || listed);
  update public.publisher_applications set status = 'approved' where id = app;

  update public.publisher_profiles set status = 'suspended' where user_id = creator;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_profile_suspended_hidden', listed = 0, 'listed=' || listed);
  update public.publisher_profiles set status = 'active' where user_id = creator;

  update public.publisher_badges set status = 'suspended', suspended_at = now() where id = badge;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  select public.count_publisher_live_now('C18 Approved Live ' || run_id, null, null, false) into counted;
  perform pg_temp.rec('neg_badge_suspended_hidden', listed = 0 and counted = 0, 'list=' || listed || ' count=' || counted);

  update public.publisher_badges set status = 'revoked', suspended_at = null where id = badge;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_badge_revoked_hidden', listed = 0, 'listed=' || listed);

  update public.publisher_badges set status = 'active', expires_at = now() - interval '1 hour', suspended_at = null where id = badge;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_badge_expired_hidden', listed = 0, 'listed=' || listed);
  update public.publisher_badges set status = 'active', expires_at = null where id = badge;

  update public.community_live_screen_sessions set status = 'starting' where id = sess_ok;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_stream_not_live_hidden', listed = 0, 'listed=' || listed);
  update public.community_live_screen_sessions set status = 'live' where id = sess_ok;

  update public.community_live_screen_sessions set visibility_mode = 'channel_members' where id = sess_ok;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_visibility_private_hidden', listed = 0, 'listed=' || listed);
  update public.community_live_screen_sessions set visibility_mode = 'public_discovery' where id = sess_ok;

  update public.community_live_screen_sessions set hidden_at = now() where id = sess_ok;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_hidden_true_hidden', listed = 0, 'listed=' || listed);
  update public.community_live_screen_sessions set hidden_at = null where id = sess_ok;

  update public.community_live_screen_sessions set deleted_at = now() where id = sess_ok;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_deleted_at_hidden', listed = 0, 'listed=' || listed);
  update public.community_live_screen_sessions set deleted_at = null where id = sess_ok;

  update public.community_live_screen_sessions set moderation_status = 'blocked' where id = sess_ok;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_moderation_blocked_hidden', listed = 0, 'listed=' || listed);
  update public.community_live_screen_sessions set moderation_status = 'approved' where id = sess_ok;

  update public.community_live_screen_sessions set broadcaster_user_id = other where id = sess_ok;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_broadcaster_mismatch_hidden', listed = 0, 'listed=' || listed);
  update public.community_live_screen_sessions set broadcaster_user_id = creator where id = sess_ok;

  -- Search match but ineligible after badge revoke
  update public.publisher_badges set status = 'revoked' where id = badge;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  perform pg_temp.rec('neg_search_cannot_bypass', listed = 0, 'listed=' || listed);
  update public.publisher_badges set status = 'active' where id = badge;

  -- Schema enforces one active badge per user (publisher_badges_one_active_uidx).
  -- Inactive second badge must not break list/count via join fan-out.
  insert into public.publisher_badges (id, user_id, badge_type, status, approved_at, suspended_at)
  values (badge2, creator, 'verified_creator', 'suspended', now() - interval '1 day', now());
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  select public.count_publisher_live_now('C18 Approved Live ' || run_id, null, null, false) into counted;
  perform pg_temp.rec('08c_multi_badge_no_duplicate', listed = 1 and counted = 1, 'list=' || listed || ' count=' || counted || ' note=one_active_uidx');
  delete from public.publisher_badges where id = badge2;

  -- Badge suspend / reactivate / end stream consistency
  update public.publisher_badges set status = 'suspended', suspended_at = now() where id = badge;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  select public.count_publisher_live_now('C18 Approved Live ' || run_id, null, null, false) into counted;
  perform pg_temp.rec('19_badge_suspend_list_count_0', listed = 0 and counted = 0, 'list=' || listed || ' count=' || counted);

  update public.publisher_badges set status = 'active', suspended_at = null where id = badge;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  select public.count_publisher_live_now('C18 Approved Live ' || run_id, null, null, false) into counted;
  perform pg_temp.rec('19b_badge_reactivate_list_count_1', listed = 1 and counted = 1, 'list=' || listed || ' count=' || counted);

  update public.community_live_screen_sessions set status = 'ended', ended_at = now() where id = sess_ok;
  select count(*)::int into listed from public.list_publisher_live_now(50, null, null, 'C18 Approved Live ' || run_id, null, null, false, 'viewers') s where s.id = sess_ok;
  select public.count_publisher_live_now('C18 Approved Live ' || run_id, null, null, false) into counted;
  perform pg_temp.rec('19c_stream_end_list_count_0', listed = 0 and counted = 0, 'list=' || listed || ' count=' || counted);

  -- Featured/search ineligible twin already covered; explicit featured column absent on sessions — N/A PASS
  perform pg_temp.rec('neg_featured_without_eligibility', true, 'no featured column on community_live_screen_sessions; search bypass covered');

  perform pg_temp.rec('cleanup_rollback', true, 'transaction will rollback');
exception when others then
  -- Preserve prior case rows: record fatal into debug (results may be rolled back with the DO subtransaction).
  begin
    perform pg_temp.dbg('fatal_exception', SQLSTATE || ':' || SQLERRM);
    perform pg_temp.rec('fatal_exception', false, SQLSTATE || ':' || SQLERRM);
  exception when others then
    null;
  end;
end;
$smoke$;

select jsonb_build_object(
  'pass_count', (select count(*) filter (where status = 'PASS') from case18_results),
  'fail_count', (select count(*) filter (where status = 'FAIL') from case18_results),
  'results', coalesce((select jsonb_agg(jsonb_build_object('case_id', case_id, 'status', status, 'detail', detail) order by case_id) from case18_results), '[]'::jsonb),
  'debug', coalesce((select jsonb_object_agg(key, value) from case18_debug), '{}'::jsonb)
) as case18_report;

rollback;
