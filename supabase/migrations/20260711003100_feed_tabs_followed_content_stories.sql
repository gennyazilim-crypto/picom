drop function if exists public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],integer);
create or replace function public.list_ranked_unified_feed(
  feed_mode text default 'popular',ranking_epoch_input timestamptz default now(),cursor_rank numeric default null,
  cursor_created_at timestamptz default null,cursor_feed_item_id uuid default null,source_types text[] default null,
  created_after timestamptz default null,unread_only boolean default false,saved_only boolean default false,result_limit integer default 20)
returns table(feed_item_id uuid,source_type text,source_id uuid,parent_source_id uuid,community_id uuid,channel_id uuid,author_id uuid,
  mentioned_user_ids uuid[],preview text,source_created_at timestamptz,source_updated_at timestamptz,visibility_context jsonb,
  reaction_count integer,comment_count integer,listener_count integer,mention_count integer,is_unread boolean,is_saved boolean,
  is_follow_related boolean,ranking_score numeric,ranking_epoch timestamptz)
language sql stable security invoker set search_path=public,pg_temp as $$
  with source_state as (
    select feed.*,engagement.reaction_count,engagement.comment_count,engagement.listener_count,
      exists(select 1 from public.user_follows follow where follow.follower_id=auth.uid() and (follow.followed_id=feed.author_id or follow.followed_id=any(feed.mentioned_user_ids))) is_follow_related,
      case when feed.source_type in ('text_message','radio_chat') then not exists(select 1 from public.read_states state join public.messages last_read on last_read.id=state.last_read_message_id where state.user_id=auth.uid() and state.channel_id=feed.channel_id and last_read.created_at>=feed.source_updated_at)
        when feed.source_type='radio_session' then not exists(select 1 from public.audio_feed_read_states state where state.user_id=auth.uid() and state.item_type='radio_session' and state.item_id=feed.source_id and state.read_at>=feed.source_updated_at)
        when feed.source_type='podcast_episode' then not exists(select 1 from public.audio_feed_read_states state where state.user_id=auth.uid() and state.item_type='podcast_episode' and state.item_id=feed.source_id and state.read_at>=feed.source_updated_at)
        when feed.source_type='podcast_comment' then not exists(select 1 from public.audio_feed_read_states state where state.user_id=auth.uid() and state.item_type='podcast_episode' and state.item_id=feed.parent_source_id and state.read_at>=feed.source_updated_at) else true end is_unread,
      case when feed.source_type in ('text_message','radio_chat') then exists(select 1 from public.saved_messages saved where saved.user_id=auth.uid() and saved.message_id=feed.source_id)
        when feed.source_type='radio_session' then exists(select 1 from public.saved_audio_items saved where saved.user_id=auth.uid() and saved.item_type='radio_session' and saved.item_id=feed.source_id)
        when feed.source_type in ('podcast_episode','podcast_comment') then exists(select 1 from public.saved_audio_items saved where saved.user_id=auth.uid() and saved.item_type='podcast_episode' and saved.item_id=coalesce(feed.parent_source_id,feed.source_id)) else false end is_saved
    from public.unified_content_feed_view feed cross join lateral public.visible_content_feed_engagement(feed.source_type,feed.source_id,feed.parent_source_id) engagement
    where (source_types is null or feed.source_type=any(source_types)) and (created_after is null or feed.source_created_at>=created_after)
  ),scored as (
    select source_state.*,round((case when is_follow_related then 24 else 0 end+case when is_unread then 18 else 0 end
      +least(14,sqrt(greatest(reaction_count,0)::numeric)*2.4)+least(10,sqrt(greatest(comment_count,0)::numeric)*2.2)
      +least(12,ln(1+greatest(listener_count,0)::numeric)*1.8)+case source_type when 'radio_session' then 3 when 'podcast_episode' then 2 when 'podcast_comment' then 2 else 0 end
      +greatest(0,36*(1-greatest(0,extract(epoch from(ranking_epoch_input-source_created_at))/3600)/168)))::numeric,6) ranking_score
    from source_state where (feed_mode='popular' or(feed_mode='following' and is_follow_related)) and(not unread_only or is_unread) and(not saved_only or is_saved)
  )
  select feed_item_id,source_type,source_id,parent_source_id,community_id,channel_id,author_id,mentioned_user_ids,preview,source_created_at,source_updated_at,
    visibility_context,reaction_count,comment_count,listener_count,mention_count,is_unread,is_saved,is_follow_related,ranking_score,ranking_epoch_input
  from scored where feed_mode in('popular','following') and(cursor_rank is null or ranking_score<cursor_rank or(ranking_score=cursor_rank and source_created_at<cursor_created_at) or(ranking_score=cursor_rank and source_created_at=cursor_created_at and feed_item_id<cursor_feed_item_id))
  order by ranking_score desc,source_created_at desc,feed_item_id desc limit greatest(1,least(coalesce(result_limit,20),50));
$$;
revoke all on function public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],timestamptz,boolean,boolean,integer) from public,anon;
grant execute on function public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],timestamptz,boolean,boolean,integer) to authenticated;

create or replace view public.followed_content_stories_view with(security_invoker=true) as
select old.story_id,old.author_id,old.community_id,old.channel_id,old.message_id,
  case old.story_type when 'status' then 'profile_status' when 'voice' then 'voice' when 'event' then 'event' else null end::text source_type,
  null::uuid source_id,null::uuid parent_source_id,old.story_type,old.title,old.subtitle,old.body,old.image_url,old.gradient_variant,old.created_at,old.duration_seconds,old.mentioned_user_ids
from public.followed_user_stories_view old where old.message_id is null
union all
select 'content:'||feed.source_type||':'||feed.source_id::text,feed.author_id,feed.community_id,feed.channel_id,
  case when feed.source_type in('text_message','radio_chat') then feed.source_id else null end,
  feed.source_type,feed.source_id,feed.parent_source_id,
  case when feed.source_type='radio_session' then 'radio' when feed.source_type in('podcast_episode','podcast_comment') then 'podcast' else 'mention_highlight' end,
  left(coalesce(radio.title,podcast.title,feed.preview),120),
  case when feed.source_type='radio_session' then case when radio.status='live' then 'Radio live now' else 'Radio update' end
    when feed.source_type='podcast_comment' then 'Podcast comment' when feed.source_type='podcast_episode' then 'Podcast update' else 'Mention highlight' end,
  left(coalesce(comment.body,radio.description,podcast.description,feed.preview),360),coalesce(radio.cover_url,podcast.cover_url,media.public_url),
  case when feed.source_type='radio_session' then 'story-bg-voice' when feed.source_type in('podcast_episode','podcast_comment') then 'story-bg-event' else 'story-bg-warm' end,
  feed.source_created_at,case when feed.source_type='radio_session' then 10 else 9 end,feed.mentioned_user_ids
from public.unified_content_feed_view feed
join public.user_follows follow on follow.follower_id=auth.uid() and follow.followed_id=feed.author_id
left join public.radio_sessions radio on feed.source_type='radio_session' and radio.id=feed.source_id
left join public.podcast_episodes podcast on feed.source_type in('podcast_episode','podcast_comment') and podcast.id=coalesce(feed.parent_source_id,feed.source_id)
left join public.podcast_episode_comments comment on feed.source_type='podcast_comment' and comment.id=feed.source_id and comment.deleted_at is null
left join lateral(select attachment.public_url from public.attachments attachment where feed.source_type in('text_message','radio_chat') and attachment.message_id=feed.source_id and attachment.status='attached' and attachment.scan_status in('clean','skipped_development') order by attachment.created_at limit 1) media on true;
revoke all on public.followed_content_stories_view from public,anon;
grant select on public.followed_content_stories_view to authenticated;

create or replace function public.list_followed_content_stories(cursor_created_at timestamptz default null,cursor_story_id text default null,result_limit integer default 30)
returns setof public.followed_content_stories_view language sql stable security invoker set search_path=public,pg_temp as $$
  select * from public.followed_content_stories_view story where auth.uid() is not null and story.created_at>=now()-interval '7 days'
    and(cursor_created_at is null or story.created_at<cursor_created_at or(story.created_at=cursor_created_at and cursor_story_id is not null and story.story_id<cursor_story_id))
  order by story.created_at desc,story.story_id desc limit least(greatest(result_limit,1),60);
$$;
revoke all on function public.list_followed_content_stories(timestamptz,text,integer) from public,anon;
grant execute on function public.list_followed_content_stories(timestamptz,text,integer) to authenticated;;
