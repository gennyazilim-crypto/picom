-- Public platform statistics aggregate and exposure regression coverage.
-- Run against an isolated database after all migrations.

begin;
select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  ('f1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-real@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('f1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-deleted@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('f1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-bot@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('f1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-seed@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', ''),
  ('f1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stats-incomplete@picom.local', crypt('PicomTest123!', gen_salt('bf')), now(), '{}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (
  id, username, display_name, status, status_text, accent_color,
  onboarding_completed, onboarding_completed_at, profile_completed_at, is_deleted, is_bot, deletion_requested_at
) values
  ('f1000000-0000-4000-8000-000000000001', 'stats-real', 'Stats Real', 'online', 'Fixture', '#007571', true, now(), now(), false, false, null),
  ('f1000000-0000-4000-8000-000000000002', 'stats-deleted', 'Stats Deleted', 'offline', 'Fixture', '#007571', true, now(), now(), true, false, null),
  ('f1000000-0000-4000-8000-000000000003', 'stats-bot', 'Stats Bot', 'offline', 'Fixture', '#007571', true, now(), now(), false, true, null),
  ('f1000000-0000-4000-8000-000000000004', 'stats-seed', 'Stats Seed', 'offline', 'Fixture', '#007571', true, now(), now(), false, false, null),
  ('f1000000-0000-4000-8000-000000000005', 'stats-incomplete', 'Stats Incomplete', 'offline', 'Fixture', '#007571', false, null, null, false, false, null)
on conflict (id) do update
  set onboarding_completed = excluded.onboarding_completed,
      onboarding_completed_at = excluded.onboarding_completed_at,
      profile_completed_at = excluded.profile_completed_at,
      is_deleted = excluded.is_deleted,
      is_bot = excluded.is_bot,
      deletion_requested_at = excluded.deletion_requested_at;

insert into public.communities (id, owner_id, name, description, accent_color, visibility, public_read_enabled, archived_at) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Stats active', 'Fixture', '#007571', 'private', false, null),
  ('f2000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'Stats archived', 'Fixture', '#007571', 'private', false, now()),
  ('f2000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001', 'Stats suspended', 'Fixture', '#007571', 'private', false, null),
  ('f2000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001', 'Stats seed', 'Fixture', '#007571', 'private', false, null);

insert into public.community_discovery_reviews (community_id, status) values
  ('f2000000-0000-4000-8000-000000000003', 'suspended');

insert into public.channels (id, community_id, name, type, is_private, public_read_enabled, position) values
  ('f3000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'stats-live', 'voice', false, false, 1),
  ('f3000000-0000-4000-8000-000000000002', 'f2000000-0000-4000-8000-000000000001', 'stats-ended', 'voice', false, false, 2),
  ('f3000000-0000-4000-8000-000000000003', 'f2000000-0000-4000-8000-000000000001', 'stats-reconnecting', 'voice', false, false, 3),
  ('f3000000-0000-4000-8000-000000000004', 'f2000000-0000-4000-8000-000000000001', 'stats-starting', 'voice', false, false, 4),
  ('f3000000-0000-4000-8000-000000000005', 'f2000000-0000-4000-8000-000000000001', 'stats-terminated', 'voice', false, false, 5),
  ('f3000000-0000-4000-8000-000000000006', 'f2000000-0000-4000-8000-000000000001', 'stats-seed-broadcast', 'voice', false, false, 6);

insert into public.community_live_screen_sessions (
  id, livekit_room_name, community_id, channel_id, broadcaster_user_id, title, status, started_at
) values
  ('f4000000-0000-4000-8000-000000000001', 'stats:live', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Live fixture', 'live', now()),
  ('f4000000-0000-4000-8000-000000000002', 'stats:ended', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'Ended fixture', 'ended', now()),
  ('f4000000-0000-4000-8000-000000000003', 'stats:reconnecting', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000001', 'Reconnect fixture', 'reconnecting', now()),
  ('f4000000-0000-4000-8000-000000000004', 'stats:starting', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000001', 'Never started fixture', 'starting', now()),
  ('f4000000-0000-4000-8000-000000000005', 'stats:terminated', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001', 'Moderated fixture', 'terminated', now()),
  ('f4000000-0000-4000-8000-000000000006', 'stats:seed', 'f2000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000001', 'Seed fixture', 'ended', now());

insert into public.platform_stats_exclusions (entity_type, entity_id, reason) values
  ('profile', 'f1000000-0000-4000-8000-000000000004', 'seed'),
  ('community', 'f2000000-0000-4000-8000-000000000004', 'seed'),
  ('broadcast', 'f4000000-0000-4000-8000-000000000006', 'seed');

select ok(to_regprocedure('public.get_public_platform_stats()') is not null, 'public aggregate RPC exists');
select ok(not has_table_privilege('anon', 'public.public_platform_stats_snapshots', 'select'), 'anon cannot select aggregate snapshot rows directly');
select ok(not has_table_privilege('anon', 'public.platform_stats_exclusions', 'select'), 'anon cannot inspect exclusion records');
select ok(not has_function_privilege('anon', 'public.refresh_public_platform_stats()', 'execute'), 'anon cannot refresh stats');
select ok(has_function_privilege('anon', 'public.get_public_platform_stats()', 'execute'), 'anon can call only the aggregate RPC');
select like(pg_get_functiondef('public.get_public_platform_stats()'::regprocedure), '%registered_users%', 'aggregate RPC returns only named count columns');

select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok($$select public.approve_public_platform_stats_source()$$, 'service role can approve reviewed sources');
select is((select registered_users from public.refresh_public_platform_stats()), 1::bigint, 'counts only completed, active, non-deleted, non-bot, non-seed profiles');
select is((select active_communities from public.public_platform_stats_snapshots where singleton), 1::bigint, 'excludes archived, suspended, and seed communities while including private communities');
select is((select published_broadcasts from public.public_platform_stats_snapshots where singleton), 3::bigint, 'counts distinct valid canonical sessions and excludes starting, terminated, and seed sessions');
select like(pg_get_functiondef('public.refresh_public_platform_stats()'::regprocedure), '%count(distinct session.id)%', 'broadcast aggregate uses the canonical distinct session id');

set local role anon;
select is((select count(*) from public.get_public_platform_stats()), 1::bigint, 'anon receives one aggregate-only snapshot row');
select is((select count(*) from public.get_public_platform_stats() as stats where stats.registered_users = 1 and stats.active_communities = 1 and stats.published_broadcasts = 3), 1::bigint, 'anon receives validated aggregate values only');
reset role;

select set_config('request.jwt.claim.role', 'anon', true);
select throws_like(
  $$select public.refresh_public_platform_stats()$$,
  '%SERVICE_ROLE_REQUIRED%',
  'non-service role cannot refresh public statistics'
);

select ok(
  not exists (
    select 1
    from public.get_public_platform_stats() stats
    where stats.generated_at <= now() - interval '5 minutes'
  ),
  'expired snapshots are not served publicly'
);

select * from finish();
rollback;
