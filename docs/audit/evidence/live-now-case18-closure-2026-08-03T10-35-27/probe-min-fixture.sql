begin;
do $smoke$
declare
  run_id text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  instance uuid;
  creator uuid := gen_random_uuid();
  c_live uuid := gen_random_uuid();
  ch_live uuid := gen_random_uuid();
  app uuid := gen_random_uuid();
  badge uuid := gen_random_uuid();
  owner_role uuid;
  step text := 'start';
  badge_n int;
begin
  select id into instance from auth.instances limit 1;
  if instance is null then
    select instance_id into instance from auth.users where instance_id is not null limit 1;
  end if;
  if instance is null then
    instance := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;
  step := 'auth';
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    instance, creator, 'authenticated', 'authenticated',
    'c18m-' || substr(creator::text, 1, 8) || '-' || run_id || '@example.invalid',
    crypt('SmokePass1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );
  step := 'profile';
  insert into public.profiles(id, username, display_name, status)
  values (creator, left('c18m' || replace(creator::text, '-', ''), 24), 'C18M', 'online')
  on conflict (id) do update set username = excluded.username, display_name = excluded.display_name, status = excluded.status, deactivated_at = null, deleted_at = null, deletion_requested_at = null, is_deleted = false;
  step := 'community';
  insert into public.communities(id, owner_id, founder_id, kind, name, description, accent_color, visibility, public_read_enabled)
  values (c_live, creator, creator, 'text', 'C18M ' || run_id, 's', '#007571', 'public', true);
  step := 'roles';
  insert into public.roles(community_id, name, color, level, display_order, permissions, system_key, is_default, permissions_version)
  values (c_live, 'Owner', '#007571', 100, 0, '{"manageCommunity":true,"sendMessages":true}'::jsonb, 'owner', false, 2);
  select id into owner_role from public.roles where community_id = c_live and system_key = 'owner';
  insert into public.channels(id, community_id, name, type, is_private) values (ch_live, c_live, 'voice', 'voice', false);
  insert into public.community_members(community_id, user_id, role_id) values (c_live, creator, owner_role);
  step := 'app';
  insert into public.publisher_applications (
    id, user_id, application_type, status, display_publisher_name, short_bio,
    eligibility_paths, follower_count_at_application, community_member_count_at_application,
    submitted_at, reviewed_at
  ) values (
    app, creator, 'creator', 'approved', 'C18 Creator', repeat('b', 40),
    array['follower_threshold'], 5000, 0, now(), now()
  );
  step := 'pub_profile';
  insert into public.publisher_profiles (user_id, account_kind, status, display_publisher_name, activated_at)
  values (creator, 'creator', 'active', 'C18 Creator', now());
  select count(*)::int into badge_n from public.publisher_badges where user_id = creator;
  step := 'badge_before_' || badge_n::text;
  insert into public.publisher_badges (id, user_id, badge_type, status, approved_at)
  values (badge, creator, 'creator', 'active', now());
  step := 'session';
  insert into public.community_live_screen_sessions (
    id, livekit_room_name, community_id, channel_id, broadcaster_user_id,
    title, category, status, visibility_mode, started_at, last_heartbeat_at,
    moderation_status, client_request_id, language_code, tags, viewer_count
  ) values (
    gen_random_uuid(), 'c18m-ok-' || run_id, c_live, ch_live, creator,
    'C18M Approved Live ' || run_id, 'game', 'live', 'public_discovery', now(), now(),
    'approved', gen_random_uuid(), 'tr', array['c18'], 12
  );
  raise exception 'OK_REACHED';
exception when others then
  raise exception 'FAIL_AT_% :: %', step, SQLERRM;
end;
$smoke$;
rollback;
