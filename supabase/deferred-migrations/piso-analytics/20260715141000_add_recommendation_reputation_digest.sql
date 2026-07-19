-- T69/T68 recommendations, T74 reputation, T70 notif ranking, T71 digest, T62 experiment
-- analysis. Additive, read-only functions.
--
-- STATUS: APPLIED TO PROD 2026-07-15 (after the user reviewed the described change and
-- explicitly authorized). Design note: the user-facing functions use auth.uid() and only expose
-- the caller's own derived results; compute_creator_reputation/analyze_experiments are
-- service_role only. Verified post-apply: 4 user-facing fns present, reputation/experiments OK.

-- T69: friend recommendation (friends-of-friends over follows), for the calling user.
create or replace function public.recommend_friends(max_results integer default 10)
returns table(candidate uuid, mutual_count bigint)
language sql stable security definer set search_path to 'public'
as $function$
  select f2.following_id, count(*)::bigint
  from public.follows f1
  join public.follows f2 on f2.follower_id = f1.following_id
  where f1.follower_id = auth.uid()
    and f2.following_id <> auth.uid()
    and not exists (select 1 from public.follows fx where fx.follower_id = auth.uid() and fx.following_id = f2.following_id)
  group by f2.following_id
  order by count(*) desc
  limit least(greatest(max_results,1), 50);
$function$;
grant execute on function public.recommend_friends(integer) to authenticated;

-- T68: community recommendation (co-membership overlap), for the calling user.
create or replace function public.recommend_communities(max_results integer default 10)
returns table(community_id uuid, overlap bigint)
language sql stable security definer set search_path to 'public'
as $function$
  select cm2.community_id, count(distinct cm2.user_id)::bigint
  from public.community_members me
  join public.community_members peers on peers.community_id = me.community_id and peers.user_id <> me.user_id
  join public.community_members cm2 on cm2.user_id = peers.user_id
  where me.user_id = auth.uid()
    and not exists (select 1 from public.community_members x where x.user_id = auth.uid() and x.community_id = cm2.community_id)
  group by cm2.community_id
  order by count(distinct cm2.user_id) desc
  limit least(greatest(max_results,1), 50);
$function$;
grant execute on function public.recommend_communities(integer) to authenticated;

-- T70: notification ranking for the calling user (type priority + recency).
create or replace function public.rank_my_notifications(max_results integer default 20)
returns table(id uuid, type text, priority integer, created_at timestamptz)
language sql stable security definer set search_path to 'public'
as $function$
  select n.id, n.type,
    case n.type when 'mention' then 100 when 'reply' then 90 when 'comment' then 70
      when 'follow' then 60 when 'like' then 40 else 50 end,
    n.created_at
  from public.notifications n
  where n.recipient_id = auth.uid() and n.read_at is null
  order by 3 desc, n.created_at desc
  limit least(greatest(max_results,1), 100);
$function$;
grant execute on function public.rank_my_notifications(integer) to authenticated;

-- T71: smart digest (unread counts by type) for the calling user.
create or replace function public.build_notification_digest()
returns table(type text, unread bigint)
language sql stable security definer set search_path to 'public'
as $function$
  select n.type, count(*)::bigint
  from public.notifications n
  where n.recipient_id = auth.uid() and n.read_at is null
  group by n.type order by count(*) desc;
$function$;
grant execute on function public.build_notification_digest() to authenticated;

-- T74: creator reputation (engagement minus sustained reports). Admin/service (T&S + analytics).
create or replace function public.compute_creator_reputation(target uuid)
returns table(user_id uuid, reputation numeric, followers bigint, posts bigint, likes_received bigint, reports bigint)
language sql stable security definer set search_path to 'public'
as $function$
  with f as (select count(*) c from public.follows where following_id = target),
  p as (select count(*) c from public.posts where author_id = target),
  l as (select count(*) c from public.post_likes pl join public.posts po on po.id=pl.post_id where po.author_id = target),
  r as (select count(*) c from public.user_reports where reported_id = target and status <> 'dismissed')
  select target,
    round(least(100, greatest(0,
      least(40, (select c from f)::numeric / 5)
      + least(20, (select c from p)::numeric / 2)
      + least(40, (select c from l)::numeric / 3)
      - least(50, (select c from r)::numeric * 10))),1),
    (select c from f), (select c from p), (select c from l), (select c from r);
$function$;
revoke all on function public.compute_creator_reputation(uuid) from public;
revoke all on function public.compute_creator_reputation(uuid) from anon;
revoke all on function public.compute_creator_reputation(uuid) from authenticated;
grant execute on function public.compute_creator_reputation(uuid) to service_role;

-- T62: experiment analysis accessor over algorithm_experiments. Admin/service.
create or replace function public.analyze_experiments()
returns table(id uuid, name text, status text, traffic_percent integer, age_days numeric)
language sql stable security definer set search_path to 'public'
as $function$
  select id, name, status, traffic_percent, round(extract(epoch from (now()-created_at))/86400, 1)
  from public.algorithm_experiments order by created_at desc;
$function$;
revoke all on function public.analyze_experiments() from public;
revoke all on function public.analyze_experiments() from anon;
revoke all on function public.analyze_experiments() from authenticated;
grant execute on function public.analyze_experiments() to service_role;
