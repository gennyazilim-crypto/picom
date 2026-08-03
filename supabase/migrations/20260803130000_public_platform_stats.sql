-- Public website platform statistics.
--
-- The public RPC never reads raw product tables for a visitor. A service-role
-- job refreshes one vetted, aggregate-only snapshot every five minutes after
-- the production data owner has reviewed test, seed, and system exclusions.

begin;

create table if not exists public.platform_stats_exclusions (
  entity_type text not null check (entity_type in ('profile', 'community', 'broadcast')),
  entity_id uuid not null,
  reason text not null check (reason in ('test', 'seed', 'system', 'bot', 'invalid', 'moderation')),
  created_at timestamptz not null default now(),
  primary key (entity_type, entity_id)
);

create table if not exists public.platform_stats_publication_control (
  singleton boolean primary key default true check (singleton),
  source_reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_platform_stats_snapshots (
  singleton boolean primary key default true check (singleton),
  registered_users bigint not null check (registered_users >= 0),
  active_communities bigint not null check (active_communities >= 0),
  published_broadcasts bigint not null check (published_broadcasts >= 0),
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > generated_at)
);

alter table public.platform_stats_exclusions enable row level security;
alter table public.platform_stats_publication_control enable row level security;
alter table public.public_platform_stats_snapshots enable row level security;

revoke all on table public.platform_stats_exclusions from public, anon, authenticated;
revoke all on table public.platform_stats_publication_control from public, anon, authenticated;
revoke all on table public.public_platform_stats_snapshots from public, anon, authenticated;
grant all on table public.platform_stats_exclusions to service_role;
grant all on table public.platform_stats_publication_control to service_role;
grant all on table public.public_platform_stats_snapshots to service_role;

create index if not exists platform_stats_exclusions_entity_idx
  on public.platform_stats_exclusions (entity_type, entity_id);

create or replace function public.approve_public_platform_stats_source()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  reviewed_at timestamptz := now();
begin
  if jwt_role is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  insert into public.platform_stats_publication_control (
    singleton,
    source_reviewed_at,
    updated_at
  ) values (
    true,
    reviewed_at,
    reviewed_at
  )
  on conflict (singleton) do update
    set source_reviewed_at = excluded.source_reviewed_at,
        updated_at = excluded.updated_at;

  return reviewed_at;
end;
$$;

create or replace function public.refresh_public_platform_stats()
returns table (
  registered_users bigint,
  active_communities bigint,
  published_broadcasts bigint,
  generated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  next_registered_users bigint := 0;
  next_active_communities bigint := 0;
  next_published_broadcasts bigint := 0;
  generated_timestamp timestamptz := now();
begin
  if jwt_role is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.platform_stats_publication_control control
    where control.singleton = true
  ) then
    raise exception 'PUBLIC_PLATFORM_STATS_SOURCE_REVIEW_REQUIRED' using errcode = '55000';
  end if;

  select count(*)::bigint
  into next_registered_users
  from public.profiles profile
  where profile.onboarding_completed = true
    and profile.profile_completed_at is not null
    and coalesce(profile.is_deleted, false) = false
    and profile.deletion_requested_at is null
    and coalesce(profile.is_bot, false) = false
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type = 'profile'
        and exclusion.entity_id = profile.id
    );

  select count(*)::bigint
  into next_active_communities
  from public.communities community
  where community.archived_at is null
    and not exists (
      select 1
      from public.community_discovery_reviews review
      where review.community_id = community.id
        and review.status = 'suspended'
    )
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type = 'community'
        and exclusion.entity_id = community.id
    );

  select count(distinct session.id)::bigint
  into next_published_broadcasts
  from public.community_live_screen_sessions session
  join public.communities community on community.id = session.community_id
  where session.status in ('live', 'reconnecting', 'ended')
    and session.started_at is not null
    and community.archived_at is null
    and not exists (
      select 1
      from public.community_discovery_reviews review
      where review.community_id = community.id
        and review.status = 'suspended'
    )
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type = 'broadcast'
        and exclusion.entity_id = session.id
    )
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type = 'community'
        and exclusion.entity_id = community.id
    );

  insert into public.public_platform_stats_snapshots (
    singleton,
    registered_users,
    active_communities,
    published_broadcasts,
    generated_at,
    expires_at,
    updated_at
  ) values (
    true,
    next_registered_users,
    next_active_communities,
    next_published_broadcasts,
    generated_timestamp,
    generated_timestamp + interval '5 minutes',
    generated_timestamp
  )
  on conflict (singleton) do update
    set registered_users = excluded.registered_users,
        active_communities = excluded.active_communities,
        published_broadcasts = excluded.published_broadcasts,
        generated_at = excluded.generated_at,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at;

  return query
  select
    next_registered_users,
    next_active_communities,
    next_published_broadcasts,
    generated_timestamp;
end;
$$;

create or replace function public.get_public_platform_stats()
returns table (
  registered_users bigint,
  active_communities bigint,
  published_broadcasts bigint,
  generated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    snapshot.registered_users,
    snapshot.active_communities,
    snapshot.published_broadcasts,
    snapshot.generated_at
  from public.public_platform_stats_snapshots snapshot
  where snapshot.singleton = true
    and snapshot.expires_at > now();
$$;

revoke all on function public.approve_public_platform_stats_source() from public, anon, authenticated;
revoke all on function public.refresh_public_platform_stats() from public, anon, authenticated;
revoke all on function public.get_public_platform_stats() from public, anon, authenticated;
grant execute on function public.approve_public_platform_stats_source() to service_role;
grant execute on function public.refresh_public_platform_stats() to service_role;
grant execute on function public.get_public_platform_stats() to anon, authenticated;

comment on table public.platform_stats_exclusions is
  'Service-role-only registry for test, seed, system, bot, invalid, and moderation entities excluded from public platform aggregates.';
comment on table public.platform_stats_publication_control is
  'A service-role source review is required before any public platform-statistics snapshot may be generated.';
comment on table public.public_platform_stats_snapshots is
  'Aggregate-only public website statistics. The latest verified snapshot is served for five minutes; no raw product data is exposed.';
comment on function public.approve_public_platform_stats_source() is
  'Service-role-only acknowledgement that production test, seed, and system exclusions have been reviewed before public stats refresh.';
comment on function public.refresh_public_platform_stats() is
  'Service-role-only aggregate refresh. Counts completed non-deleted non-bot profiles, active non-suspended communities, and distinct canonical valid broadcast sessions.';
comment on function public.get_public_platform_stats() is
  'Public parameterless aggregate-only RPC. Returns no row when the vetted five-minute snapshot is unavailable or expired.';

commit;
