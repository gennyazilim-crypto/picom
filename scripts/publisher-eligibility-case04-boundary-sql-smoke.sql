-- Publisher eligibility Case 04 boundary smoke (staging schema).
-- Unique UUIDs; full ROLLBACK. PASS for case 04 only when get_publisher_application_eligibility.eligible=true.
-- community_members has no status column; ownership = communities.owner_id.
-- First membership row must be founder with roles.system_key='owner'.

begin;

create temporary table case04_results (
  case_id text primary key,
  status text not null,
  detail text not null default ''
) on commit drop;

create or replace function pg_temp.rec(p_case text, p_ok boolean, p_detail text)
returns void
language plpgsql
as $$
begin
  insert into case04_results(case_id, status, detail)
  values (p_case, case when p_ok then 'PASS' else 'FAIL' end, left(coalesce(p_detail, ''), 500))
  on conflict (case_id) do update set status = excluded.status, detail = excluded.detail;
end;
$$;

create or replace function pg_temp.set_actor(p_user uuid)
returns void
language plpgsql
as $$
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

do $smoke$
declare
  run_id text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  instance uuid;
  founder uuid := gen_random_uuid();
  mod_user uuid := gen_random_uuid();
  admin_nf uuid := gen_random_uuid();
  split_a uuid := gen_random_uuid();
  split_b uuid := gen_random_uuid();
  c_founder uuid := gen_random_uuid();
  c_mod uuid := gen_random_uuid();
  c_admin uuid := gen_random_uuid();
  c_sa uuid := gen_random_uuid();
  c_sb uuid := gen_random_uuid();
  member_rows int;
  active_count int;
  elig jsonb;
  uid uuid;
  def text;
  founder_owner_role uuid;
  founder_member_role uuid;
  founder_mod_role uuid;
  founder_admin_role uuid;
  mod_owner_role uuid;
  admin_owner_role uuid;
  sa_owner_role uuid;
  sa_member_role uuid;
  sb_owner_role uuid;
  sb_member_role uuid;
begin
  select id into instance from auth.instances limit 1;
  if instance is null then
    select instance_id into instance from auth.users where instance_id is not null limit 1;
  end if;
  if instance is null then
    instance := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  select pg_get_functiondef('public.largest_owned_active_community_stats(uuid)'::regprocedure) into def;
  perform pg_temp.rec(
    'schema_no_community_members_status',
    position('community_members.status' in lower(def)) = 0
      and position('membership.status' in lower(def)) = 0
      and lower(def) like '%count(distinct membership.user_id)%'
      and def like '%owner_id%',
    left(def, 220)
  );

  foreach uid in array array[founder, mod_user, admin_nf, split_a, split_b]
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      instance, uid, 'authenticated', 'authenticated',
      'c04-' || substr(uid::text, 1, 8) || '-' || run_id || '@example.invalid',
      crypt('SmokePass1!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
    );
    insert into public.profiles(id, username, display_name, status)
    values (uid, left('c04' || replace(uid::text, '-', ''), 24), 'C04', 'online')
    on conflict (id) do update
      set username = excluded.username,
          display_name = excluded.display_name,
          status = excluded.status,
          deactivated_at = null,
          deleted_at = null,
          deletion_requested_at = null,
          is_deleted = false;
  end loop;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  select
    instance,
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'c04-bulk' || gs || '-' || run_id || '@example.invalid',
    encode(sha256(('SmokePass1!' || gs || run_id)::bytea), 'hex'),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  from generate_series(1, 2999) gs;

  insert into public.profiles(id, username, display_name, status)
  select u.id, left('c04b' || replace(u.id::text, '-', ''), 24), 'B', 'online'
  from auth.users u
  where u.email like 'c04-bulk%-' || run_id || '@example.invalid'
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        status = excluded.status,
        deactivated_at = null,
        deleted_at = null,
        deletion_requested_at = null,
        is_deleted = false;

  insert into public.communities(id, owner_id, founder_id, kind, name, description, accent_color, visibility, public_read_enabled)
  values
    (c_founder, founder, founder, 'text', 'F ' || run_id, 's', '#007571', 'public', true),
    (c_mod, mod_user, mod_user, 'text', 'M ' || run_id, 's', '#007571', 'public', true),
    (c_admin, admin_nf, admin_nf, 'text', 'A ' || run_id, 's', '#007571', 'public', true),
    (c_sa, split_a, split_a, 'text', 'SA ' || run_id, 's', '#007571', 'public', true),
    (c_sb, split_b, split_b, 'text', 'SB ' || run_id, 's', '#007571', 'public', true);

  -- Direct community inserts do not run the create-community template; seed canonical roles.
  insert into public.roles(community_id, name, color, level, display_order, permissions, system_key, is_default, permissions_version)
  select c.id, r.name, r.color, r.level, r.display_order, r.permissions::jsonb, r.system_key, r.is_default, 2
  from (values
    (c_founder), (c_mod), (c_admin), (c_sa), (c_sb)
  ) as c(id)
  cross join (values
    ('Owner', '#007571', 100, 0, '{"manageCommunity":true,"manageChannels":true,"manageRoles":true,"manageMembers":true,"sendMessages":true}'::text, 'owner', false),
    ('Admin', '#4C6EF5', 80, 100, '{"manageMembers":true,"moderateMessages":true,"sendMessages":true}'::text, 'admin', false),
    ('Moderator', '#FAB005', 60, 200, '{"moderateMessages":true,"sendMessages":true}'::text, 'moderator', false),
    ('Member', '#6B7F8C', 10, 300, '{"sendMessages":true}'::text, 'member', true)
  ) as r(name, color, level, display_order, permissions, system_key, is_default);

  select id into founder_owner_role from public.roles where community_id = c_founder and system_key = 'owner';
  select id into founder_member_role from public.roles where community_id = c_founder and system_key = 'member';
  select id into founder_mod_role from public.roles where community_id = c_founder and system_key = 'moderator';
  select id into founder_admin_role from public.roles where community_id = c_founder and system_key = 'admin';
  select id into mod_owner_role from public.roles where community_id = c_mod and system_key = 'owner';
  select id into admin_owner_role from public.roles where community_id = c_admin and system_key = 'owner';
  select id into sa_owner_role from public.roles where community_id = c_sa and system_key = 'owner';
  select id into sa_member_role from public.roles where community_id = c_sa and system_key = 'member';
  select id into sb_owner_role from public.roles where community_id = c_sb and system_key = 'owner';
  select id into sb_member_role from public.roles where community_id = c_sb and system_key = 'member';

  if founder_owner_role is null or founder_member_role is null then
    perform pg_temp.rec('fatal_roles', false, 'seeded owner/member roles missing on c_founder');
    return;
  end if;

  select count(*)::int into member_rows from public.community_members where community_id = c_founder;
  select coalesce(active_member_count, 0) into active_count from public.largest_owned_active_community_stats(founder);
  perform pg_temp.set_actor(founder);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec(
    'owner_without_membership_no_auto_plus_one',
    member_rows = 0 and active_count = 0 and not coalesce((elig->>'eligible')::boolean, false),
    'rows=' || member_rows || ' active=' || active_count || ' elig=' || left(elig::text, 160)
  );

  insert into public.community_members(community_id, user_id, role_id)
  values (c_founder, founder, founder_owner_role);
  insert into public.community_members(community_id, user_id, role_id)
  select c_founder, p.id, founder_member_role
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'c04-bulk%-' || run_id || '@example.invalid';

  select count(*)::int into member_rows from public.community_members where community_id = c_founder;
  perform pg_temp.rec('fixture_exactly_3000_membership_rows', member_rows = 3000, 'community_members.count=' || member_rows);

  select coalesce(active_member_count, 0) into active_count from public.largest_owned_active_community_stats(founder);
  perform pg_temp.set_actor(founder);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec(
    '04_community_3000_founder_allowed',
    coalesce((elig->>'eligible')::boolean, false) = true
      and (elig->'eligibilityPaths') ? 'community_founder_threshold'
      and coalesce((elig->>'largestOwnedCommunityActiveMemberCount')::int, 0) = 3000
      and active_count = 3000
      and member_rows = 3000,
    'eligible=' || coalesce(elig->>'eligible', 'null')
      || ' active=' || active_count
      || ' rows=' || member_rows
      || ' ' || left(elig::text, 180)
  );

  delete from public.community_members cm
  using auth.users u
  where cm.community_id = c_founder
    and cm.user_id = u.id
    and u.email like 'c04-bulk%-' || run_id || '@example.invalid'
    and cm.ctid in (
      select cm2.ctid
      from public.community_members cm2
      join auth.users u2 on u2.id = cm2.user_id
      where cm2.community_id = c_founder
        and u2.email like 'c04-bulk%-' || run_id || '@example.invalid'
      limit 1
    );

  select count(*)::int into member_rows from public.community_members where community_id = c_founder;
  select coalesce(active_member_count, 0) into active_count from public.largest_owned_active_community_stats(founder);
  perform pg_temp.set_actor(founder);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec(
    '03_community_2999_founder_denied',
    member_rows = 2999
      and active_count = 2999
      and not coalesce((elig->>'eligible')::boolean, false)
      and not ((elig->'eligibilityPaths') ? 'community_founder_threshold'),
    'rows=' || member_rows || ' active=' || active_count || ' ' || left(elig::text, 160)
  );

  insert into public.community_members(community_id, user_id, role_id)
  select c_founder, p.id, founder_member_role
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email like 'c04-bulk%-' || run_id || '@example.invalid'
    and not exists (
      select 1 from public.community_members x
      where x.community_id = c_founder and x.user_id = p.id
    )
  limit 1;

  uid := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    instance, uid, 'authenticated', 'authenticated',
    'c04-plus-' || run_id || '@example.invalid',
    crypt('SmokePass1!', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );
  insert into public.profiles(id, username, display_name, status)
  values (uid, left('c04p' || run_id, 24), 'Plus', 'online')
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        status = excluded.status,
        deactivated_at = null,
        deleted_at = null,
        deletion_requested_at = null,
        is_deleted = false;
  insert into public.community_members(community_id, user_id, role_id)
  values (c_founder, uid, founder_member_role);

  select count(*)::int into member_rows from public.community_members where community_id = c_founder;
  select coalesce(active_member_count, 0) into active_count from public.largest_owned_active_community_stats(founder);
  perform pg_temp.set_actor(founder);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec(
    '04d_community_3001_founder_allowed',
    member_rows = 3001
      and active_count = 3001
      and coalesce((elig->>'eligible')::boolean, false) = true
      and (elig->'eligibilityPaths') ? 'community_founder_threshold',
    'rows=' || member_rows || ' active=' || active_count || ' ' || left(elig::text, 160)
  );

  insert into public.community_members(community_id, user_id, role_id)
  select c_founder, mod_user, coalesce(founder_mod_role, founder_member_role)
  where not exists (
    select 1 from public.community_members where community_id = c_founder and user_id = mod_user
  );
  insert into public.community_members(community_id, user_id, role_id)
  values (c_mod, mod_user, mod_owner_role);
  select coalesce(active_member_count, 0) into active_count from public.largest_owned_active_community_stats(mod_user);
  perform pg_temp.set_actor(mod_user);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec(
    '05_community_3000_moderator_denied',
    active_count < 3000
      and not coalesce((elig->>'eligible')::boolean, false)
      and not ((elig->'eligibilityPaths') ? 'community_founder_threshold'),
    'owned_active=' || active_count || ' ' || left(elig::text, 160)
  );

  insert into public.community_members(community_id, user_id, role_id)
  select c_founder, admin_nf, coalesce(founder_admin_role, founder_member_role)
  where not exists (
    select 1 from public.community_members where community_id = c_founder and user_id = admin_nf
  );
  insert into public.community_members(community_id, user_id, role_id)
  values (c_admin, admin_nf, admin_owner_role);
  select coalesce(active_member_count, 0) into active_count from public.largest_owned_active_community_stats(admin_nf);
  perform pg_temp.set_actor(admin_nf);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec(
    '05b_admin_not_founder_denied',
    active_count < 3000
      and not coalesce((elig->>'eligible')::boolean, false)
      and not ((elig->'eligibilityPaths') ? 'community_founder_threshold'),
    'owned_active=' || active_count || ' ' || left(elig::text, 160)
  );

  insert into public.community_members(community_id, user_id, role_id)
  values (c_sa, split_a, sa_owner_role), (c_sb, split_b, sb_owner_role);
  insert into public.community_members(community_id, user_id, role_id)
  select c_sa, p.id, sa_member_role
  from (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email like 'c04-bulk%-' || run_id || '@example.invalid'
    order by u.email
    limit 1699
  ) p;
  insert into public.community_members(community_id, user_id, role_id)
  select c_sb, p.id, sb_member_role
  from (
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email like 'c04-bulk%-' || run_id || '@example.invalid'
    order by u.email desc
    limit 1499
  ) p;

  select coalesce(active_member_count, 0) into active_count from public.largest_owned_active_community_stats(split_a);
  perform pg_temp.set_actor(split_a);
  elig := public.get_publisher_application_eligibility();
  perform pg_temp.rec(
    '06_split_1700_1500_not_aggregated',
    active_count < 3000
      and not ((elig->'eligibilityPaths') ? 'community_founder_threshold')
      and not coalesce((elig->>'eligible')::boolean, false),
    'largest=' || active_count || ' ' || left(elig::text, 160)
  );
end;
$smoke$;

select case_id, status, detail
from case04_results
order by case_id;

rollback;
