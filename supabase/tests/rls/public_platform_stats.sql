-- Public platform-statistics regression coverage.
-- Run against an isolated database after the canonical live-broadcast migrations.

begin;
select plan(32);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token,
  deleted_at, is_anonymous
) values
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-real@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '', null, false),
  ('f1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-incomplete@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '', null, false),
  ('f1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-deleted@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '', now(), false),
  ('f1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-anonymous@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '', null, true),
  ('f1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-profile-deleted@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '', null, false),
  ('f1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-bot@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '', null, false),
  ('f1000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-system@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{"picom_account_kind":"system"}', '{}', now(), now(), '', '', '', '', null, false),
  ('f1000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-excluded@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '', null, false)
on conflict (id) do nothing;

insert into public.profiles (
  id, username, display_name, status, status_text, accent_color,
  onboarding_completed, onboarding_completed_at, profile_completed_at, is_deleted, is_bot, deletion_requested_at
) values
  ('f1000000-0000-4000-8000-000000000001', 'stats-real', 'Stats Real', 'online', 'Fixture', '#007571', true, now(), now(), false, false, null),
  ('f1000000-0000-4000-8000-000000000005', 'stats-profile-deleted', 'Stats Profile Deleted', 'offline', 'Fixture', '#007571', true, now(), now(), true, false, null),
  ('f1000000-0000-4000-8000-000000000006', 'stats-bot', 'Stats Bot', 'offline', 'Fixture', '#007571', true, now(), now(), false, true, null),
  ('f1000000-0000-4000-8000-000000000008', 'stats-excluded', 'Stats Excluded', 'offline', 'Fixture', '#007571', true, now(), now(), false, false, null)
on conflict (id) do update
  set is_deleted = excluded.is_deleted,
      is_bot = excluded.is_bot,
      deletion_requested_at = excluded.deletion_requested_at;

insert into public.communities (id, owner_id, name, description, accent_color, visibility, public_read_enabled, archived_at) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Stats active', 'Fixture', '#007571', 'private', false, null),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'Stats archived', 'Fixture', '#007571', 'private', false, now()),
  ('f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001', 'Stats excluded', 'Fixture', '#007571', 'private', false, null),
  ('f2000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001', 'Stats moderated', 'Fixture', '#007571', 'private', false, null)
on conflict (id) do update set archived_at = excluded.archived_at;

insert into public.channels (id, community_id, name, type, is_private, public_read_enabled, position) values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'stats-live', 'voice', false, false, 1),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'stats-ended', 'voice', false, false, 2),
  ('f3000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000001', 'stats-reconnecting', 'voice', false, false, 3),
  ('f3000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000001', 'stats-starting', 'voice', false, false, 4),
  ('f3000000-0000-4000-8000-000000000005', 'f2000000-0000-4000-8000-000000000001', 'stats-aborted', 'voice', false, false, 5),
  ('f3000000-0000-4000-8000-000000000006', 'f2000000-0000-4000-8000-000000000001', 'stats-excluded', 'voice', false, false, 6),
  ('f3000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000001', 'stats-terminated', 'voice', false, false, 7),
  ('f3000000-0000-4000-8000-000000000008', 'f2000000-0000-4000-8000-000000000001', 'stats-bot-host', 'voice', false, false, 8)
on conflict (id) do nothing;

insert into public.community_live_screen_sessions (
  id, livekit_room_name, community_id, channel_id, broadcaster_user_id,
  title, status, started_at, published_at
) values
  ('f4000000-0000-4000-8000-000000000001', 'stats:live', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Live fixture', 'live', now(), now()),
  ('f4000000-0000-4000-8000-000000000002', 'stats:ended', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'Ended fixture', 'ended', now(), now()),
  ('f4000000-0000-4000-8000-000000000003', 'stats:reconnecting', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001', 'Reconnect fixture', 'reconnecting', now(), now()),
  ('f4000000-0000-4000-8000-000000000004', 'stats:starting', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001', 'Never started fixture', 'starting', now(), null),
  ('f4000000-0000-4000-8000-000000000005', 'stats:aborted', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001', 'Aborted fixture', 'ended', now(), null),
  ('f4000000-0000-4000-8000-000000000006', 'stats:excluded', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000001', 'Excluded fixture', 'ended', now(), now()),
  ('f4000000-0000-4000-8000-000000000007', 'stats:terminated', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000007', 'f1000000-0000-4000-8000-000000000001', 'Terminated fixture', 'terminated', now(), now()),
  ('f4000000-0000-4000-8000-000000000008', 'stats:bot-host', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000008', 'f1000000-0000-4000-8000-000000000006', 'Bot-host fixture', 'ended', now(), now())
on conflict (id) do nothing;

insert into public.platform_stats_exclusions (entity_type, entity_id, reason, source, expires_at) values
  ('user', 'f1000000-0000-4000-8000-000000000008', 'seed', 'fixture source', null),
  ('user', 'f1000000-0000-4000-8000-000000000001', 'test', 'expired fixture', now() - interval '1 minute'),
  ('community', 'f2000000-0000-4000-8000-000000000003', 'seed', 'fixture source', null),
  ('community', 'f2000000-0000-4000-8000-000000000004', 'moderation', 'fixture source', null),
  ('session', 'f4000000-0000-4000-8000-000000000006', 'seed', 'fixture source', null)
on conflict (entity_type, entity_id) do nothing;

select ok(to_regprocedure('public.get_public_platform_stats()') is not null, 'public aggregate RPC exists');
select ok(to_regclass('public.public_platform_stats_snapshots') is not null, 'aggregate snapshot table exists');
select ok(position('published_at' in pg_get_functiondef('public.mark_live_screen_session_published()'::regprocedure)) > 0, 'publication timestamp is maintained by a database trigger');
select ok(not has_table_privilege('anon', 'public.public_platform_stats_snapshots', 'select'), 'anon cannot select snapshot rows directly');
select ok(not has_table_privilege('anon', 'public.platform_stats_exclusions', 'select'), 'anon cannot inspect exclusion records');
select ok(not has_table_privilege('anon', 'auth.users', 'select'), 'anon cannot query raw auth users');
select ok(not has_function_privilege('anon', 'public.approve_public_platform_stats_source()', 'execute'), 'anon cannot approve sources');
select ok(not has_function_privilege('anon', 'public.refresh_public_platform_stats()', 'execute'), 'anon cannot refresh statistics');
select ok(not has_function_privilege('anon', 'public.refresh_public_platform_stats_internal()', 'execute'), 'anon cannot invoke the private aggregate worker');
select ok(not has_function_privilege('anon', 'public.refresh_public_platform_stats_from_scheduler()', 'execute'), 'anon cannot invoke the scheduler worker');
select ok(has_function_privilege('anon', 'public.get_public_platform_stats()', 'execute'), 'anon can call only the aggregate RPC');
select unlike(pg_get_functiondef('public.get_public_platform_stats()'::regprocedure), '%auth.users%', 'public RPC does not read raw auth rows');
select unlike(pg_get_functiondef('public.get_public_platform_stats()'::regprocedure), '%profiles%', 'public RPC does not read profile rows');

select set_config('request.jwt.claim.role', 'service_role', true);
select throws_like(
  $$select public.refresh_public_platform_stats()$$,
  '%PUBLIC_PLATFORM_STATS_SOURCE_REVIEW_REQUIRED%',
  'a source review is required before the first snapshot'
);
select lives_ok($$select public.approve_public_platform_stats_source()$$, 'service role can record a source review');
select is((select registered_users from public.refresh_public_platform_stats()), 2::bigint, 'counts real auth registrations including the incomplete profile');
select is((select active_communities from public.public_platform_stats_snapshots where singleton), 1::bigint, 'counts distinct active communities and excludes archived or reviewed exclusions');
select is((select published_broadcasts from public.public_platform_stats_snapshots where singleton), 3::bigint, 'baseline excludes unstarted draft or scheduled sessions, cancelled or rejected ended sessions without publication evidence, terminated sessions, exclusions, and bot hosts');
select is((select calculation_version from public.public_platform_stats_snapshots where singleton), '2026-08-03.1', 'snapshot records its calculation version');
select like(pg_get_functiondef('public.refresh_public_platform_stats_internal()'::regprocedure), '%count(distinct session.id)%', 'broadcast aggregate uses the canonical distinct session identity');
select like(pg_get_functiondef('public.refresh_public_platform_stats_internal()'::regprocedure), '%pg_advisory_xact_lock%', 'refresh serializes concurrent writers with an advisory transaction lock');

update public.community_live_screen_sessions
set status = 'live'
where id = 'f4000000-0000-4000-8000-000000000004';

select ok(
  (select published_at is not null from public.community_live_screen_sessions where id = 'f4000000-0000-4000-8000-000000000004'),
  'the first confirmed live transition records a publication timestamp'
);
select is((select published_broadcasts from public.refresh_public_platform_stats()), 4::bigint, 'the first confirmed broadcast transition increments the count by one');

update public.community_live_screen_sessions
set status = 'reconnecting'
where id = 'f4000000-0000-4000-8000-000000000004';

select is((select published_broadcasts from public.refresh_public_platform_stats()), 4::bigint, 'reconnect leaves the published broadcast count unchanged');
select is(
  (select count(*) from public.community_live_screen_sessions where id = 'f4000000-0000-4000-8000-000000000004'),
  1::bigint,
  'reconnect keeps the canonical broadcast on the same session row'
);

update public.community_live_screen_sessions
set status = 'ended'
where id = 'f4000000-0000-4000-8000-000000000004';

select is((select published_broadcasts from public.refresh_public_platform_stats()), 4::bigint, 'ended retains the published broadcast count');
select ok(
  (select published_at is not null from public.community_live_screen_sessions where id = 'f4000000-0000-4000-8000-000000000004'),
  'ended retains the original publication evidence on the canonical session'
);

set local role anon;
select is((select count(*) from public.get_public_platform_stats()), 1::bigint, 'anon receives exactly one fresh aggregate row');
select is((select count(*) from public.get_public_platform_stats() as stats where stats.registered_users = 2 and stats.active_communities = 1 and stats.published_broadcasts = 4), 1::bigint, 'anon receives validated aggregate values only');
reset role;

create or replace function public.platform_stats_test_fail_snapshot_write()
returns trigger
language plpgsql
as $$
begin
  raise exception 'TEST_SNAPSHOT_WRITE_FAILURE';
end;
$$;
create trigger trg_platform_stats_test_fail_snapshot_write
before update on public.public_platform_stats_snapshots
for each row execute function public.platform_stats_test_fail_snapshot_write();

select throws_like(
  $$select public.refresh_public_platform_stats()$$,
  '%TEST_SNAPSHOT_WRITE_FAILURE%',
  'a failed refresh reports the write failure'
);
select is((select registered_users from public.public_platform_stats_snapshots where singleton), 2::bigint, 'a failed refresh keeps the last known good snapshot');

drop trigger trg_platform_stats_test_fail_snapshot_write on public.public_platform_stats_snapshots;
drop function public.platform_stats_test_fail_snapshot_write();

update public.public_platform_stats_snapshots
set expires_at = now() - interval '1 second'
where singleton;

set local role anon;
select is((select count(*) from public.get_public_platform_stats()), 0::bigint, 'expired snapshots are unavailable rather than served as stale values');
reset role;

select * from finish();
rollback;
