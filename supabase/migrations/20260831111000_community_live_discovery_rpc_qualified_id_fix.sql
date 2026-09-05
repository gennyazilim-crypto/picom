-- Forward-only hotfix for the Community Live Discovery RPC.
-- The return-table field `id` is a PL/pgSQL variable.  The three ranking
-- tie-breakers must refer to the `eligible` CTE column explicitly.

begin;

create or replace function public.list_community_live_discovery(
  p_limit integer default 12,
  p_seed text default null,
  p_exclude_broadcast_ids uuid[] default '{}'::uuid[],
  p_locale text default null,
  p_category text default null
)
returns table (
  id uuid,
  community_id uuid,
  channel_id uuid,
  broadcaster_user_id uuid,
  title text,
  status text,
  category text,
  language_code text,
  viewer_count integer,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  community_name text,
  channel_name text,
  broadcaster_display_name text,
  broadcaster_username text,
  broadcaster_avatar_url text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  safe_limit integer := greatest(1, least(coalesce(p_limit, 12), 20));
  stable_seed text := left(coalesce(nullif(btrim(p_seed), ''), actor_id::text), 128);
  time_bucket text := floor(extract(epoch from now()) / 60)::bigint::text;
  normalized_locale text := left(lower(btrim(coalesce(p_locale, ''))), 16);
  normalized_category text := lower(btrim(coalesce(p_category, '')));
begin
  if actor_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if normalized_category not in ('', 'game', 'chat', 'education', 'watch_together', 'other') then
    raise exception 'COMMUNITY_DISCOVERY_CATEGORY_INVALID' using errcode = '22023';
  end if;

  return query
  with eligible as (
    select
      session.id,
      session.community_id,
      session.channel_id,
      session.broadcaster_user_id,
      session.title,
      session.status::text as status,
      session.category,
      coalesce(session.language_code, '') as language_code,
      session.viewer_count,
      session.started_at,
      session.last_heartbeat_at,
      community.name as community_name,
      channel.name as channel_name,
      coalesce(nullif(btrim(profile.display_name), ''), nullif(btrim(profile.username), ''), '') as broadcaster_display_name,
      profile.username as broadcaster_username,
      profile.avatar_url as broadcaster_avatar_url,
      case when session.id = any(coalesce(p_exclude_broadcast_ids, '{}'::uuid[])) then 1 else 0 end as excluded_by_client,
      exists (
        select 1
        from public.live_discovery_exposures exposure
        where exposure.viewer_id = actor_id
          and exposure.broadcast_id = session.id
          and exposure.source = 'community_live'
          and (
            exposure.shown_at >= now() - interval '45 minutes'
            or exposure.dismissed_at >= now() - interval '24 hours'
          )
      ) as recently_exposed,
      md5(concat_ws(':', stable_seed, time_bucket, session.id::text)) as shuffle_key
    from public.community_live_screen_sessions session
    join public.communities community on community.id = session.community_id
    join public.channels channel on channel.id = session.channel_id
    join public.profiles profile on profile.id = session.broadcaster_user_id
    where session.status = 'live'
      and session.last_heartbeat_at >= now() - interval '60 seconds'
      and session.deleted_at is null
      and session.hidden_at is null
      and session.moderation_status = 'approved'
      and session.visibility_mode <> 'public_discovery'
      and public.can_view_community_live_discovery_session(session)
      and (normalized_locale = '' or lower(coalesce(session.language_code, '')) = normalized_locale)
      and (normalized_category = '' or lower(session.category) = normalized_category)
  ), ranked as (
    select
      eligible.*,
      row_number() over (
        partition by broadcaster_user_id
        order by recently_exposed, excluded_by_client, shuffle_key, eligible.id
      ) as broadcaster_rank,
      row_number() over (
        partition by community_id
        order by recently_exposed, excluded_by_client, shuffle_key, eligible.id
      ) as community_rank,
      row_number() over (
        partition by category
        order by recently_exposed, excluded_by_client, shuffle_key, eligible.id
      ) as category_rank
    from eligible
  ), strict_pool as (
    select ranked.*, 0 as diversity_fallback
    from ranked
    where broadcaster_rank <= 1
      and community_rank <= 2
      and category_rank <= 4
  ), relaxed_pool as (
    select ranked.*, 1 as diversity_fallback
    from ranked
    where broadcaster_rank <= 1
      and not exists (select 1 from strict_pool strict where strict.id = ranked.id)
  ), selected as (
    select * from strict_pool
    union all
    select * from relaxed_pool
    where (select count(*) from strict_pool) < safe_limit
  )
  select
    selected.id,
    selected.community_id,
    selected.channel_id,
    selected.broadcaster_user_id,
    selected.title,
    selected.status,
    selected.category,
    selected.language_code,
    selected.viewer_count,
    selected.started_at,
    selected.last_heartbeat_at,
    selected.community_name,
    selected.channel_name,
    selected.broadcaster_display_name,
    selected.broadcaster_username,
    selected.broadcaster_avatar_url
  from selected
  order by
    selected.recently_exposed,
    selected.excluded_by_client,
    selected.diversity_fallback,
    selected.shuffle_key,
    selected.id
  limit safe_limit;
end;
$$;

revoke all on function public.list_community_live_discovery(integer, text, uuid[], text, text)
  from public, anon;
grant execute on function public.list_community_live_discovery(integer, text, uuid[], text, text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
