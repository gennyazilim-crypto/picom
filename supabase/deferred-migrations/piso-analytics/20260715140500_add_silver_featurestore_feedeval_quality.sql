-- T57 silver transform, T64 feature store, T67 feed-ranking eval, T73 content quality.
-- Applied to piso prod 2026-07-15. Additive, non-destructive (functions + one new table).
-- Rollback: drop function get_content_quality_scores(integer); drop function evaluate_feed_ranking(integer);
--           drop function upsert_recommendation_feature(text,uuid,text,numeric); drop table recommendation_features;
--           drop function get_analytics_silver(integer);

-- T57: silver analytics accessor (cleaned/typed + pseudonymized actor, no raw id).
create or replace function public.get_analytics_silver(limit_input integer default 1000)
returns table(event_type text, event_domain text, actor_hash text, entity_type text,
  consent_category text, day date, hour integer)
language sql stable security definer set search_path to 'public'
as $function$
  select ae.event_type,
         split_part(ae.event_type, '.', 1) as event_domain,
         public.pseudonymize_actor(ae.actor_user_id) as actor_hash,
         ae.entity_type, ae.consent_category,
         ae.created_at::date as day,
         extract(hour from ae.created_at)::integer as hour
  from public.analytics_events ae
  order by ae.created_at desc
  limit least(greatest(limit_input,1), 10000);
$function$;
revoke all on function public.get_analytics_silver(integer) from public;
revoke all on function public.get_analytics_silver(integer) from anon;
revoke all on function public.get_analytics_silver(integer) from authenticated;
grant execute on function public.get_analytics_silver(integer) to service_role;

-- T64: recommendation feature store.
create table if not exists public.recommendation_features (
  subject_type text not null,
  subject_id uuid not null,
  feature_key text not null,
  value numeric not null,
  computed_at timestamptz not null default now(),
  primary key (subject_type, subject_id, feature_key)
);
create index if not exists rec_features_subject_idx on public.recommendation_features (subject_type, subject_id);
alter table public.recommendation_features enable row level security;
create policy "rec features admin read" on public.recommendation_features for select using (public.is_app_admin());

create or replace function public.upsert_recommendation_feature(
  subject_type_input text, subject_id_input uuid, feature_key_input text, value_input numeric)
returns void language sql security definer set search_path to 'public'
as $function$
  insert into public.recommendation_features(subject_type, subject_id, feature_key, value, computed_at)
  values (subject_type_input, subject_id_input, feature_key_input, value_input, now())
  on conflict (subject_type, subject_id, feature_key)
  do update set value = excluded.value, computed_at = excluded.computed_at;
$function$;
revoke all on function public.upsert_recommendation_feature(text,uuid,text,numeric) from public;
revoke all on function public.upsert_recommendation_feature(text,uuid,text,numeric) from anon;
revoke all on function public.upsert_recommendation_feature(text,uuid,text,numeric) from authenticated;
grant execute on function public.upsert_recommendation_feature(text,uuid,text,numeric) to service_role;

-- T67: feed ranking evaluation (engagement mix over feed_events).
create or replace function public.evaluate_feed_ranking(window_days integer default 7)
returns table(event_type text, events bigint, share_pct numeric)
language sql stable security definer set search_path to 'public'
as $function$
  with e as (
    select event_type, count(*)::bigint as c
    from public.feed_events
    where created_at >= now() - make_interval(days => greatest(window_days,1))
    group by event_type
  ), tot as (select sum(c) as t from e)
  select e.event_type, e.c, round(100.0 * e.c / nullif((select t from tot),0), 2)
  from e order by e.c desc;
$function$;
revoke all on function public.evaluate_feed_ranking(integer) from public;
revoke all on function public.evaluate_feed_ranking(integer) from anon;
revoke all on function public.evaluate_feed_ranking(integer) from authenticated;
grant execute on function public.evaluate_feed_ranking(integer) to service_role;

-- T73: content quality score per community (metadata-only; scores spaces, not people).
create or replace function public.get_content_quality_scores(window_days integer default 30)
returns table(community_id uuid, score numeric, active_members integer, messages integer, reports integer)
language sql stable security definer set search_path to 'public'
as $function$
  select cm.community_id,
         round(least(100, greatest(0,
           50
           + least(30, coalesce(sum(cm.messages_count),0)::numeric / nullif(sum(cm.active_members),0) * 3)
           + least(20, coalesce(sum(cm.active_members),0)::numeric / 5)
           - least(40, coalesce(sum(cm.reports_count),0)::numeric * 5)
         )), 1) as score,
         max(cm.active_members), sum(cm.messages_count)::integer, sum(cm.reports_count)::integer
  from public.community_metrics cm
  where cm.date >= current_date - greatest(window_days,1)
  group by cm.community_id;
$function$;
revoke all on function public.get_content_quality_scores(integer) from public;
revoke all on function public.get_content_quality_scores(integer) from anon;
revoke all on function public.get_content_quality_scores(integer) from authenticated;
grant execute on function public.get_content_quality_scores(integer) to service_role;
