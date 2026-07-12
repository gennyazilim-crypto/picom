-- Access-first Feed Algorithm V1 query. Direct messages are not a supported source type.

create index if not exists idx_content_mentions_recipient_source
  on public.content_mentions(mentioned_user_id,source_type,source_id);
create index if not exists idx_feed_user_states_user_opened
  on public.feed_user_states(user_id,opened_at desc) where opened_at is not null;

create or replace function public.feed_users_are_friends(viewer_id uuid,target_user_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select viewer_id is not null and target_user_id is not null and viewer_id<>target_user_id and exists(
    select 1 from public.friendships friendship
    where friendship.user_low_id=least(viewer_id,target_user_id)
      and friendship.user_high_id=greatest(viewer_id,target_user_id)
  );
$$;

create or replace function public.feed_item_has_friend_support(target_feed_item_id uuid,viewer_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item public.feed_items;
begin
  select * into item from public.feed_items where id=target_feed_item_id;
  if not found or viewer_id is null then return false; end if;
  return exists(
    select 1 from (
      select reaction.user_id as actor_id from public.message_reactions reaction
      where item.source_type in('text_message','radio_comment') and reaction.message_id=item.source_id
      union all select reply.author_id from public.messages reply
      where item.source_type in('text_message','radio_comment') and reply.reply_to_message_id=item.source_id and reply.deleted_at is null
      union all select saved.user_id from public.saved_messages saved
      where item.source_type in('text_message','radio_comment') and saved.message_id=item.source_id
      union all select reaction.user_id from public.radio_session_reactions reaction
      where item.source_type='radio_session' and reaction.radio_session_id=item.source_id
      union all select child.author_id from public.feed_items child
      where item.source_type='radio_session' and child.source_type='radio_comment' and child.parent_source_id=item.source_id and child.deleted_at is null and child.moderation_state='visible'
      union all select reaction.user_id from public.podcast_episode_reactions reaction
      where item.source_type='podcast_episode' and reaction.episode_id=item.source_id
      union all select comment.author_id from public.podcast_episode_comments comment
      where item.source_type='podcast_episode' and comment.episode_id=item.source_id and comment.deleted_at is null
      union all select reply.author_id from public.podcast_episode_comments reply
      where item.source_type='podcast_comment' and reply.reply_to_comment_id=item.source_id and reply.deleted_at is null
      union all select saved.user_id from public.saved_audio_items saved
      where item.source_type in('radio_session','podcast_episode') and saved.item_type=item.source_type and saved.item_id=item.source_id
    ) support
    where public.feed_users_are_friends(viewer_id,support.actor_id)
      and public.feed_actor_is_eligible(support.actor_id,item.author_id,item.community_id)
  );
end;
$$;

create or replace function public.get_feed_page(
  feed_tab text default 'feed',
  cursor_group_priority integer default null,
  cursor_final_score numeric default null,
  cursor_created_at timestamptz default null,
  cursor_feed_item_id uuid default null,
  as_of_input timestamptz default null,
  source_filters text[] default null,
  unread_only boolean default false,
  saved_only boolean default false,
  result_limit integer default 20,
  community_scope uuid default null
)
returns table(
  feed_item_id uuid,source_type text,source_id uuid,parent_source_id uuid,community_id uuid,channel_id uuid,author_id uuid,
  content_kind text,base_score numeric,source_created_at timestamptz,source_updated_at timestamptz,
  unique_external_reactors integer,unique_external_commenters integer,additional_reply_count integer,
  unique_external_savers integer,unique_external_viewers integer,external_supporter_count integer,
  reaction_score numeric,comment_score numeric,save_score numeric,view_score numeric,raw_score numeric,score_version smallint,
  is_direct_mention boolean,is_friend_author boolean,is_friend_engaged boolean,is_unread boolean,is_saved boolean,
  relevance_score numeric,freshness_decay numeric,final_score numeric,group_priority integer,ranking_as_of timestamptz,
  author_display_name text,author_username text,author_avatar_url text,community_name text,community_icon_url text
)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare viewer_id uuid:=auth.uid();effective_as_of timestamptz;
begin
  if viewer_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if feed_tab not in('feed','friends') then raise exception 'FEED_TAB_INVALID' using errcode='22023'; end if;
  if source_filters is not null and exists(select 1 from unnest(source_filters) value where value not in('text_message','radio_session','radio_comment','podcast_episode','podcast_comment')) then
    raise exception 'FEED_SOURCE_FILTER_INVALID' using errcode='22023';
  end if;
  if num_nonnulls(cursor_group_priority,cursor_final_score,cursor_created_at,cursor_feed_item_id) not in (0,4) then
    raise exception 'FEED_CURSOR_INCOMPLETE' using errcode='22023';
  end if;
  if cursor_group_priority is not null and as_of_input is null then raise exception 'FEED_CURSOR_AS_OF_REQUIRED' using errcode='22023'; end if;
  result_limit:=greatest(1,least(coalesce(result_limit,20),50));
  effective_as_of:=least(coalesce(as_of_input,statement_timestamp()),statement_timestamp());

  return query
  with visible_items as materialized (
    select item.*,rollup.unique_external_reactors,rollup.unique_external_commenters,rollup.additional_reply_count,
      rollup.unique_external_savers,rollup.unique_external_viewers,rollup.external_supporter_count,
      rollup.reaction_score,rollup.comment_score,rollup.save_score,rollup.view_score,rollup.raw_score,
      state.read_at,state.saved_at,state.hidden_at,
      profile.display_name as author_display_name,profile.username as author_username,profile.avatar_url as author_avatar_url,
      community.name as community_name,community.icon_url as community_icon_url
    from public.feed_items item
    join public.feed_engagement_rollups rollup on rollup.feed_item_id=item.id and rollup.score_version=item.score_version
    join public.profiles profile on profile.id=item.author_id and not coalesce(profile.is_bot,false) and profile.deletion_requested_at is null
    left join public.communities community on community.id=item.community_id
    left join public.feed_user_states state on state.feed_item_id=item.id and state.user_id=viewer_id
    where item.moderation_state='visible' and item.deleted_at is null and item.score_version=1
      and public.can_view_feed_item(item.id)
      and not public.users_are_blocked(viewer_id,item.author_id)
      and (item.community_id is null or (community.id is not null and community.archived_at is null))
      and (community_scope is null or item.community_id=community_scope)
      and (source_filters is null or item.source_type=any(source_filters))
      and state.hidden_at is null
  ),
  signals as (
    select visible.*,
      exists(
        select 1 from public.content_mentions mention
        where mention.mentioned_user_id=viewer_id and mention.source_id=visible.source_id
          and (case when mention.source_type='radio_chat' then 'radio_comment' else mention.source_type end)=visible.source_type
          and public.can_view_content_mention(mention)
      ) as direct_mention,
      public.feed_users_are_friends(viewer_id,visible.author_id) as friend_author,
      public.feed_item_has_friend_support(visible.id,viewer_id) as friend_engaged,
      (visible.read_at is null) as unread,
      (visible.saved_at is not null) as saved,
      exists(
        select 1 from public.feed_user_states recent_state
        join public.feed_items recent_item on recent_item.id=recent_state.feed_item_id
        where recent_state.user_id=viewer_id and recent_state.opened_at>=effective_as_of-interval '30 days'
          and recent_item.community_id=visible.community_id and visible.community_id is not null
      ) as recent_community
    from visible_items visible
  ),
  eligible as (
    select signal.*,
      ((case when signal.direct_mention then 8 else 0 end)
        +(case when signal.friend_author then 2 else 0 end)
        +(case when signal.friend_engaged then 1 else 0 end)
        +(case when signal.unread then 1 else 0 end)
        +(case when signal.recent_community then 1 else 0 end))::numeric as relevance,
      case when signal.direct_mention and signal.unread then 1
        when signal.friend_author or signal.friend_engaged then 2
        when not signal.direct_mention then 3 else 4 end as priority
    from signals signal
    where (signal.direct_mention or (signal.raw_score>=4 and signal.external_supporter_count>=1))
      and (feed_tab='feed' or (feed_tab='friends' and (signal.friend_author or signal.friend_engaged)))
      and (not unread_only or signal.unread)
      and (not saved_only or signal.saved)
  ),
  scored as (
    select candidate.*,
      round(power(2::numeric,(-greatest(0,extract(epoch from (effective_as_of-candidate.source_created_at))/3600)/48)::numeric),6) as decay,
      round((candidate.raw_score+candidate.relevance)*power(2::numeric,(-greatest(0,extract(epoch from (effective_as_of-candidate.source_created_at))/3600)/48)::numeric),6) as score
    from eligible candidate
  ),
  after_cursor as (
    select scored.* from scored where cursor_group_priority is null
      or scored.priority>cursor_group_priority
      or (scored.priority=cursor_group_priority and scored.score<cursor_final_score)
      or (scored.priority=cursor_group_priority and scored.score=cursor_final_score and scored.source_created_at<cursor_created_at)
      or (scored.priority=cursor_group_priority and scored.score=cursor_final_score and scored.source_created_at=cursor_created_at and scored.id<cursor_feed_item_id)
  ),
  direct_rows as (select candidate.* from after_cursor candidate where candidate.direct_mention),
  normal_positioned as (
    select candidate.*,
      row_number() over(order by candidate.priority,candidate.score desc,candidate.source_created_at desc,candidate.id desc) as normal_rank,
      lag(candidate.community_id) over(order by candidate.priority,candidate.score desc,candidate.source_created_at desc,candidate.id desc) as previous_community_id
    from after_cursor candidate where not candidate.direct_mention
  ),
  normal_segmented as (
    select candidate.*,floor((candidate.normal_rank-1)/20)::integer as diversity_window,
      sum(case when candidate.previous_community_id is distinct from candidate.community_id then 1 else 0 end)
        over(order by candidate.normal_rank) as community_segment
    from normal_positioned candidate
  ),
  normal_counted as (
    select candidate.*,
      row_number() over(partition by candidate.diversity_window,candidate.author_id order by candidate.normal_rank) as author_position,
      row_number() over(partition by candidate.diversity_window,candidate.community_id order by candidate.normal_rank) as community_position,
      row_number() over(partition by candidate.diversity_window,candidate.community_segment order by candidate.normal_rank) as consecutive_community_position
    from normal_segmented candidate
  ),
  diversified as (
    select candidate.id from direct_rows candidate
    union all
    select candidate.id from normal_counted candidate
    where candidate.author_position<=2 and candidate.community_position<=4 and candidate.consecutive_community_position<=2
  ),
  final_rows as (
    select candidate.* from after_cursor candidate join diversified allowed on allowed.id=candidate.id
  )
  select candidate.id,candidate.source_type,candidate.source_id,candidate.parent_source_id,candidate.community_id,candidate.channel_id,candidate.author_id,
    candidate.content_kind,candidate.base_score,candidate.source_created_at,candidate.source_updated_at,
    candidate.unique_external_reactors,candidate.unique_external_commenters,candidate.additional_reply_count,
    candidate.unique_external_savers,candidate.unique_external_viewers,candidate.external_supporter_count,
    candidate.reaction_score,candidate.comment_score,candidate.save_score,candidate.view_score,candidate.raw_score,candidate.score_version,
    candidate.direct_mention,candidate.friend_author,candidate.friend_engaged,candidate.unread,candidate.saved,
    candidate.relevance,candidate.decay,candidate.score,candidate.priority,effective_as_of,
    candidate.author_display_name,candidate.author_username,candidate.author_avatar_url,candidate.community_name,candidate.community_icon_url
  from final_rows candidate
  order by candidate.priority,candidate.score desc,candidate.source_created_at desc,candidate.id desc
  limit result_limit;
end;
$$;

revoke all on function public.feed_users_are_friends(uuid,uuid),public.feed_item_has_friend_support(uuid,uuid),
  public.get_feed_page(text,integer,numeric,timestamptz,uuid,timestamptz,text[],boolean,boolean,integer,uuid) from public,anon,authenticated;
grant execute on function public.get_feed_page(text,integer,numeric,timestamptz,uuid,timestamptz,text[],boolean,boolean,integer,uuid) to authenticated;

comment on function public.get_feed_page(text,integer,numeric,timestamptz,uuid,timestamptz,text[],boolean,boolean,integer,uuid) is
  'Feed Score V1 access-first keyset page. Friends use accepted friendships only; private-message sources are excluded.';
