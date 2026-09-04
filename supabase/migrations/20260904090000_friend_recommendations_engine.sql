-- Personalized friend recommendations.
--
-- This is deliberately separate from list_friend_suggestions(integer), which
-- remains the legacy UI contract while FRIEND_RECOMMENDATIONS_ENABLED is off.
-- Candidates are generated from bounded social-graph sources. No direct-message
-- content, sensitive attributes, or random table scans participate in ranking.

begin;

create table if not exists public.friend_recommendation_exposures (
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  suggested_user_id uuid not null references public.profiles(id) on delete cascade,
  first_shown_at timestamptz not null default clock_timestamp(),
  last_shown_at timestamptz not null default clock_timestamp(),
  impression_count integer not null default 0 check (impression_count >= 0),
  dismissed_at timestamptz,
  request_sent_at timestamptz,
  accepted_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (viewer_user_id, suggested_user_id),
  check (viewer_user_id <> suggested_user_id)
);

create index if not exists friend_recommendation_exposures_recent_idx
  on public.friend_recommendation_exposures (viewer_user_id, last_shown_at desc);
create index if not exists friend_recommendation_exposures_dismissed_idx
  on public.friend_recommendation_exposures (viewer_user_id, dismissed_at desc)
  where dismissed_at is not null;

create table if not exists public.friend_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  suggested_user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in (
    'impression', 'profile_open', 'request_sent', 'dismissed', 'accepted'
  )),
  refresh_seed text,
  occurred_at timestamptz not null default clock_timestamp(),
  check (viewer_user_id <> suggested_user_id),
  check (refresh_seed is null or char_length(refresh_seed) between 1 and 128)
);

create index if not exists friend_recommendation_events_viewer_time_idx
  on public.friend_recommendation_events (viewer_user_id, occurred_at desc);
create index if not exists friend_recommendation_events_type_time_idx
  on public.friend_recommendation_events (event_type, occurred_at desc);

-- A stable bucket keeps exploration bounded and indexable. The request seed
-- affects ordering only within a small deterministic bucket; it never invokes
-- random full-table sort over profiles.
create index if not exists profiles_friend_recommendation_bucket_idx
  on public.profiles ((hashtextextended(id::text, 0) & 127::bigint))
  where coalesce(is_bot, false) = false
    and deactivated_at is null
    and deleted_at is null
    and coalesce(is_deleted, false) = false;

alter table public.friend_recommendation_exposures enable row level security;
alter table public.friend_recommendation_events enable row level security;
revoke all on public.friend_recommendation_exposures from public, anon, authenticated;
revoke all on public.friend_recommendation_events from public, anon, authenticated;

alter table public.user_action_rate_limits
  drop constraint if exists user_action_rate_limits_action_key_check;
alter table public.user_action_rate_limits
  add constraint user_action_rate_limits_action_key_check check(action_key in(
    'message_send','attachment_metadata','reaction_write','relationship_write','feed_interaction','livekit_token',
    'meeting_schedule_write','meeting_invite_write','meeting_join_preview','meeting_signal_write',
    'meeting_waiting_request','meeting_chat_send','meeting_reaction','meeting_privileged_action',
    'meeting_caption_write','meeting_caption_consent',
    'friend_recommendation_refresh','friend_recommendation_feedback'
  ));

create or replace function public.consume_current_user_action_rate_limit(target_action text)
returns table(is_allowed boolean,retry_after_seconds integer)
language plpgsql
volatile
security definer
set search_path=public,pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
  configured_maximum_requests integer;
  configured_window_seconds integer;
  current_row public.user_action_rate_limits%rowtype;
  current_timestamp_value timestamptz := clock_timestamp();
begin
  if current_user_id is null then
    return query select false,60;
    return;
  end if;

  select configured.maximum_requests,configured.window_seconds
    into configured_maximum_requests,configured_window_seconds
  from(values
    ('message_send',30,60),('attachment_metadata',20,300),('reaction_write',120,60),
    ('relationship_write',30,60),('feed_interaction',120,60),('livekit_token',10,60),
    ('meeting_schedule_write',20,300),('meeting_invite_write',30,300),
    ('meeting_join_preview',30,60),('meeting_signal_write',12,60),
    ('meeting_waiting_request',6,300),('meeting_chat_send',20,30),
    ('meeting_reaction',8,3),('meeting_privileged_action',30,60),
    ('meeting_caption_write',20,60),('meeting_caption_consent',10,60),
    ('friend_recommendation_refresh',12,300),('friend_recommendation_feedback',60,300)
  ) configured(action_key,maximum_requests,window_seconds)
  where configured.action_key=target_action;

  if configured_maximum_requests is null then
    raise exception 'RATE_LIMIT_ACTION_INVALID';
  end if;

  insert into public.user_action_rate_limits(user_id,action_key,window_started_at,request_count,updated_at)
  values(current_user_id,target_action,current_timestamp_value,1,current_timestamp_value)
  on conflict(user_id,action_key) do update set
    window_started_at=case
      when user_action_rate_limits.window_started_at<=current_timestamp_value-make_interval(secs=>configured_window_seconds)
      then current_timestamp_value else user_action_rate_limits.window_started_at end,
    request_count=case
      when user_action_rate_limits.window_started_at<=current_timestamp_value-make_interval(secs=>configured_window_seconds)
      then 1 else user_action_rate_limits.request_count+1 end,
    updated_at=current_timestamp_value
  returning * into current_row;

  if current_row.request_count>configured_maximum_requests then
    update public.user_action_rate_limits
      set denied_count=denied_count+1,last_denied_at=current_timestamp_value,updated_at=current_timestamp_value
    where user_id=current_user_id and action_key=target_action;
  end if;

  return query select
    current_row.request_count<=configured_maximum_requests,
    case when current_row.request_count<=configured_maximum_requests then 0
      else greatest(1,ceil(extract(epoch from(
        current_row.window_started_at+make_interval(secs=>configured_window_seconds)-current_timestamp_value
      )))::integer) end;
end;
$$;

create or replace function public.get_friend_recommendations(
  result_limit integer default 6,
  refresh_seed text default null
)
returns table(
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  verified_public boolean,
  mutual_friend_count integer,
  shared_community_count integer,
  reason_code text
)
language plpgsql
volatile
security definer
set search_path=public,pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  safe_limit integer := least(greatest(coalesce(result_limit, 6), 1), 20);
  safe_seed text := left(coalesce(nullif(btrim(refresh_seed), ''), to_char(clock_timestamp(), 'YYYY-MM-DD-HH24') || ':' || auth.uid()::text), 128);
  rate_limit record;
begin
  if viewer_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into rate_limit from public.consume_current_user_action_rate_limit('friend_recommendation_refresh');
  if rate_limit.is_allowed is not true then
    raise exception 'RATE_LIMITED' using errcode = 'P0001', detail = rate_limit.retry_after_seconds::text;
  end if;

  return query
  with
  viewer_friends as (
    select case when friendship.user_low_id = viewer_id then friendship.user_high_id else friendship.user_low_id end as friend_id
    from public.friendships friendship
    where viewer_id in (friendship.user_low_id, friendship.user_high_id)
  ),
  mutual_counts as (
    select
      case when friendship.user_low_id = viewer_friend.friend_id then friendship.user_high_id else friendship.user_low_id end as candidate_id,
      count(distinct viewer_friend.friend_id)::integer as mutual_friend_count
    from viewer_friends viewer_friend
    join public.friendships friendship
      on viewer_friend.friend_id in (friendship.user_low_id, friendship.user_high_id)
    where case when friendship.user_low_id = viewer_friend.friend_id then friendship.user_high_id else friendship.user_low_id end <> viewer_id
    group by 1
  ),
  shared_public_communities as (
    select
      candidate_membership.user_id as candidate_id,
      count(distinct viewer_membership.community_id)::integer as shared_community_count,
      min(viewer_membership.community_id) as dominant_community_id
    from public.community_members viewer_membership
    join public.community_members candidate_membership
      on candidate_membership.community_id = viewer_membership.community_id
     and candidate_membership.user_id <> viewer_id
    join public.communities community on community.id = viewer_membership.community_id
    where viewer_membership.user_id = viewer_id
      and community.visibility = 'public'
      and community.archived_at is null
    group by candidate_membership.user_id
  ),
  viewer_public_channels as (
    select distinct message.channel_id
    from public.messages message
    join public.channels channel on channel.id = message.channel_id
    join public.communities community on community.id = channel.community_id
    where message.author_id = viewer_id
      and message.deleted_at is null
      and community.visibility = 'public'
      and community.public_read_enabled = true
      and channel.is_private = false
      and channel.public_read_enabled = true
    order by message.channel_id
    limit 24
  ),
  safe_public_interactions as (
    select message.author_id as candidate_id, count(distinct message.channel_id)::integer as interaction_count
    from viewer_public_channels viewer_channel
    join public.messages message on message.channel_id = viewer_channel.channel_id
    where message.author_id <> viewer_id
      and message.deleted_at is null
      and message.created_at >= clock_timestamp() - interval '90 days'
    group by message.author_id
  ),
  exploration_candidates as (
    select profile.id as candidate_id
    from public.profiles profile
    where (hashtextextended(profile.id::text, 0) & 127::bigint) in (
      (hashtextextended(safe_seed, 0) & 127::bigint),
      ((hashtextextended(safe_seed, 0) + 1) & 127::bigint),
      ((hashtextextended(safe_seed, 0) + 2) & 127::bigint),
      ((hashtextextended(safe_seed, 0) + 3) & 127::bigint)
    )
    order by md5(profile.id::text || safe_seed)
    limit 30
  ),
  source_candidates as (
    select candidate_id, false as exploration_source from mutual_counts
    union
    select candidate_id, false as exploration_source from shared_public_communities
    union
    select candidate_id, false as exploration_source from safe_public_interactions
    union
    select candidate_id, true as exploration_source from exploration_candidates
  ),
  candidate_pool as (
    select candidate_id, bool_or(exploration_source) as exploration_source
    from source_candidates
    group by candidate_id
  ),
  eligible as (
    select
      candidate.id as candidate_id,
      candidate.display_name,
      candidate.username,
      candidate.avatar_url,
      -- Picom does not currently expose a canonical public profile-verification
      -- attribute. Keep this UI-safe field false rather than inventing one.
      false as verified_public,
      coalesce(mutual.mutual_friend_count, 0) as mutual_friend_count,
      coalesce(shared.shared_community_count, 0) as shared_community_count,
      shared.dominant_community_id,
      coalesce(interaction.interaction_count, 0) as interaction_count,
      coalesce(candidate.updated_at >= clock_timestamp() - interval '21 days', false) as recently_active,
      coalesce(viewer_settings.preferred_locale = candidate_settings.preferred_locale, false) as language_match,
      pool.exploration_source
    from candidate_pool pool
    join public.profiles candidate on candidate.id = pool.candidate_id
    left join mutual_counts mutual on mutual.candidate_id = candidate.id
    left join shared_public_communities shared on shared.candidate_id = candidate.id
    left join safe_public_interactions interaction on interaction.candidate_id = candidate.id
    left join public.profile_privacy_settings privacy on privacy.user_id = candidate.id
    left join public.user_settings viewer_settings on viewer_settings.user_id = viewer_id
    left join public.user_settings candidate_settings on candidate_settings.user_id = candidate.id
    left join public.friend_recommendation_exposures exposure
      on exposure.viewer_user_id = viewer_id and exposure.suggested_user_id = candidate.id
    where candidate.id <> viewer_id
      and public.publisher_profile_is_active_account(candidate.id)
      and public.can_send_friend_request(viewer_id, candidate.id)
      and not exists (
        select 1
        from public.friend_requests request
        where request.status = 'pending'
          and (
            (request.sender_id = viewer_id and request.recipient_id = candidate.id)
            or (request.sender_id = candidate.id and request.recipient_id = viewer_id)
          )
      )
      and not public.users_are_blocked(viewer_id, candidate.id)
      and coalesce(privacy.profile_visibility, 'everyone') <> 'friends'
      and (
        coalesce(privacy.profile_visibility, 'everyone') = 'everyone'
        or coalesce(shared.shared_community_count, 0) > 0
      )
      and (exposure.dismissed_at is null or exposure.dismissed_at <= clock_timestamp() - interval '30 days')
      and not (
        exposure.impression_count >= 3
        and exposure.last_shown_at > clock_timestamp() - interval '7 days'
        and exposure.request_sent_at is null
      )
  ),
  scored as (
    select
      eligible.*,
      least(1::numeric, ln(1 + eligible.mutual_friend_count::numeric) / ln(5::numeric)) as mutual_score,
      least(1::numeric, sqrt(eligible.shared_community_count::numeric) / sqrt(4::numeric)) as community_score,
      0::numeric as interest_score,
      least(1::numeric, sqrt(eligible.interaction_count::numeric) / sqrt(8::numeric)) as interaction_score,
      case when eligible.recently_active then 1::numeric else 0::numeric end as activity_score,
      case when eligible.language_match then 1::numeric else 0::numeric end as language_score,
      case when eligible.exploration_source then 1::numeric else 0::numeric end as exploration_score
    from eligible
  ),
  ranked as (
    select
      scored.*,
      (
        mutual_score * 0.32 + community_score * 0.24 + interest_score * 0.14 +
        interaction_score * 0.10 + activity_score * 0.08 + language_score * 0.06 + exploration_score * 0.06
      ) as affinity_score,
      md5(scored.candidate_id::text || safe_seed) as seeded_order
    from scored
  ),
  diverse as (
    select
      ranked.*,
      row_number() over (
        partition by coalesce(ranked.dominant_community_id, ranked.candidate_id)
        order by ranked.affinity_score desc, ranked.seeded_order
      ) as community_rank
    from ranked
  ),
  primary_selection as (
    select * from diverse
    where community_rank <= 2
    order by affinity_score desc, seeded_order
    limit safe_limit
  ),
  fallback_selection as (
    select * from diverse
    where community_rank > 2
      and not exists (select 1 from primary_selection selected where selected.candidate_id = diverse.candidate_id)
    order by affinity_score desc, seeded_order
    limit greatest(safe_limit - (select count(*)::integer from primary_selection), 0)
  ),
  final_selection as (
    select * from primary_selection
    union all
    select * from fallback_selection
  ),
  recorded_exposures as (
    insert into public.friend_recommendation_exposures (
      viewer_user_id, suggested_user_id, first_shown_at, last_shown_at, impression_count, updated_at
    )
    select viewer_id, candidate_id, clock_timestamp(), clock_timestamp(), 1, clock_timestamp()
    from final_selection
    on conflict (viewer_user_id, suggested_user_id) do update
      set last_shown_at = excluded.last_shown_at,
          impression_count = public.friend_recommendation_exposures.impression_count + 1,
          updated_at = excluded.updated_at
    returning suggested_user_id
  ),
  recorded_events as (
    insert into public.friend_recommendation_events (
      viewer_user_id, suggested_user_id, event_type, refresh_seed, occurred_at
    )
    select viewer_id, candidate_id, 'impression', safe_seed, clock_timestamp()
    from final_selection
    returning id
  )
  select
    final_selection.candidate_id,
    final_selection.display_name,
    final_selection.username,
    final_selection.avatar_url,
    final_selection.verified_public,
    final_selection.mutual_friend_count,
    final_selection.shared_community_count,
    case
      when final_selection.mutual_friend_count > 0 then 'MUTUAL_FRIENDS'
      when final_selection.shared_community_count > 0 then 'SHARED_COMMUNITY'
      when final_selection.interaction_count > 0 then 'POPULAR_IN_NETWORK'
      when final_selection.language_match then 'DISCOVERY'
      else 'DISCOVERY'
    end
  from final_selection
  cross join (select count(*) from recorded_exposures) exposure_write
  cross join (select count(*) from recorded_events) event_write
  order by final_selection.affinity_score desc, final_selection.seeded_order;
end;
$$;

create or replace function public.dismiss_friend_recommendation(target_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path=public,pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  rate_limit record;
  did_dismiss boolean := false;
begin
  if viewer_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_user_id is null or target_user_id = viewer_id then return false; end if;
  select * into rate_limit from public.consume_current_user_action_rate_limit('friend_recommendation_feedback');
  if rate_limit.is_allowed is not true then
    raise exception 'RATE_LIMITED' using errcode = 'P0001', detail = rate_limit.retry_after_seconds::text;
  end if;

  update public.friend_recommendation_exposures
     set dismissed_at = clock_timestamp(), updated_at = clock_timestamp()
   where viewer_user_id = viewer_id
     and suggested_user_id = target_user_id
  returning true into did_dismiss;

  if did_dismiss then
    insert into public.friend_recommendation_events(viewer_user_id, suggested_user_id, event_type, occurred_at)
    values (viewer_id, target_user_id, 'dismissed', clock_timestamp());
  end if;
  return coalesce(did_dismiss, false);
end;
$$;

create or replace function public.record_friend_recommendation_event(
  target_user_id uuid,
  event_name text
)
returns boolean
language plpgsql
volatile
security definer
set search_path=public,pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  rate_limit record;
begin
  if viewer_id is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if target_user_id is null or target_user_id = viewer_id then return false; end if;
  if event_name not in ('profile_open', 'request_sent', 'accepted') then
    raise exception 'FRIEND_RECOMMENDATION_EVENT_INVALID' using errcode = '22023';
  end if;
  select * into rate_limit from public.consume_current_user_action_rate_limit('friend_recommendation_feedback');
  if rate_limit.is_allowed is not true then
    raise exception 'RATE_LIMITED' using errcode = 'P0001', detail = rate_limit.retry_after_seconds::text;
  end if;

  if not exists (
    select 1 from public.friend_recommendation_exposures exposure
    where exposure.viewer_user_id = viewer_id
      and exposure.suggested_user_id = target_user_id
      and exposure.dismissed_at is null
  ) then
    return false;
  end if;

  update public.friend_recommendation_exposures
     set request_sent_at = case when event_name = 'request_sent' then clock_timestamp() else request_sent_at end,
         accepted_at = case when event_name = 'accepted' then clock_timestamp() else accepted_at end,
         updated_at = clock_timestamp()
   where viewer_user_id = viewer_id
     and suggested_user_id = target_user_id;
  insert into public.friend_recommendation_events(viewer_user_id, suggested_user_id, event_type, occurred_at)
  values (viewer_id, target_user_id, event_name, clock_timestamp());
  return true;
end;
$$;

revoke all on function public.get_friend_recommendations(integer,text) from public, anon;
revoke all on function public.dismiss_friend_recommendation(uuid) from public, anon;
revoke all on function public.record_friend_recommendation_event(uuid,text) from public, anon;
grant execute on function public.get_friend_recommendations(integer,text) to authenticated;
grant execute on function public.dismiss_friend_recommendation(uuid) to authenticated;
grant execute on function public.record_friend_recommendation_event(uuid,text) to authenticated;

comment on function public.get_friend_recommendations(integer,text) is
  'Authenticated viewer-only, privacy-safe friend recommendation RPC. Uses bounded graph candidates, deterministic hash-seeded exploration, and no DM content or random user sort.';
comment on table public.friend_recommendation_exposures is
  'Private, viewer-owned recommendation suppression and conversion state. No direct client table access.';
comment on table public.friend_recommendation_events is
  'Privacy-safe recommendation funnel events. Contains no message content, contact data, tokens, or internal ranking scores.';

commit;
