begin;

create or replace view public.unified_content_feed_view with (security_invoker = true) as
select md5(mention.source_type || ':' || mention.source_id::text)::uuid as feed_item_id,
  mention.source_type, mention.source_id, mention.parent_source_id, mention.community_id, mention.channel_id, mention.author_id,
  array_agg(distinct mention.mentioned_user_id order by mention.mentioned_user_id) as mentioned_user_ids,
  max(mention.preview) as preview, min(mention.source_created_at) as source_created_at,
  max(mention.source_updated_at) as source_updated_at, max(mention.visibility_context::text)::jsonb as visibility_context,
  count(*)::integer as mention_count
from public.content_mentions mention
group by mention.source_type, mention.source_id, mention.parent_source_id, mention.community_id, mention.channel_id, mention.author_id;
revoke all on public.unified_content_feed_view from public, anon;
grant select on public.unified_content_feed_view to authenticated;

create or replace function public.visible_content_feed_engagement(target_source_type text, target_source_id uuid, target_parent_source_id uuid default null)
returns table(reaction_count integer, comment_count integer, listener_count integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare allowed boolean;
begin
  select exists(select 1 from public.content_mentions mention where mention.source_type=target_source_type and mention.source_id=target_source_id and public.can_view_content_mention(mention)) into allowed;
  if not allowed then return query select 0,0,0; return; end if;
  if target_source_type in ('text_message','radio_chat') then
    return query select
      (select count(*)::integer from public.message_reactions reaction where reaction.message_id=target_source_id),
      (select count(*)::integer from public.messages reply where reply.reply_to_message_id=target_source_id and reply.deleted_at is null and public.can_view_message(reply.id)),0;
  elsif target_source_type='radio_session' then
    return query select
      (select count(*)::integer from public.radio_session_reactions reaction where reaction.radio_session_id=target_source_id),0,
      coalesce((select session.listener_count from public.radio_sessions session where session.id=target_source_id and public.can_view_radio_session(session.id)),0);
  elsif target_source_type='podcast_episode' then
    return query select
      (select count(*)::integer from public.podcast_episode_reactions reaction where reaction.episode_id=target_source_id),
      (select count(*)::integer from public.podcast_episode_comments comment where comment.episode_id=target_source_id and comment.deleted_at is null),
      (select count(distinct progress.user_id)::integer from public.podcast_playback_progress progress where progress.episode_id=target_source_id);
  elsif target_source_type='podcast_comment' then
    return query select 0,
      (select count(*)::integer from public.podcast_episode_comments reply where reply.reply_to_comment_id=target_source_id and reply.deleted_at is null),
      (select count(distinct progress.user_id)::integer from public.podcast_playback_progress progress where progress.episode_id=target_parent_source_id);
  else return query select 0,0,0;
  end if;
end $$;
revoke all on function public.visible_content_feed_engagement(text,uuid,uuid) from public,anon;
grant execute on function public.visible_content_feed_engagement(text,uuid,uuid) to authenticated;

create or replace function public.list_ranked_unified_feed(
  feed_mode text default 'popular', ranking_epoch_input timestamptz default now(), cursor_rank numeric default null,
  cursor_created_at timestamptz default null, cursor_feed_item_id uuid default null, source_types text[] default null, result_limit integer default 20
)
returns table(feed_item_id uuid,source_type text,source_id uuid,parent_source_id uuid,community_id uuid,channel_id uuid,author_id uuid,
  mentioned_user_ids uuid[],preview text,source_created_at timestamptz,source_updated_at timestamptz,visibility_context jsonb,
  reaction_count integer,comment_count integer,listener_count integer,mention_count integer,is_unread boolean,is_saved boolean,
  is_follow_related boolean,ranking_score numeric,ranking_epoch timestamptz)
language sql stable security invoker set search_path = public, pg_temp as $$
  with source_state as (
    select feed.*, engagement.reaction_count, engagement.comment_count, engagement.listener_count,
      exists(select 1 from public.user_follows follow where follow.follower_id=auth.uid() and (follow.followed_id=feed.author_id or follow.followed_id=any(feed.mentioned_user_ids))) as is_follow_related,
      case
        when feed.source_type in ('text_message','radio_chat') then not exists(
          select 1 from public.read_states state join public.messages last_read on last_read.id=state.last_read_message_id
          where state.user_id=auth.uid() and state.channel_id=feed.channel_id and last_read.created_at>=feed.source_updated_at)
        when feed.source_type='radio_session' then not exists(
          select 1 from public.audio_feed_read_states state where state.user_id=auth.uid() and state.item_type='radio_session' and state.item_id=feed.source_id and state.read_at>=feed.source_updated_at)
        when feed.source_type='podcast_episode' then not exists(
          select 1 from public.audio_feed_read_states state where state.user_id=auth.uid() and state.item_type='podcast_episode' and state.item_id=feed.source_id and state.read_at>=feed.source_updated_at)
        when feed.source_type='podcast_comment' then not exists(
          select 1 from public.audio_feed_read_states state where state.user_id=auth.uid() and state.item_type='podcast_episode' and state.item_id=feed.parent_source_id and state.read_at>=feed.source_updated_at)
        else true end as is_unread,
      case
        when feed.source_type in ('text_message','radio_chat') then exists(select 1 from public.saved_messages saved where saved.user_id=auth.uid() and saved.message_id=feed.source_id)
        when feed.source_type='radio_session' then exists(select 1 from public.saved_audio_items saved where saved.user_id=auth.uid() and saved.item_type='radio_session' and saved.item_id=feed.source_id)
        when feed.source_type in ('podcast_episode','podcast_comment') then exists(select 1 from public.saved_audio_items saved where saved.user_id=auth.uid() and saved.item_type='podcast_episode' and saved.item_id=coalesce(feed.parent_source_id,feed.source_id))
        else false end as is_saved
    from public.unified_content_feed_view feed
    cross join lateral public.visible_content_feed_engagement(feed.source_type,feed.source_id,feed.parent_source_id) engagement
    where source_types is null or feed.source_type=any(source_types)
  ), scored as (
    select source_state.*,
      round((case when is_follow_related then 24 else 0 end + case when is_unread then 18 else 0 end
        + least(14,sqrt(greatest(reaction_count,0)::numeric)*2.4) + least(10,sqrt(greatest(comment_count,0)::numeric)*2.2)
        + least(12,ln(1+greatest(listener_count,0)::numeric)*1.8)
        + case source_type when 'radio_session' then 3 when 'podcast_episode' then 2 when 'podcast_comment' then 2 else 0 end
        + greatest(0,36*(1-greatest(0,extract(epoch from (ranking_epoch_input-source_created_at))/3600)/168)))::numeric,6) as ranking_score
    from source_state where feed_mode='popular' or (feed_mode='following' and is_follow_related)
  )
  select scored.feed_item_id,scored.source_type,scored.source_id,scored.parent_source_id,scored.community_id,scored.channel_id,
    scored.author_id,scored.mentioned_user_ids,scored.preview,scored.source_created_at,scored.source_updated_at,scored.visibility_context,
    scored.reaction_count,scored.comment_count,scored.listener_count,scored.mention_count,scored.is_unread,scored.is_saved,
    scored.is_follow_related,scored.ranking_score,ranking_epoch_input
  from scored where feed_mode in ('popular','following') and (cursor_rank is null or scored.ranking_score<cursor_rank
    or (scored.ranking_score=cursor_rank and scored.source_created_at<cursor_created_at)
    or (scored.ranking_score=cursor_rank and scored.source_created_at=cursor_created_at and scored.feed_item_id<cursor_feed_item_id))
  order by scored.ranking_score desc,scored.source_created_at desc,scored.feed_item_id desc
  limit greatest(1,least(coalesce(result_limit,20),50))
$$;
revoke all on function public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],integer) from public,anon;
grant execute on function public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],integer) to authenticated;
comment on view public.unified_content_feed_view is 'RLS-invoker aggregation for Text, Radio, and Podcast mentions; no viewer profile is materialized.';
comment on function public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],integer) is 'Single-query visible Feed ranking with persisted follows, existing read/save state, aggregate engagement, and keyset pagination.';
commit;
