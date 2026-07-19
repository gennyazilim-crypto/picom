-- The renderer requests one look-ahead row so a full terminal page does not
-- advertise a cursor that only leads to an empty page. Public pages remain
-- capped at 50 visible items; row 51 is never rendered.
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
  order by ranking_score desc,source_created_at desc,feed_item_id desc limit greatest(1,least(coalesce(result_limit,20),51));
$$;

revoke all on function public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],timestamptz,boolean,boolean,integer) from public,anon;
grant execute on function public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],timestamptz,boolean,boolean,integer) to authenticated;

create index if not exists content_mentions_ranked_feed_idx
  on public.content_mentions(source_type, source_created_at desc, id desc);

alter table public.user_follows replica identity full;
alter table public.saved_audio_items replica identity full;
alter table public.audio_feed_read_states replica identity full;

do $$
declare source_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach source_table in array array['user_follows','saved_audio_items','audio_feed_read_states'] loop
      if to_regclass('public.'||source_table) is not null and not exists(
        select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=source_table
      ) then execute format('alter publication supabase_realtime add table public.%I',source_table); end if;
    end loop;
  end if;
end $$;

comment on function public.list_ranked_unified_feed(text,timestamptz,numeric,timestamptz,uuid,text[],timestamptz,boolean,boolean,integer)
  is 'RLS-invoker unified Text, Radio, and Podcast Feed query with stable keyset pagination and one-row look-ahead support.';;
