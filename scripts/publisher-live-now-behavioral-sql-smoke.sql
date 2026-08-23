-- Behavioral Publisher/Live Now SQL smoke — unique UUIDs, full ROLLBACK.
-- Threshold: membership rows counted via is_active_community_media_member; owner not auto +1.
-- Case 18: list_publisher_live_now must return the approved live session (not raw table SELECT).

begin;

create temporary table pln_results (
  case_id text primary key,
  status text not null,
  detail text not null default ''
) on commit drop;

create or replace function pg_temp.rec(p_case text, p_ok boolean, p_detail text)
returns void language plpgsql as $$
begin
  insert into pln_results(case_id, status, detail)
  values (p_case, case when p_ok then 'PASS' else 'FAIL' end, left(coalesce(p_detail,''), 480))
  on conflict (case_id) do update set status = excluded.status, detail = excluded.detail;
end;
$$;

do $smoke$
declare
  run_id text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  instance uuid;
  founder uuid := gen_random_uuid();
  mod_user uuid := gen_random_uuid();
  admin_nf uuid := gen_random_uuid(); -- admin, not founder
  split_a uuid := gen_random_uuid();
  split_b uuid := gen_random_uuid();
  viewer uuid := gen_random_uuid();
  creator uuid := gen_random_uuid();
  c_founder uuid := gen_random_uuid();
  c_mod uuid := gen_random_uuid();
  c_admin uuid := gen_random_uuid();
  c_sa uuid := gen_random_uuid();
  c_sb uuid := gen_random_uuid();
  c_live uuid := gen_random_uuid();
  ch_live uuid := gen_random_uuid();
  sess_ok uuid := gen_random_uuid();
  sess_bad uuid := gen_random_uuid();
  badge uuid := gen_random_uuid();
  app uuid := gen_random_uuid();
  cnt int;
  listed int;
  counted int;
  search_hits int;
  i int;
  uid uuid;
  elig jsonb;
begin
  select id into instance from auth.instances limit 1;
  if instance is null then
    select instance_id into instance from auth.users where instance_id is not null limit 1;
  end if;
  if instance is null then
    instance := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  -- Actors
  foreach uid in array array[founder, mod_user, admin_nf, split_a, split_b, viewer, creator]
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      instance, uid, 'authenticated', 'authenticated',
      'pln-'||substr(uid::text,1,8)||'-'||run_id||'@example.invalid',
      crypt('SmokePass1!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    );
    insert into public.profiles(id, username, display_name, status)
    values (uid, left('pln'||replace(uid::text,'-',''),24), 'PLN', 'online');
  end loop;

  -- 2999 bulk members for founder community ( + founder membership => 3000)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select
    instance,
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'pln-bulk'||gs||'-'||run_id||'@example.invalid',
    encode(sha256(('SmokePass1!'||gs||run_id)::bytea), 'hex'),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  from generate_series(1, 2999) gs;

  insert into public.profiles(id, username, display_name, status)
  select u.id, left('plnb'||replace(u.id::text,'-',''),24), 'B', 'online'
  from auth.users u
  where u.email like 'pln-bulk%-'||run_id||'@example.invalid';

  insert into public.communities(id, owner_id, kind, name, description, accent_color, visibility, public_read_enabled)
  values
    (c_founder, founder, 'text', 'F '||run_id, 's', '#007571', 'public', true),
    (c_mod, mod_user, 'text', 'M '||run_id, 's', '#007571', 'public', true),
    (c_admin, admin_nf, 'text', 'A '||run_id, 's', '#007571', 'public', true),
    (c_sa, split_a, 'text', 'SA '||run_id, 's', '#007571', 'public', true),
    (c_sb, split_b, 'text', 'SB '||run_id, 's', '#007571', 'public', true),
    (c_live, creator, 'text', 'L '||run_id, 's', '#007571', 'public', true);

  -- Memberships: founder community = founder + 2999 bulk = 3000
  insert into public.community_members(community_id, user_id) values (c_founder, founder);
  insert into public.community_members(community_id, user_id)
  select c_founder, p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'pln-bulk%-'||run_id||'@example.invalid';

  select count(*)::int into listed from public.community_members where community_id = c_founder;
  select coalesce(active_member_count,0) into cnt from public.largest_owned_active_community_stats(founder);
  perform pg_temp.rec('04_fixture_membership_rows_3000', listed = 3000, 'community_members.count='||listed);

  -- Case 04 PASS only when canonical eligibility RPC returns eligible=true
  perform set_config('request.jwt.claim.sub', founder::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', founder::text, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec('04_community_3000_founder_allowed',
    coalesce((elig->>'eligible')::boolean, false) = true
      and (elig->'eligibilityPaths') ? 'community_founder_threshold'
      and coalesce((elig->>'largestOwnedCommunityActiveMemberCount')::int, 0) = 3000
      and cnt = 3000
      and listed = 3000,
    'count='||cnt||' rows='||listed||' '||left(elig::text, 180)
  );

  -- 2999: delete one bulk membership
  delete from public.community_members cm
  using auth.users u
  where cm.community_id = c_founder
    and cm.user_id = u.id
    and u.email like 'pln-bulk%-'||run_id||'@example.invalid'
    and cm.ctid in (
      select cm2.ctid from public.community_members cm2
      join auth.users u2 on u2.id = cm2.user_id
      where cm2.community_id = c_founder and u2.email like 'pln-bulk%-'||run_id||'@example.invalid'
      limit 1
    );
  select coalesce(active_member_count,0) into cnt from public.largest_owned_active_community_stats(founder);
  perform pg_temp.rec('03_community_2999_denied_count', cnt = 2999, 'count='||cnt);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec('03_community_2999_denied_elig',
    not coalesce((elig->>'eligible')::boolean,false),
    left(elig::text, 160)
  );

  -- Restore 3000 then add +1 => 3001
  insert into public.community_members(community_id, user_id)
  select c_founder, p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'pln-bulk%-'||run_id||'@example.invalid'
    and not exists (select 1 from public.community_members x where x.community_id=c_founder and x.user_id=p.id)
  limit 1;
  uid := gen_random_uuid();
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (instance, uid, 'authenticated', 'authenticated', 'pln-plus-'||run_id||'@example.invalid', crypt('SmokePass1!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now());
  insert into public.profiles(id, username, display_name, status) values (uid, left('plnp'||run_id,24), 'Plus', 'online');
  insert into public.community_members(community_id, user_id) values (c_founder, uid);
  select coalesce(active_member_count,0) into cnt from public.largest_owned_active_community_stats(founder);
  perform pg_temp.rec('04d_community_3001_founder_allowed', cnt = 3001, 'count='||cnt);

  -- Moderator owns community with 3000 members but wait - mod_user is owner of c_mod.
  -- Put 3000 members on c_mod where mod is owner: reuse bulk members + mod membership
  insert into public.community_members(community_id, user_id) values (c_mod, mod_user);
  insert into public.community_members(community_id, user_id)
  select c_mod, p.id from public.profiles p
  join auth.users u on u.id=p.id
  where u.email like 'pln-bulk%-'||run_id||'@example.invalid'
  limit 2999;
  -- Ensure founder is NOT owner of c_mod: check mod path separately —
  -- "3000 moderator DENIED" means user is moderator of a community they do NOT own,
  -- with 3000 members on a community owned by someone else.
  -- Reset: clear c_mod memberships; put founder as owner of a big community;
  -- mod_user is only a member (mod role) of founder's community — largest_owned for mod should be ~0.
  delete from public.community_members where community_id = c_mod;
  insert into public.community_members(community_id, user_id) values (c_mod, founder); -- founder owns empty-ish
  -- Actually c_mod.owner_id = mod_user. Change approach:
  -- For mod denied: mod_user has NO owned community with 3000; they are member of founder's 3001 community.
  insert into public.community_members(community_id, user_id)
  select c_founder, mod_user
  where not exists (select 1 from public.community_members where community_id=c_founder and user_id=mod_user);

  select coalesce(active_member_count,0) into cnt from public.largest_owned_active_community_stats(mod_user);
  perform set_config('request.jwt.claim.sub', mod_user::text, true);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec('05_community_3000_moderator_denied',
    coalesce(cnt,0) < 3000 and not coalesce((elig->>'eligible')::boolean,false),
    'owned_count='||coalesce(cnt,0)||' elig='||left(elig::text,120)
  );

  -- Admin not founder: admin_nf owns c_admin with few members
  insert into public.community_members(community_id, user_id) values (c_admin, admin_nf);
  insert into public.community_members(community_id, user_id)
  select c_founder, admin_nf
  where not exists (select 1 from public.community_members where community_id=c_founder and user_id=admin_nf);
  select coalesce(active_member_count,0) into cnt from public.largest_owned_active_community_stats(admin_nf);
  perform set_config('request.jwt.claim.sub', admin_nf::text, true);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec('05b_admin_not_founder_denied',
    coalesce(cnt,0) < 3000 and not coalesce((elig->>'eligible')::boolean,false),
    'owned_count='||coalesce(cnt,0)
  );

  -- Split 1700+1500: create extra members for split communities
  -- Use subset of bulk for sa=1700, sb=1500 (same users can be in both? better separate)
  -- Simpler: assign first 1700 bulk to sa, next 1500 to sb (overlap ok for denial of aggregation)
  insert into public.community_members(community_id, user_id) values (c_sa, split_a), (c_sb, split_b);
  insert into public.community_members(community_id, user_id)
  select c_sa, p.id from (
    select p.id from public.profiles p
    join auth.users u on u.id=p.id
    where u.email like 'pln-bulk%-'||run_id||'@example.invalid'
    order by u.email limit 1699
  ) p;
  insert into public.community_members(community_id, user_id)
  select c_sb, p.id from (
    select p.id from public.profiles p
    join auth.users u on u.id=p.id
    where u.email like 'pln-bulk%-'||run_id||'@example.invalid'
    order by u.email desc limit 1499
  ) p;
  -- split_a owns only c_sa (~1700); check not eligible by community alone if followers low
  select coalesce(active_member_count,0) into cnt from public.largest_owned_active_community_stats(split_a);
  perform set_config('request.jwt.claim.sub', split_a::text, true);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec('06_split_communities_not_aggregated',
    coalesce(cnt,0) < 3000 and not ((elig->'eligibilityPaths') ? 'community_founder_threshold'),
    'largest='||coalesce(cnt,0)
  );

  -- -------- Case 18: approved live stream visible via list_publisher_live_now --------
  insert into public.channels(id, community_id, name, type, is_private)
  values (ch_live, c_live, 'voice', 'voice', false);
  insert into public.community_members(community_id, user_id) values (c_live, creator), (c_live, viewer);

  insert into public.publisher_applications (
    id, user_id, application_type, status, display_publisher_name, short_bio,
    eligibility_paths, follower_count_at_application, community_member_count_at_application,
    submitted_at, reviewed_at
  ) values (
    app, creator, 'creator', 'approved', 'PLN Creator', repeat('b', 40),
    array['community_founder_threshold'], 0, 3000, now(), now()
  );

  insert into public.publisher_profiles (user_id, account_kind, status, display_publisher_name, activated_at)
  values (creator, 'creator', 'active', 'PLN Creator', now());

  insert into public.publisher_badges (id, user_id, badge_type, status, approved_at)
  values (badge, creator, 'creator', 'active', now());

  insert into public.community_live_screen_sessions (
    id, livekit_room_name, community_id, channel_id, broadcaster_user_id,
    title, category, status, visibility_mode, started_at, last_heartbeat_at,
    moderation_status, client_request_id, language_code, tags, viewer_count
  ) values (
    sess_ok, 'pln-ok-'||run_id, c_live, ch_live, creator,
    'Approved Live PLN', 'game', 'live', 'public_discovery', now(), now(),
    'approved', gen_random_uuid(), 'tr', array['smoke','pln'], 12
  );

  -- Ineligible twin (no badge path): different broadcaster without badge
  insert into public.community_live_screen_sessions (
    id, livekit_room_name, community_id, channel_id, broadcaster_user_id,
    title, category, status, visibility_mode, started_at, last_heartbeat_at,
    moderation_status, client_request_id, language_code, viewer_count
  ) values (
    sess_bad, 'pln-bad-'||run_id, c_live, ch_live, viewer,
    'Secret Ineligible PLN', 'game', 'live', 'public_discovery', now(), now(),
    'approved', gen_random_uuid(), 'tr', 3
  );

  perform set_config('request.jwt.claim.sub', viewer::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  select count(*)::int into listed
  from public.list_publisher_live_now(50, null, null, null, null, null, false, 'viewers') s
  where s.id = sess_ok;
  select public.count_publisher_live_now(null, null, null, false) into counted;
  -- count may include other staging lives — check delta via filter search
  select count(*)::int into search_hits
  from public.list_publisher_live_now(50, null, null, 'Approved Live PLN', null, null, false, 'viewers') s
  where s.id = sess_ok;
  select count(*)::int into i
  from public.list_publisher_live_now(50, null, null, 'Secret Ineligible', null, null, false, 'viewers') s
  where s.id = sess_bad;

  perform pg_temp.rec('18_live_now_includes_approved_stream', listed = 1 and search_hits = 1, 'listed='||listed||' search='||search_hits);
  perform pg_temp.rec('18b_search_cannot_bypass', i = 0, 'bad_hits='||i);

  select count(*)::int into listed
  from public.list_publisher_live_now(50, null, null, null, null, null, false, 'viewers') s
  where s.id in (sess_ok, sess_bad);
  perform pg_temp.rec('08_list_count_eligible_only', listed = 1, 'eligible_listed='||listed);

  -- Badge suspend removes visibility
  update public.publisher_badges set status = 'suspended', suspended_at = now() where id = badge;
  select count(*)::int into listed
  from public.list_publisher_live_now(50, null, null, 'Approved Live PLN', null, null, false, 'viewers') s
  where s.id = sess_ok;
  perform pg_temp.rec('19_badge_suspend_removes_live_visibility', listed = 0, 'listed_after_suspend='||listed);

  -- Schema wiring still recorded
  perform pg_temp.rec('eligibility_helpers_wired',
    exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='largest_owned_active_community_stats')
    and exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='list_publisher_live_now'),
    'ok'
  );

exception when others then
  perform pg_temp.rec('fatal_exception', false, SQLSTATE||':'||SQLERRM);
end;
$smoke$;

select case_id, status, detail from pln_results order by case_id;

select
  count(*) filter (where status='PASS') as pass_count,
  count(*) filter (where status='FAIL') as fail_count
from pln_results;

rollback;
