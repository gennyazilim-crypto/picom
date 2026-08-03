-- Aggregate-only public platform statistics for picom.gg.
--
-- Prerequisites: the canonical profile, community, and community live-screen
-- session migrations must already be applied. This migration intentionally
-- refuses to infer a broadcast from a merely-created `starting` session.

begin;

do $$
begin
  if to_regclass('auth.users') is null
    or to_regclass('public.profiles') is null
    or to_regclass('public.communities') is null
    or to_regclass('public.community_live_screen_sessions') is null then
    raise exception 'PUBLIC_PLATFORM_STATS_PREREQUISITE_SCHEMA_MISSING'
      using errcode = '55000',
            hint = 'Apply the canonical profile, community, and live broadcast migrations before this migration.';
  end if;
end;
$$;

create table if not exists public.platform_stats_exclusions (
  entity_type text not null check (entity_type in ('user', 'community', 'broadcast', 'session')),
  entity_id uuid not null,
  reason text not null check (reason in ('test', 'seed', 'system', 'bot', 'internal', 'invalid', 'moderation')),
  source text not null default 'manual_review' check (char_length(btrim(source)) between 3 and 120),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  primary key (entity_type, entity_id),
  check (expires_at is null or expires_at > created_at)
);

create table if not exists public.platform_stats_publication_control (
  singleton boolean primary key default true check (singleton),
  source_reviewed_at timestamptz not null,
  source_reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_platform_stats_snapshots (
  singleton boolean primary key default true check (singleton),
  registered_users bigint not null check (registered_users >= 0),
  active_communities bigint not null check (active_communities >= 0),
  published_broadcasts bigint not null check (published_broadcasts >= 0),
  calculation_version text not null check (char_length(calculation_version) between 1 and 80),
  generated_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > generated_at)
);

alter table public.community_live_screen_sessions
  add column if not exists published_at timestamptz;

create or replace function public.mark_live_screen_session_published()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.status in ('live', 'reconnecting') then
    new.published_at := coalesce(
      new.published_at,
      case when tg_op = 'UPDATE' then old.published_at else null end,
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mark_live_screen_session_published on public.community_live_screen_sessions;
create trigger trg_mark_live_screen_session_published
before insert or update of status on public.community_live_screen_sessions
for each row execute function public.mark_live_screen_session_published();

-- Legacy rows receive a publication timestamp only when the canonical event
-- linkage proves that the session previously transitioned to a public live
-- broadcast. Old ended rows without that evidence remain out of the count.
update public.community_live_screen_sessions session
set published_at = coalesce(linked_event.updated_at, linked_event.starts_at, session.started_at)
from lateral (
  select event.updated_at, event.starts_at
  from public.community_events event
  where (event.metadata ->> 'live_session_id') = session.id::text
    and event.event_type = 'livestream'
    and event.cancelled_at is null
    and event.status::text in ('live', 'completed')
  order by event.updated_at asc nulls last, event.starts_at asc nulls last
  limit 1
) linked_event
where session.published_at is null
  and session.status in ('live', 'reconnecting', 'ended');

create index if not exists community_live_screen_sessions_public_stats_idx
  on public.community_live_screen_sessions (status, published_at, community_id)
  where published_at is not null
    and status in ('live', 'reconnecting', 'ended');

create index if not exists platform_stats_exclusions_active_idx
  on public.platform_stats_exclusions (entity_type, entity_id, expires_at);

alter table public.platform_stats_exclusions enable row level security;
alter table public.platform_stats_publication_control enable row level security;
alter table public.public_platform_stats_snapshots enable row level security;

revoke all on table public.platform_stats_exclusions from public, anon, authenticated;
revoke all on table public.platform_stats_publication_control from public, anon, authenticated;
revoke all on table public.public_platform_stats_snapshots from public, anon, authenticated;
grant all on table public.platform_stats_exclusions to service_role;
grant all on table public.platform_stats_publication_control to service_role;
grant all on table public.public_platform_stats_snapshots to service_role;

create or replace function public.require_platform_stats_service_role()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if jwt_role <> 'service_role' and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.approve_public_platform_stats_source()
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  reviewed_at timestamptz := clock_timestamp();
begin
  perform public.require_platform_stats_service_role();

  insert into public.platform_stats_publication_control (
    singleton,
    source_reviewed_at,
    source_reviewed_by,
    updated_at
  ) values (
    true,
    reviewed_at,
    auth.uid(),
    reviewed_at
  )
  on conflict (singleton) do update
    set source_reviewed_at = excluded.source_reviewed_at,
        source_reviewed_by = excluded.source_reviewed_by,
        updated_at = excluded.updated_at;

  return reviewed_at;
end;
$$;

create or replace function public.refresh_public_platform_stats_internal()
returns table (
  registered_users bigint,
  active_communities bigint,
  published_broadcasts bigint,
  generated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  next_registered_users bigint := 0;
  next_active_communities bigint := 0;
  next_published_broadcasts bigint := 0;
  generated_timestamp timestamptz := clock_timestamp();
  version_constant constant text := '2026-08-03.1';
begin
  perform pg_advisory_xact_lock(hashtextextended('public.refresh_public_platform_stats', 0));

  if not exists (
    select 1
    from public.platform_stats_publication_control control
    where control.singleton = true
  ) then
    raise exception 'PUBLIC_PLATFORM_STATS_SOURCE_REVIEW_REQUIRED' using errcode = '55000';
  end if;

  -- auth.users is the registration authority. The profile projection is only
  -- consulted for explicit deletion and bot flags, so incomplete profiles count.
  select count(distinct account.id)::bigint
  into next_registered_users
  from auth.users account
  left join public.profiles profile on profile.id = account.id
  where account.deleted_at is null
    and coalesce(account.is_anonymous, false) = false
    and coalesce(profile.is_deleted, false) = false
    and profile.deletion_requested_at is null
    and coalesce(profile.is_bot, false) = false
    and lower(coalesce(account.raw_app_meta_data ->> 'picom_account_kind', '')) not in ('test', 'seed', 'system', 'bot', 'internal')
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type = 'user'
        and exclusion.entity_id = account.id
        and (exclusion.expires_at is null or exclusion.expires_at > generated_timestamp)
    );

  -- The canonical community lifecycle exposes archive state. Discovery review
  -- status is intentionally not treated as a platform-wide suspension state.
  select count(distinct community.id)::bigint
  into next_active_communities
  from public.communities community
  where community.archived_at is null
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type = 'community'
        and exclusion.entity_id = community.id
        and (exclusion.expires_at is null or exclusion.expires_at > generated_timestamp)
    );

  -- `community_live_screen_sessions.id` is the canonical broadcast identity.
  -- Reconnects update the same session, so DISTINCT id prevents double count.
  select count(distinct session.id)::bigint
  into next_published_broadcasts
  from public.community_live_screen_sessions session
  join public.communities community on community.id = session.community_id
  join auth.users broadcaster on broadcaster.id = session.broadcaster_user_id
  left join public.profiles broadcaster_profile on broadcaster_profile.id = broadcaster.id
  where session.status in ('live', 'reconnecting', 'ended')
    and session.published_at is not null
    and community.archived_at is null
    and broadcaster.deleted_at is null
    and coalesce(broadcaster.is_anonymous, false) = false
    and coalesce(broadcaster_profile.is_deleted, false) = false
    and broadcaster_profile.deletion_requested_at is null
    and coalesce(broadcaster_profile.is_bot, false) = false
    and lower(coalesce(broadcaster.raw_app_meta_data ->> 'picom_account_kind', '')) not in ('test', 'seed', 'system', 'bot', 'internal')
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type = 'community'
        and exclusion.entity_id = community.id
        and (exclusion.expires_at is null or exclusion.expires_at > generated_timestamp)
    )
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type in ('broadcast', 'session')
        and exclusion.entity_id = session.id
        and (exclusion.expires_at is null or exclusion.expires_at > generated_timestamp)
    )
    and not exists (
      select 1
      from public.platform_stats_exclusions exclusion
      where exclusion.entity_type = 'user'
        and exclusion.entity_id = session.broadcaster_user_id
        and (exclusion.expires_at is null or exclusion.expires_at > generated_timestamp)
    );

  insert into public.public_platform_stats_snapshots (
    singleton,
    registered_users,
    active_communities,
    published_broadcasts,
    calculation_version,
    generated_at,
    expires_at,
    updated_at
  ) values (
    true,
    next_registered_users,
    next_active_communities,
    next_published_broadcasts,
    version_constant,
    generated_timestamp,
    generated_timestamp + interval '5 minutes',
    generated_timestamp
  )
  on conflict (singleton) do update
    set registered_users = excluded.registered_users,
        active_communities = excluded.active_communities,
        published_broadcasts = excluded.published_broadcasts,
        calculation_version = excluded.calculation_version,
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

create or replace function public.refresh_public_platform_stats()
returns table (
  registered_users bigint,
  active_communities bigint,
  published_broadcasts bigint,
  generated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  perform public.require_platform_stats_service_role();
  return query select * from public.refresh_public_platform_stats_internal();
end;
$$;

create or replace function public.refresh_public_platform_stats_from_scheduler()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  -- Do not manufacture a first snapshot before the source review is recorded.
  if exists (
    select 1
    from public.platform_stats_publication_control control
    where control.singleton = true
  ) then
    perform public.refresh_public_platform_stats_internal();
  end if;
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
set search_path = pg_catalog, public, pg_temp
as $$
  select
    snapshot.registered_users,
    snapshot.active_communities,
    snapshot.published_broadcasts,
    snapshot.generated_at
  from public.public_platform_stats_snapshots snapshot
  where snapshot.singleton = true
    and snapshot.expires_at > clock_timestamp();
$$;

revoke all on function public.mark_live_screen_session_published() from public, anon, authenticated;
revoke all on function public.require_platform_stats_service_role() from public, anon, authenticated;
revoke all on function public.approve_public_platform_stats_source() from public, anon, authenticated;
revoke all on function public.refresh_public_platform_stats_internal() from public, anon, authenticated;
revoke all on function public.refresh_public_platform_stats() from public, anon, authenticated;
revoke all on function public.refresh_public_platform_stats_from_scheduler() from public, anon, authenticated;
revoke all on function public.get_public_platform_stats() from public, anon, authenticated;
grant execute on function public.approve_public_platform_stats_source() to service_role;
grant execute on function public.refresh_public_platform_stats() to service_role;
grant execute on function public.get_public_platform_stats() to anon, authenticated;

select cron.unschedule('refresh-public-platform-stats')
where exists (
  select 1
  from cron.job
  where jobname = 'refresh-public-platform-stats'
);
select cron.schedule(
  'refresh-public-platform-stats',
  '*/5 * * * *',
  $$select public.refresh_public_platform_stats_from_scheduler();$$
);

comment on table public.platform_stats_exclusions is
  'Service-only exclusion registry for reviewed user, community, broadcast, and session records. Automatic exclusion uses only explicit profile/auth flags; no display-name heuristic is permitted.';
comment on table public.public_platform_stats_snapshots is
  'Atomic aggregate-only public statistics. The API returns no data once the five-minute snapshot expires, so callers display unavailable rather than a fabricated zero.';
comment on function public.refresh_public_platform_stats() is
  'Service-role aggregate refresh over canonical auth users, active communities, and published live-session identities. The previous snapshot remains intact if the refresh transaction fails.';
comment on function public.get_public_platform_stats() is
  'Public aggregate-only RPC. It exposes three counts and generated_at only; raw source tables and stale snapshots are never returned.';

commit;
