-- Publisher / Creator program: applications, eligibility thresholds, badges,
-- profiles, live bans, and Live Now / Go-Live server-side gates.
-- Rule version: v1-5k-followers-or-3k-founder

begin;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into public.platform_permissions (permission_key, label, description) values
  ('publisher.review', 'Publisher review', 'Review Creator/Publisher applications and badges'),
  ('publisher.moderate_live', 'Publisher live moderation', 'Force-end or hide publisher live sessions')
on conflict (permission_key) do nothing;

-- Grant to root_owner / trust_safety_manager style roles when mapping table exists.
insert into public.platform_role_permissions (role_key, permission_key)
select catalog.role_key, perm.permission_key
from public.platform_role_catalog catalog
cross join (values ('publisher.review'), ('publisher.moderate_live')) as perm(permission_key)
where catalog.role_key in ('root_owner', 'platform_admin', 'trust_safety_manager', 'moderator')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.publisher_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  account_kind text not null check (account_kind in ('creator', 'publisher')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'revoked')),
  display_publisher_name text not null check (char_length(btrim(display_publisher_name)) between 2 and 80),
  bio text not null default '' check (char_length(bio) <= 2000),
  categories text[] not null default '{}',
  country_code text not null default '' check (char_length(country_code) <= 8),
  company_name text,
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publisher_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_type text not null
    check (badge_type in ('creator', 'publisher', 'verified_creator', 'verified_publisher')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'revoked', 'expired')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  reason text check (reason is null or char_length(reason) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists publisher_badges_one_active_uidx
  on public.publisher_badges (user_id)
  where status = 'active';

create index if not exists publisher_badges_user_status_idx
  on public.publisher_badges (user_id, status);

create table if not exists public.publisher_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  application_type text not null check (application_type in ('creator', 'publisher')),
  status text not null default 'draft'
    check (status in (
      'draft', 'submitted', 'under_review', 'additional_information_required',
      'approved', 'rejected', 'withdrawn', 'suspended', 'revoked'
    )),
  display_publisher_name text not null check (char_length(btrim(display_publisher_name)) between 2 and 80),
  legal_name text not null default '' check (char_length(legal_name) <= 160),
  country_code text not null default '' check (char_length(country_code) <= 8),
  legal_address text not null default '' check (char_length(legal_address) <= 500),
  categories text[] not null default '{}',
  short_bio text not null default '' check (char_length(short_bio) <= 2000),
  experience_text text not null default '' check (char_length(experience_text) <= 4000),
  stream_types text[] not null default '{}',
  social_links text[] not null default '{}',
  portfolio_links text[] not null default '{}',
  company_name text,
  trade_name text,
  company_registration_number text,
  tax_number text,
  company_country_code text,
  company_address text,
  authorized_person_name text,
  authorized_person_title text,
  corporate_email text,
  website_url text,
  terms_accepted_version text,
  terms_accepted_at timestamptz,
  safety_policy_accepted_version text,
  safety_policy_accepted_at timestamptz,
  eligibility_paths text[] not null default '{}',
  follower_count_at_application integer not null default 0 check (follower_count_at_application >= 0),
  qualified_community_id uuid references public.communities(id) on delete set null,
  community_member_count_at_application integer not null default 0 check (community_member_count_at_application >= 0),
  eligibility_evaluated_at timestamptz,
  eligibility_rule_version text not null default 'v1-5k-followers-or-3k-founder',
  eligibility_risk_status text not null default 'clear'
    check (eligibility_risk_status in ('clear', 'watch', 'review_required', 'blocked')),
  eligibility_metadata jsonb not null default '{}'::jsonb,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  decision_reason text check (decision_reason is null or char_length(decision_reason) <= 2000),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 4000),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publisher_applications_eligibility_snapshot_ck check (
    status in ('draft', 'withdrawn')
    or follower_count_at_application >= 5000
    or community_member_count_at_application >= 3000
  )
);

create unique index if not exists publisher_applications_one_open_uidx
  on public.publisher_applications (user_id)
  where status in ('draft', 'submitted', 'under_review', 'additional_information_required');

create index if not exists publisher_applications_status_idx
  on public.publisher_applications (status, submitted_at desc nulls last);

create table if not exists public.publisher_application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.publisher_applications(id) on delete cascade,
  uploader_user_id uuid not null references public.profiles(id) on delete cascade,
  storage_bucket text not null default 'publisher-application-documents',
  storage_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 240),
  mime_type text not null check (char_length(mime_type) <= 120),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  document_kind text not null default 'supporting'
    check (document_kind in ('identity', 'company', 'authorization', 'supporting')),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create table if not exists public.publisher_review_actions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.publisher_applications(id) on delete cascade,
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (char_length(action) between 2 and 64),
  from_status text,
  to_status text,
  reason text check (reason is null or char_length(reason) <= 2000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.publisher_live_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'lifted')),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  lifted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists publisher_live_bans_active_uidx
  on public.publisher_live_bans (user_id)
  where status = 'active';

create table if not exists public.publisher_stream_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  category text not null default 'other' check (char_length(category) <= 64),
  stream_type text not null default 'live_stream'
    check (stream_type in (
      'live_stream', 'screen_share', 'camera_stream', 'audio_stream',
      'radio', 'podcast_live', 'event_broadcast', 'premiere'
    )),
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'ready', 'cancelled', 'blocked', 'completed')),
  visibility text not null default 'public'
    check (visibility in ('public', 'followers_only', 'subscribers_only', 'unlisted', 'private')),
  scheduled_start_at timestamptz not null,
  scheduled_end_at timestamptz,
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  cover_storage_path text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publisher_stream_schedules_owner_start_idx
  on public.publisher_stream_schedules (owner_user_id, scheduled_start_at);

-- Live session moderation / eligibility columns
alter table public.community_live_screen_sessions
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('approved', 'under_review', 'blocked', 'hidden'));

alter table public.community_live_screen_sessions
  add column if not exists deleted_at timestamptz;

alter table public.community_live_screen_sessions
  add column if not exists hidden_at timestamptz;

-- ---------------------------------------------------------------------------
-- Storage bucket (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'publisher-application-documents',
  'publisher-application-documents',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Read queue (Root ops viewers): may include dashboard.read.
create or replace function public.can_list_publisher_applications()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.is_root_owner()
    or public.is_app_admin()
    or public.has_platform_permission('publisher.review')
    or public.has_platform_permission('dashboard.read'),
    false
  );
$$;

-- Approve / reject / suspend / live ban: never grant via dashboard.read alone.
create or replace function public.can_review_publisher_applications()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.is_root_owner()
    or public.is_app_admin()
    or public.has_platform_permission('publisher.review'),
    false
  );
$$;

revoke all on function public.can_list_publisher_applications() from public, anon;
grant execute on function public.can_list_publisher_applications() to authenticated;
revoke all on function public.can_review_publisher_applications() from public, anon;
grant execute on function public.can_review_publisher_applications() to authenticated;

create or replace function public.publisher_profile_is_active_account(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    left join public.platform_account_restrictions restriction
      on restriction.user_id = profile.id
    where profile.id = target_user_id
      and coalesce(profile.is_bot, false) = false
      and profile.deactivated_at is null
      and profile.deletion_requested_at is null
      and coalesce(profile.is_deleted, false) = false
      and (
        restriction.user_id is null
        or restriction.status in ('active')
        or (
          restriction.status = 'temporarily_banned'
          and coalesce(restriction.expires_at, restriction.restricted_until) is not null
          and coalesce(restriction.expires_at, restriction.restricted_until) <= now()
        )
      )
  );
$$;

revoke all on function public.publisher_profile_is_active_account(uuid) from public, anon;
grant execute on function public.publisher_profile_is_active_account(uuid) to authenticated;

create or replace function public.count_active_publisher_followers(target_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.user_follows follow
  join public.profiles follower on follower.id = follow.follower_id
  left join public.platform_account_restrictions restriction
    on restriction.user_id = follower.id
  where follow.followed_id = target_user_id
    and coalesce(follower.is_bot, false) = false
    and follower.deactivated_at is null
    and follower.deletion_requested_at is null
    and coalesce(follower.is_deleted, false) = false
    and not public.users_are_blocked(target_user_id, follower.id)
    and (
      restriction.user_id is null
      or restriction.status in ('active')
      or (
        restriction.status = 'temporarily_banned'
        and coalesce(restriction.expires_at, restriction.restricted_until) is not null
        and coalesce(restriction.expires_at, restriction.restricted_until) <= now()
      )
    );
$$;

revoke all on function public.count_active_publisher_followers(uuid) from public, anon;
grant execute on function public.count_active_publisher_followers(uuid) to authenticated;

create or replace function public.largest_owned_active_community_stats(target_user_id uuid)
returns table (
  community_id uuid,
  community_name text,
  active_member_count integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    community.id,
    community.name,
    (
      select count(*)::integer
      from public.community_members membership
      join public.profiles member_profile on member_profile.id = membership.user_id
      left join public.platform_account_restrictions restriction
        on restriction.user_id = member_profile.id
      where membership.community_id = community.id
        and coalesce(member_profile.is_bot, false) = false
        and member_profile.deactivated_at is null
        and member_profile.deletion_requested_at is null
        and coalesce(member_profile.is_deleted, false) = false
        and (
          restriction.user_id is null
          or restriction.status in ('active')
          or (
            restriction.status = 'temporarily_banned'
            and coalesce(restriction.expires_at, restriction.restricted_until) is not null
            and coalesce(restriction.expires_at, restriction.restricted_until) <= now()
          )
        )
        and public.is_active_community_media_member(community.id, membership.user_id)
    ) as active_member_count
  from public.communities community
  where community.owner_id = target_user_id
  order by active_member_count desc, community.created_at asc
  limit 1;
$$;

revoke all on function public.largest_owned_active_community_stats(uuid) from public, anon;
grant execute on function public.largest_owned_active_community_stats(uuid) to authenticated;

create or replace function public.user_has_active_publisher_live_ban(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.publisher_live_bans ban
    where ban.user_id = target_user_id
      and ban.status = 'active'
      and (ban.expires_at is null or ban.expires_at > now())
  );
$$;

revoke all on function public.user_has_active_publisher_live_ban(uuid) from public, anon;
grant execute on function public.user_has_active_publisher_live_ban(uuid) to authenticated;

create or replace function public.user_has_active_publisher_badge(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.publisher_badges badge
    where badge.user_id = target_user_id
      and badge.status = 'active'
      and badge.badge_type in ('creator', 'publisher', 'verified_creator', 'verified_publisher')
      and (badge.expires_at is null or badge.expires_at > now())
  );
$$;

revoke all on function public.user_has_active_publisher_badge(uuid) from public, anon;
grant execute on function public.user_has_active_publisher_badge(uuid) to authenticated;

create or replace function public.user_can_broadcast_on_picom_live(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.publisher_profile_is_active_account(target_user_id)
    and exists (
      select 1 from public.publisher_profiles profile
      where profile.user_id = target_user_id
        and profile.status = 'active'
        and profile.account_kind in ('creator', 'publisher')
    )
    and public.user_has_active_publisher_badge(target_user_id)
    and not public.user_has_active_publisher_live_ban(target_user_id)
    and exists (
      select 1 from public.publisher_applications application
      where application.user_id = target_user_id
        and application.status = 'approved'
    );
$$;

revoke all on function public.user_can_broadcast_on_picom_live(uuid) from public, anon;
grant execute on function public.user_can_broadcast_on_picom_live(uuid) to authenticated;

create or replace function public.live_session_is_publisher_discovery_eligible(
  target public.community_live_screen_sessions
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    target.status in ('live', 'reconnecting')
    and coalesce(target.visibility_mode, 'channel_members') = 'public_discovery'
    and coalesce(target.moderation_status, 'approved') = 'approved'
    and target.deleted_at is null
    and target.hidden_at is null
    and public.user_can_broadcast_on_picom_live(target.broadcaster_user_id);
$$;

revoke all on function public.live_session_is_publisher_discovery_eligible(public.community_live_screen_sessions)
  from public, anon;
grant execute on function public.live_session_is_publisher_discovery_eligible(public.community_live_screen_sessions)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Eligibility RPCs
-- ---------------------------------------------------------------------------
create or replace function public.get_publisher_application_eligibility()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  follower_count integer := 0;
  community_row record;
  paths text[] := '{}';
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  follower_count := public.count_active_publisher_followers(actor_id);
  select * into community_row from public.largest_owned_active_community_stats(actor_id);

  if follower_count >= 5000 then
    paths := array_append(paths, 'follower_threshold');
  end if;
  if coalesce(community_row.active_member_count, 0) >= 3000 then
    paths := array_append(paths, 'community_founder_threshold');
  end if;

  return jsonb_build_object(
    'eligible', cardinality(paths) > 0 and public.publisher_profile_is_active_account(actor_id),
    'eligibilityPaths', to_jsonb(paths),
    'activeFollowerCount', follower_count,
    'requiredFollowerCount', 5000,
    'largestOwnedCommunityId', community_row.community_id,
    'largestOwnedCommunityName', community_row.community_name,
    'largestOwnedCommunityActiveMemberCount', coalesce(community_row.active_member_count, 0),
    'requiredCommunityMemberCount', 3000,
    'evaluatedAt', now(),
    'ruleVersion', 'v1-5k-followers-or-3k-founder',
    'accountActive', public.publisher_profile_is_active_account(actor_id),
    'hasActiveLiveBan', public.user_has_active_publisher_live_ban(actor_id)
  );
end;
$$;

revoke all on function public.get_publisher_application_eligibility() from public, anon;
grant execute on function public.get_publisher_application_eligibility() to authenticated;

create or replace function public.submit_publisher_creator_application(
  target_application_type text,
  target_display_publisher_name text,
  target_legal_name text default '',
  target_country_code text default '',
  target_legal_address text default '',
  target_categories text[] default '{}',
  target_short_bio text default '',
  target_experience_text text default '',
  target_stream_types text[] default '{}',
  target_social_links text[] default '{}',
  target_portfolio_links text[] default '{}',
  target_company_name text default null,
  target_trade_name text default null,
  target_company_registration_number text default null,
  target_tax_number text default null,
  target_company_country_code text default null,
  target_company_address text default null,
  target_authorized_person_name text default null,
  target_authorized_person_title text default null,
  target_corporate_email text default null,
  target_website_url text default null,
  target_terms_version text default 'publisher-terms-v1',
  target_safety_policy_version text default 'publisher-safety-v1'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  follower_count integer := 0;
  community_row record;
  paths text[] := '{}';
  created public.publisher_applications%rowtype;
  display_name text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_application_type not in ('creator', 'publisher') then
    raise exception 'PUBLISHER_APPLICATION_TYPE_INVALID' using errcode = '22023';
  end if;
  if not public.publisher_profile_is_active_account(actor_id) then
    raise exception 'PUBLISHER_APPLICATION_NOT_ELIGIBLE' using errcode = '42501';
  end if;
  if public.user_has_active_publisher_live_ban(actor_id) then
    raise exception 'PUBLISHER_APPLICATION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  display_name := left(btrim(coalesce(target_display_publisher_name, '')), 80);
  if char_length(display_name) < 2 then
    raise exception 'PUBLISHER_APPLICATION_FIELDS_INVALID' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(target_short_bio, ''))) < 20 then
    raise exception 'PUBLISHER_APPLICATION_FIELDS_INVALID' using errcode = '22023';
  end if;
  if target_application_type = 'publisher'
     and char_length(btrim(coalesce(target_company_name, ''))) < 2 then
    raise exception 'PUBLISHER_APPLICATION_FIELDS_INVALID' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.publisher_applications
    where user_id = actor_id
      and status in ('draft', 'submitted', 'under_review', 'additional_information_required', 'approved')
  ) then
    raise exception 'PUBLISHER_APPLICATION_ALREADY_OPEN' using errcode = '23505';
  end if;

  -- Ignore any client-supplied counts; recompute inside the transaction.
  follower_count := public.count_active_publisher_followers(actor_id);
  select * into community_row from public.largest_owned_active_community_stats(actor_id);
  if follower_count >= 5000 then
    paths := array_append(paths, 'follower_threshold');
  end if;
  if coalesce(community_row.active_member_count, 0) >= 3000 then
    paths := array_append(paths, 'community_founder_threshold');
  end if;
  if cardinality(paths) = 0 then
    raise exception 'PUBLISHER_APPLICATION_NOT_ELIGIBLE' using errcode = '42501';
  end if;

  insert into public.publisher_applications (
    user_id, application_type, status, display_publisher_name, legal_name, country_code,
    legal_address, categories, short_bio, experience_text, stream_types, social_links,
    portfolio_links, company_name, trade_name, company_registration_number, tax_number,
    company_country_code, company_address, authorized_person_name, authorized_person_title,
    corporate_email, website_url, terms_accepted_version, terms_accepted_at,
    safety_policy_accepted_version, safety_policy_accepted_at, eligibility_paths,
    follower_count_at_application, qualified_community_id, community_member_count_at_application,
    eligibility_evaluated_at, eligibility_rule_version, eligibility_risk_status,
    eligibility_metadata, submitted_at
  ) values (
    actor_id, target_application_type, 'submitted', display_name,
    left(btrim(coalesce(target_legal_name, '')), 160),
    left(btrim(coalesce(target_country_code, '')), 8),
    left(btrim(coalesce(target_legal_address, '')), 500),
    coalesce(target_categories, '{}'),
    left(btrim(coalesce(target_short_bio, '')), 2000),
    left(btrim(coalesce(target_experience_text, '')), 4000),
    coalesce(target_stream_types, '{}'),
    coalesce(target_social_links, '{}'),
    coalesce(target_portfolio_links, '{}'),
    nullif(btrim(coalesce(target_company_name, '')), ''),
    nullif(btrim(coalesce(target_trade_name, '')), ''),
    nullif(btrim(coalesce(target_company_registration_number, '')), ''),
    nullif(btrim(coalesce(target_tax_number, '')), ''),
    nullif(btrim(coalesce(target_company_country_code, '')), ''),
    nullif(btrim(coalesce(target_company_address, '')), ''),
    nullif(btrim(coalesce(target_authorized_person_name, '')), ''),
    nullif(btrim(coalesce(target_authorized_person_title, '')), ''),
    nullif(btrim(coalesce(target_corporate_email, '')), ''),
    nullif(btrim(coalesce(target_website_url, '')), ''),
    coalesce(nullif(btrim(target_terms_version), ''), 'publisher-terms-v1'),
    now(),
    coalesce(nullif(btrim(target_safety_policy_version), ''), 'publisher-safety-v1'),
    now(),
    paths,
    follower_count,
    case when coalesce(community_row.active_member_count, 0) >= 3000 then community_row.community_id else null end,
    coalesce(community_row.active_member_count, 0),
    now(),
    'v1-5k-followers-or-3k-founder',
    'clear',
    jsonb_build_object(
      'eligibility_paths', to_jsonb(paths),
      'active_follower_count', follower_count,
      'qualified_community_id', community_row.community_id,
      'qualified_community_member_count', coalesce(community_row.active_member_count, 0),
      'evaluated_at', now()
    ),
    now()
  )
  returning * into created;

  insert into public.publisher_review_actions (application_id, actor_user_id, action, from_status, to_status, reason)
  values (created.id, actor_id, 'submit', 'draft', 'submitted', 'Applicant submitted application');

  return jsonb_build_object(
    'id', created.id,
    'status', created.status,
    'applicationType', created.application_type,
    'eligibilityPaths', to_jsonb(created.eligibility_paths),
    'followerCountAtApplication', created.follower_count_at_application,
    'communityMemberCountAtApplication', created.community_member_count_at_application,
    'qualifiedCommunityId', created.qualified_community_id,
    'submittedAt', created.submitted_at
  );
end;
$$;

revoke all on function public.submit_publisher_creator_application(
  text, text, text, text, text, text[], text, text, text[], text[], text[],
  text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.submit_publisher_creator_application(
  text, text, text, text, text, text[], text, text, text[], text[], text[],
  text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.get_own_publisher_applications()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', application.id,
      'applicationType', application.application_type,
      'status', application.status,
      'displayPublisherName', application.display_publisher_name,
      'eligibilityPaths', to_jsonb(application.eligibility_paths),
      'followerCountAtApplication', application.follower_count_at_application,
      'communityMemberCountAtApplication', application.community_member_count_at_application,
      'decisionReason', application.decision_reason,
      'submittedAt', application.submitted_at,
      'reviewedAt', application.reviewed_at,
      'createdAt', application.created_at
    ) order by application.created_at desc
  ), '[]'::jsonb)
  from public.publisher_applications application
  where application.user_id = auth.uid();
$$;

revoke all on function public.get_own_publisher_applications() from public, anon;
grant execute on function public.get_own_publisher_applications() to authenticated;

create or replace function public.get_own_publisher_program_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  profile_row public.publisher_profiles%rowtype;
  badge_row public.publisher_badges%rowtype;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  select * into profile_row from public.publisher_profiles where user_id = actor_id;
  select * into badge_row
  from public.publisher_badges
  where user_id = actor_id and status = 'active'
  order by approved_at desc nulls last
  limit 1;
  return jsonb_build_object(
    'canBroadcast', public.user_can_broadcast_on_picom_live(actor_id),
    'profile', case when profile_row.user_id is null then null else jsonb_build_object(
      'accountKind', profile_row.account_kind,
      'status', profile_row.status,
      'displayPublisherName', profile_row.display_publisher_name
    ) end,
    'activeBadge', case when badge_row.id is null then null else jsonb_build_object(
      'id', badge_row.id,
      'badgeType', badge_row.badge_type,
      'status', badge_row.status,
      'approvedAt', badge_row.approved_at,
      'expiresAt', badge_row.expires_at
    ) end,
    'eligibility', public.get_publisher_application_eligibility()
  );
end;
$$;

revoke all on function public.get_own_publisher_program_state() from public, anon;
grant execute on function public.get_own_publisher_program_state() to authenticated;

-- ---------------------------------------------------------------------------
-- Review / approve (atomic)
-- ---------------------------------------------------------------------------
create or replace function public.list_publisher_application_reviews(
  target_status text default null,
  target_type text default null,
  target_eligibility_filter text default null,
  target_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
  lim integer := greatest(1, least(coalesce(target_limit, 50), 100));
begin
  if not public.can_list_publisher_applications() then
    raise exception 'PUBLISHER_REVIEWER_REQUIRED' using errcode = '42501';
  end if;
  if target_status is not null and target_status not in (
    'draft', 'submitted', 'under_review', 'additional_information_required',
    'approved', 'rejected', 'withdrawn', 'suspended', 'revoked'
  ) then
    raise exception 'PUBLISHER_STATUS_INVALID' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(item order by (item ->> 'submittedAt') desc nulls last), '[]'::jsonb)
  into result
  from (
    select jsonb_build_object(
      'id', application.id,
      'userId', application.user_id,
      'displayName', profile.display_name,
      'username', profile.username,
      'applicationType', application.application_type,
      'status', application.status,
      'displayPublisherName', application.display_publisher_name,
      'eligibilityPaths', to_jsonb(application.eligibility_paths),
      'followerCountAtApplication', application.follower_count_at_application,
      'currentFollowerCount', public.count_active_publisher_followers(application.user_id),
      'communityMemberCountAtApplication', application.community_member_count_at_application,
      'currentCommunityMemberCount', coalesce((
        select stats.active_member_count
        from public.largest_owned_active_community_stats(application.user_id) stats
      ), 0),
      'qualifiedCommunityId', application.qualified_community_id,
      'qualifiedCommunityName', community.name,
      'isStillCommunityOwner', community.owner_id = application.user_id,
      'eligibilityRiskStatus', application.eligibility_risk_status,
      'eligibilityMetadata', application.eligibility_metadata,
      'decisionReason', application.decision_reason,
      'internalNotes', application.internal_notes,
      'submittedAt', application.submitted_at,
      'reviewedAt', application.reviewed_at,
      'shortBio', application.short_bio,
      'companyName', application.company_name
    ) as item
    from public.publisher_applications application
    join public.profiles profile on profile.id = application.user_id
    left join public.communities community on community.id = application.qualified_community_id
    where (target_status is null or application.status = target_status)
      and (target_type is null or application.application_type = target_type)
      and (
        target_eligibility_filter is null
        or (target_eligibility_filter = 'follower' and application.eligibility_paths @> array['follower_threshold'])
        or (target_eligibility_filter = 'community' and application.eligibility_paths @> array['community_founder_threshold'])
        or (target_eligibility_filter = 'both'
            and application.eligibility_paths @> array['follower_threshold']
            and application.eligibility_paths @> array['community_founder_threshold'])
        or (target_eligibility_filter = 'below_threshold'
            and public.count_active_publisher_followers(application.user_id) < 5000
            and coalesce((
              select stats.active_member_count from public.largest_owned_active_community_stats(application.user_id) stats
            ), 0) < 3000)
        or (target_eligibility_filter = 'fraud_review' and application.eligibility_risk_status in ('watch', 'review_required', 'blocked'))
      )
    order by application.submitted_at desc nulls last
    limit lim
  ) queue;
  return result;
end;
$$;

revoke all on function public.list_publisher_application_reviews(text, text, text, integer) from public, anon;
grant execute on function public.list_publisher_application_reviews(text, text, text, integer) to authenticated;

create or replace function public.review_publisher_application(
  target_application_id uuid,
  target_decision text,
  target_reason text default null,
  target_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  application_row public.publisher_applications%rowtype;
  badge_type text;
  previous_status text;
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.can_review_publisher_applications() then
    raise exception 'PUBLISHER_REVIEWER_REQUIRED' using errcode = '42501';
  end if;
  if target_decision not in (
    'under_review', 'additional_information_required', 'approved', 'rejected', 'suspended', 'revoked'
  ) then
    raise exception 'PUBLISHER_DECISION_INVALID' using errcode = '22023';
  end if;

  select * into application_row
  from public.publisher_applications
  where id = target_application_id
  for update;
  if not found then
    raise exception 'PUBLISHER_APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  previous_status := application_row.status;
  if target_decision = 'approved' and previous_status not in (
    'submitted', 'under_review', 'additional_information_required'
  ) then
    raise exception 'PUBLISHER_STATUS_TRANSITION_INVALID' using errcode = '22023';
  end if;
  if target_decision in ('rejected', 'under_review', 'additional_information_required')
     and previous_status not in (
       'submitted', 'under_review', 'additional_information_required'
     ) then
    raise exception 'PUBLISHER_STATUS_TRANSITION_INVALID' using errcode = '22023';
  end if;

  update public.publisher_applications
  set status = target_decision,
      reviewer_user_id = actor_id,
      decision_reason = nullif(btrim(coalesce(target_reason, '')), ''),
      internal_notes = coalesce(nullif(btrim(coalesce(target_internal_notes, '')), ''), internal_notes),
      reviewed_at = now(),
      updated_at = now()
  where id = application_row.id
  returning * into application_row;

  if target_decision = 'approved' then
    badge_type := application_row.application_type;
    insert into public.publisher_profiles as profile (
      user_id, account_kind, status, display_publisher_name, bio, categories, country_code,
      company_name, activated_at, updated_at
    ) values (
      application_row.user_id,
      application_row.application_type,
      'active',
      application_row.display_publisher_name,
      application_row.short_bio,
      application_row.categories,
      application_row.country_code,
      application_row.company_name,
      now(),
      now()
    )
    on conflict (user_id) do update
    set account_kind = excluded.account_kind,
        status = 'active',
        display_publisher_name = excluded.display_publisher_name,
        bio = excluded.bio,
        categories = excluded.categories,
        country_code = excluded.country_code,
        company_name = excluded.company_name,
        activated_at = coalesce(profile.activated_at, now()),
        suspended_at = null,
        revoked_at = null,
        updated_at = now();

    update public.publisher_badges
    set status = 'revoked',
        revoked_at = now(),
        updated_at = now(),
        reason = 'Superseded by new approval'
    where user_id = application_row.user_id
      and status = 'active';

    insert into public.publisher_badges (
      user_id, badge_type, status, approved_by, approved_at, reason, metadata
    ) values (
      application_row.user_id,
      badge_type,
      'active',
      actor_id,
      now(),
      coalesce(nullif(btrim(coalesce(target_reason, '')), ''), 'Application approved'),
      jsonb_build_object('applicationId', application_row.id)
    );

    insert into public.notifications (
      recipient_id, actor_id, category, title, preview, context_kind, context_label,
      user_id, source_event_id
    ) values (
      application_row.user_id,
      actor_id,
      'system',
      'Creator/Publisher application approved',
      'Your PICOM ' || application_row.application_type || ' account is now active.',
      'system',
      'Publisher program',
      application_row.user_id,
      'publisher-approved:' || application_row.id::text || ':v1'
    )
    on conflict do nothing;
  elsif target_decision in ('suspended', 'revoked') then
    update public.publisher_profiles
    set status = case when target_decision = 'suspended' then 'suspended' else 'revoked' end,
        suspended_at = case when target_decision = 'suspended' then now() else suspended_at end,
        revoked_at = case when target_decision = 'revoked' then now() else revoked_at end,
        updated_at = now()
    where user_id = application_row.user_id;

    update public.publisher_badges
    set status = case when target_decision = 'suspended' then 'suspended' else 'revoked' end,
        suspended_at = case when target_decision = 'suspended' then now() else suspended_at end,
        revoked_at = case when target_decision = 'revoked' then now() else revoked_at end,
        reason = coalesce(nullif(btrim(coalesce(target_reason, '')), ''), reason),
        updated_at = now()
    where user_id = application_row.user_id
      and status = 'active';

    update public.community_live_screen_sessions
    set status = 'terminated',
        moderation_status = 'hidden',
        hidden_at = now(),
        updated_at = now()
    where broadcaster_user_id = application_row.user_id
      and status in ('starting', 'live', 'reconnecting');

    update public.publisher_stream_schedules
    set status = 'blocked', updated_at = now()
    where owner_user_id = application_row.user_id
      and status in ('draft', 'scheduled', 'ready');
  end if;

  insert into public.publisher_review_actions (
    application_id, actor_user_id, action, from_status, to_status, reason
  ) values (
    application_row.id, actor_id, target_decision, previous_status, target_decision,
    nullif(btrim(coalesce(target_reason, '')), '')
  );

  return jsonb_build_object(
    'id', application_row.id,
    'status', application_row.status,
    'userId', application_row.user_id,
    'reviewedAt', application_row.reviewed_at
  );
end;
$$;

revoke all on function public.review_publisher_application(uuid, text, text, text) from public, anon;
grant execute on function public.review_publisher_application(uuid, text, text, text) to authenticated;

create or replace function public.set_publisher_live_ban(
  target_user_id uuid,
  target_reason text,
  target_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  ban_row public.publisher_live_bans%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not (
    public.is_root_owner()
    or public.has_platform_permission('publisher.moderate_live')
    or public.has_platform_permission('publisher.review')
  ) then
    raise exception 'PUBLISHER_REVIEWER_REQUIRED' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(target_reason, ''))) < 3 then
    raise exception 'PUBLISHER_REASON_REQUIRED' using errcode = '22023';
  end if;

  update public.publisher_live_bans
  set status = 'lifted', lifted_at = now()
  where user_id = target_user_id and status = 'active';

  insert into public.publisher_live_bans (user_id, status, reason, created_by, expires_at)
  values (target_user_id, 'active', btrim(target_reason), actor_id, target_expires_at)
  returning * into ban_row;

  update public.community_live_screen_sessions
  set status = 'terminated',
      moderation_status = 'blocked',
      hidden_at = now(),
      updated_at = now()
  where broadcaster_user_id = target_user_id
    and status in ('starting', 'live', 'reconnecting');

  return jsonb_build_object('id', ban_row.id, 'userId', ban_row.user_id, 'status', ban_row.status);
end;
$$;

revoke all on function public.set_publisher_live_ban(uuid, text, timestamptz) from public, anon;
grant execute on function public.set_publisher_live_ban(uuid, text, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Live Now / Go-Live gates
-- ---------------------------------------------------------------------------
create or replace function public.can_view_live_screen_session(target public.community_live_screen_sessions)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and target.status in ('live', 'reconnecting')
    and target.deleted_at is null
    and target.hidden_at is null
    and coalesce(target.moderation_status, 'approved') = 'approved'
    and public.can_view_channel(target.channel_id)
    and public.is_active_community_media_member(target.community_id, auth.uid())
    and not public.users_are_blocked(auth.uid(), target.broadcaster_user_id)
    and not exists (
      select 1 from public.community_live_hidden_communities hidden
      where hidden.user_id = auth.uid() and hidden.community_id = target.community_id
    )
    and exists (
      select 1
      from public.channels channel
      where channel.id = target.channel_id
        and (
          not channel.is_private
          or public.is_community_owner(channel.community_id)
          or public.has_community_role_level(channel.community_id, 80)
          or public.has_community_permission(channel.community_id, 'viewPrivateChannels')
        )
    )
    and (
      -- Non-discovery sessions keep community ACL visibility for members.
      coalesce(target.visibility_mode, 'channel_members') <> 'public_discovery'
      or public.live_session_is_publisher_discovery_eligible(target)
    );
$$;

revoke all on function public.can_view_live_screen_session(public.community_live_screen_sessions) from public, anon;
grant execute on function public.can_view_live_screen_session(public.community_live_screen_sessions) to authenticated;

create or replace function public.can_start_picom_live_stream(target_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := coalesce(target_user_id, auth.uid());
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if actor_id <> auth.uid()
     and not public.can_review_publisher_applications() then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'allowed', public.user_can_broadcast_on_picom_live(actor_id),
    'accountActive', public.publisher_profile_is_active_account(actor_id),
    'hasActiveBadge', public.user_has_active_publisher_badge(actor_id),
    'hasLiveBan', public.user_has_active_publisher_live_ban(actor_id),
    'hasApprovedApplication', exists (
      select 1 from public.publisher_applications
      where user_id = actor_id and status = 'approved'
    ),
    'profileActive', exists (
      select 1 from public.publisher_profiles
      where user_id = actor_id and status = 'active'
    )
  );
end;
$$;

revoke all on function public.can_start_picom_live_stream(uuid) from public, anon;
grant execute on function public.can_start_picom_live_stream(uuid) to authenticated;

create or replace function public.list_go_live_broadcast_targets()
returns table (
  community_id uuid,
  community_name text,
  community_kind text,
  community_visibility text,
  channel_id uuid,
  channel_name text,
  channel_private boolean,
  can_publish_screen boolean,
  can_publish_audio boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if not public.user_can_broadcast_on_picom_live(actor_id) then
    return;
  end if;

  return query
  select
    community.id,
    community.name,
    community.kind::text,
    coalesce(community.visibility::text, 'private'),
    channel.id,
    channel.name,
    coalesce(channel.is_private, false),
    public.effective_community_permission(community.id, 'shareScreen', 'channel', channel.id),
    public.effective_community_permission(community.id, 'speakInVoice', 'channel', channel.id)
  from public.community_members membership
  join public.communities community on community.id = membership.community_id
  join public.channels channel on channel.community_id = community.id
  where membership.user_id = actor_id
    and channel.type = 'voice'
    and public.is_active_community_media_member(community.id, actor_id)
    and public.can_view_channel(channel.id)
    and public.effective_community_permission(community.id, 'shareScreen', 'channel', channel.id)
  order by community.name asc, channel.name asc;
end;
$$;

revoke all on function public.list_go_live_broadcast_targets() from public, anon;
grant execute on function public.list_go_live_broadcast_targets() to authenticated;

-- Patch start broadcast: drop unguarded 10-param overload, recreate with publisher gate + schedule link
drop function if exists public.start_community_live_screen_broadcast(uuid, uuid, uuid, text, text, text, text, text, text);
drop function if exists public.start_community_live_screen_broadcast(uuid, uuid, uuid, text, text, text, text, text, text, uuid);

create or replace function public.start_community_live_screen_broadcast(
  target_community_id uuid,
  target_channel_id uuid,
  target_client_request_id uuid,
  target_title text,
  target_category text default 'other',
  target_application_name text default '',
  target_description text default '',
  target_language_code text default '',
  target_visibility_mode text default 'channel_members',
  target_schedule_event_id uuid default null
)
returns public.community_live_screen_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  channel_row public.channels%rowtype;
  community_row public.communities%rowtype;
  existing public.community_live_screen_sessions%rowtype;
  result_row public.community_live_screen_sessions%rowtype;
  schedule_row public.community_events%rowtype;
  normalized_title text := public.normalize_live_broadcast_title(target_title);
  normalized_app text := left(btrim(regexp_replace(coalesce(target_application_name, ''), E'[\\u0000-\\u001f\\u007f]', '', 'g')), 120);
  normalized_description text := left(btrim(regexp_replace(coalesce(target_description, ''), E'[\\u0000-\\u001f\\u007f]', '', 'g')), 2000);
  normalized_language text := left(btrim(lower(coalesce(target_language_code, ''))), 16);
  normalized_category text := case
    when target_category in ('game', 'chat', 'education', 'watch_together', 'other') then target_category
    else 'other'
  end;
  normalized_visibility text := case
    when target_visibility_mode in ('channel_members', 'community_members', 'public_discovery') then target_visibility_mode
    else 'channel_members'
  end;
  room_name text;
  meta jsonb := '{}'::jsonb;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not public.user_can_broadcast_on_picom_live(actor_id) then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;
  if target_client_request_id is null then raise exception 'LIVE_REQUEST_INVALID' using errcode = '22023'; end if;
  if char_length(normalized_title) < 2 then raise exception 'LIVE_TITLE_REQUIRED' using errcode = '22023'; end if;

  select * into existing
  from public.community_live_screen_sessions
  where client_request_id = target_client_request_id
  limit 1;
  if found then
    if existing.broadcaster_user_id <> actor_id then
      raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
    end if;
    return existing;
  end if;

  select * into channel_row from public.channels where id = target_channel_id;
  if not found or channel_row.community_id <> target_community_id or channel_row.type <> 'voice' then
    raise exception 'LIVE_CHANNEL_INVALID' using errcode = '22023';
  end if;

  select * into community_row from public.communities where id = target_community_id;
  if not found then raise exception 'LIVE_CHANNEL_INVALID' using errcode = '22023'; end if;

  if not public.is_active_community_media_member(target_community_id, actor_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.can_view_channel(target_channel_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if not public.effective_community_permission(target_community_id, 'shareScreen', 'channel', target_channel_id) then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;

  if normalized_visibility = 'public_discovery'
     and coalesce(community_row.visibility::text, 'private') <> 'public' then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if normalized_visibility = 'community_members' and coalesce(channel_row.is_private, false) then
    normalized_visibility := 'channel_members';
  end if;

  if target_schedule_event_id is not null then
    select * into schedule_row
    from public.community_events
    where id = target_schedule_event_id
    for share;
    if not found
       or schedule_row.created_by <> actor_id
       or schedule_row.event_type <> 'livestream'
       or schedule_row.cancelled_at is not null
       or schedule_row.status not in ('published', 'live') then
      raise exception 'LIVE_SCHEDULE_INVALID' using errcode = '22023';
    end if;
    if schedule_row.community_id is not null and schedule_row.community_id <> target_community_id then
      raise exception 'LIVE_SCHEDULE_INVALID' using errcode = '22023';
    end if;
    if schedule_row.channel_id is not null and schedule_row.channel_id <> target_channel_id then
      raise exception 'LIVE_SCHEDULE_INVALID' using errcode = '22023';
    end if;
    meta := jsonb_build_object('schedule_event_id', target_schedule_event_id::text);
  end if;

  select * into existing
  from public.community_live_screen_sessions
  where channel_id = target_channel_id
    and status in ('starting', 'live', 'reconnecting')
  for update;
  if found then
    if existing.broadcaster_user_id = actor_id and existing.client_request_id = target_client_request_id then
      return existing;
    end if;
    raise exception 'LIVE_SHARE_CONFLICT' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.community_live_screen_sessions
    where broadcaster_user_id = actor_id
      and status in ('starting', 'live', 'reconnecting')
  ) then
    raise exception 'LIVE_SHARE_CONFLICT' using errcode = '23505';
  end if;

  room_name := 'community:' || target_community_id::text || ':voice:' || target_channel_id::text;

  insert into public.community_live_screen_sessions (
    livekit_room_name, community_id, channel_id, broadcaster_user_id,
    title, category, application_name, description, language_code, visibility_mode,
    status, client_request_id, participant_count, last_heartbeat_at, moderation_status, metadata
  ) values (
    room_name, target_community_id, target_channel_id, actor_id,
    normalized_title, normalized_category, normalized_app, normalized_description,
    normalized_language, normalized_visibility,
    'starting', target_client_request_id, 0, now(), 'approved', meta
  )
  returning * into result_row;

  return result_row;
end;
$$;

revoke all on function public.start_community_live_screen_broadcast(uuid, uuid, uuid, text, text, text, text, text, text, uuid)
  from public, anon;
grant execute on function public.start_community_live_screen_broadcast(uuid, uuid, uuid, text, text, text, text, text, text, uuid)
  to authenticated;

create or replace function public.confirm_community_live_screen_broadcast(target_session_id uuid)
returns public.community_live_screen_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  session_row public.community_live_screen_sessions%rowtype;
begin
  if actor_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not public.user_can_broadcast_on_picom_live(actor_id) then
    raise exception 'PUBLISHER_BROADCAST_NOT_ALLOWED' using errcode = '42501';
  end if;

  select * into session_row
  from public.community_live_screen_sessions
  where id = target_session_id
  for update;
  if not found then raise exception 'LIVE_NOT_FOUND' using errcode = 'P0002'; end if;
  if session_row.broadcaster_user_id <> actor_id then
    raise exception 'LIVE_FORBIDDEN' using errcode = '42501';
  end if;
  if session_row.status = 'live' then
    return session_row;
  end if;
  if session_row.status <> 'starting' then
    raise exception 'LIVE_STATE_INVALID' using errcode = '22023';
  end if;
  if coalesce(session_row.moderation_status, 'approved') <> 'approved' then
    raise exception 'LIVE_BLOCKED' using errcode = '42501';
  end if;

  update public.community_live_screen_sessions
  set status = 'live',
      started_at = coalesce(started_at, now()),
      last_heartbeat_at = now(),
      updated_at = now()
  where id = session_row.id
  returning * into session_row;
  return session_row;
end;
$$;

revoke all on function public.confirm_community_live_screen_broadcast(uuid) from public, anon;
grant execute on function public.confirm_community_live_screen_broadcast(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.publisher_profiles enable row level security;
alter table public.publisher_badges enable row level security;
alter table public.publisher_applications enable row level security;
alter table public.publisher_application_documents enable row level security;
alter table public.publisher_review_actions enable row level security;
alter table public.publisher_live_bans enable row level security;
alter table public.publisher_stream_schedules enable row level security;

revoke all on public.publisher_profiles from public, anon, authenticated;
revoke all on public.publisher_badges from public, anon, authenticated;
revoke all on public.publisher_applications from public, anon, authenticated;
revoke all on public.publisher_application_documents from public, anon, authenticated;
revoke all on public.publisher_review_actions from public, anon, authenticated;
revoke all on public.publisher_live_bans from public, anon, authenticated;
revoke all on public.publisher_stream_schedules from public, anon, authenticated;

grant select on public.publisher_profiles to authenticated;
grant select on public.publisher_badges to authenticated;
grant select on public.publisher_applications to authenticated;
grant select on public.publisher_stream_schedules to authenticated;
grant all on public.publisher_profiles to service_role;
grant all on public.publisher_badges to service_role;
grant all on public.publisher_applications to service_role;
grant all on public.publisher_application_documents to service_role;
grant all on public.publisher_review_actions to service_role;
grant all on public.publisher_live_bans to service_role;
grant all on public.publisher_stream_schedules to service_role;

drop policy if exists publisher_profiles_select on public.publisher_profiles;
create policy publisher_profiles_select on public.publisher_profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or status = 'active'
    or public.can_list_publisher_applications()
  );

drop policy if exists publisher_badges_select on public.publisher_badges;
create policy publisher_badges_select on public.publisher_badges
  for select to authenticated
  using (
    user_id = auth.uid()
    or status = 'active'
    or public.can_list_publisher_applications()
  );

drop policy if exists publisher_applications_select on public.publisher_applications;
create policy publisher_applications_select on public.publisher_applications
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_list_publisher_applications()
  );

-- No direct insert/update/delete for authenticated — RPC only.
revoke insert, update, delete on public.publisher_applications from authenticated, anon, public;
revoke insert, update, delete on public.publisher_badges from authenticated, anon, public;
revoke insert, update, delete on public.publisher_profiles from authenticated, anon, public;

drop policy if exists publisher_schedules_select on public.publisher_stream_schedules;
create policy publisher_schedules_select on public.publisher_stream_schedules
  for select to authenticated
  using (
    owner_user_id = auth.uid()
    or (visibility = 'public' and status in ('scheduled', 'ready'))
    or public.can_list_publisher_applications()
  );

drop policy if exists publisher_schedules_owner_write on public.publisher_stream_schedules;
create policy publisher_schedules_owner_write on public.publisher_stream_schedules
  for all to authenticated
  using (
    owner_user_id = auth.uid()
    and public.user_can_broadcast_on_picom_live(auth.uid())
  )
  with check (
    owner_user_id = auth.uid()
    and public.user_can_broadcast_on_picom_live(auth.uid())
  );

grant select, insert, update, delete on public.publisher_stream_schedules to authenticated;

-- Storage RLS for application documents
drop policy if exists publisher_application_documents_select on storage.objects;
drop policy if exists publisher_application_documents_insert on storage.objects;
drop policy if exists publisher_application_documents_owner_select on storage.objects;
drop policy if exists publisher_application_documents_owner_insert on storage.objects;

create policy publisher_application_documents_owner_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'publisher-application-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.can_list_publisher_applications()
    )
  );

create policy publisher_application_documents_owner_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'publisher-application-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1
      from public.publisher_applications application
      where application.user_id = auth.uid()
        and application.status in ('draft', 'submitted', 'under_review', 'additional_information_required')
    )
  );

notify pgrst, 'reload schema';

commit;
