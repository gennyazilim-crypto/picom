-- Task 482: authoritative unread projection and RLS-governed Feed realtime sources.

drop function if exists public.list_mention_feed(timestamptz, uuid, integer);

create or replace view public.mention_feed_view
with (security_invoker = true)
as
select
  message.id as message_id, message.community_id, message.channel_id, message.author_id,
  mention_data.mentioned_user_ids, message.body, null::text as title, message.created_at,
  case when exists(select 1 from public.user_follows follow where follow.follower_id=auth.uid() and (follow.followed_id=message.author_id or follow.followed_id=any(mention_data.mentioned_user_ids))) then 'following' else 'popular_feed' end as source,
  coalesce(attachment_data.payload,'[]'::jsonb) as attachments,
  coalesce(reaction_data.payload,'[]'::jsonb) as reactions,
  0::bigint as view_count,
  coalesce(reply_data.comment_count,0)::bigint as comment_count,
  coalesce(reply_data.commenter_ids,array[]::uuid[]) as commenter_ids,
  least(100::numeric,coalesce(reaction_data.total_count,0)::numeric*2 + coalesce(reply_data.comment_count,0)::numeric) as popularity_score,
  exists(select 1 from public.saved_messages saved where saved.user_id=auth.uid() and saved.message_id=message.id) as is_saved,
  coalesce(reply_data.comment_preview,'[]'::jsonb) as comment_preview,
  case when message.author_id=auth.uid() then false else not exists(
    select 1 from public.read_states read_state
    join public.messages read_message on read_message.id=read_state.last_read_message_id and read_message.channel_id=read_state.channel_id
    where read_state.user_id=auth.uid() and read_state.channel_id=message.channel_id
      and (read_message.created_at,read_message.id)>=(message.created_at,message.id)
  ) end as is_unread
from public.messages message
join lateral(select array_agg(mention.mentioned_user_id order by mention.mentioned_user_id) as mentioned_user_ids from public.message_mentions mention where mention.message_id=message.id) mention_data on cardinality(mention_data.mentioned_user_ids)>0
left join lateral(
  select jsonb_agg(jsonb_build_object('id',attachment.id,'public_url',attachment.public_url,'thumbnail_url',attachment.thumbnail_url,'file_name',attachment.file_name,'mime_type',attachment.mime_type,'width',attachment.width,'height',attachment.height,'scan_status',attachment.scan_status) order by attachment.created_at,attachment.id) as payload
  from public.attachments attachment where attachment.message_id=message.id and attachment.status='attached' and attachment.scan_status in('clean','skipped_development') and attachment.public_url is not null
) attachment_data on true
left join lateral(
  select jsonb_agg(jsonb_build_object('emoji',summary.emoji,'count',summary.reaction_count,'reacted_by_current_user',summary.reacted_by_current_user) order by summary.reaction_count desc,summary.emoji) as payload,
    sum(summary.reaction_count)::bigint as total_count
  from public.list_message_reaction_summaries(array[message.id]) summary
) reaction_data on true
left join lateral(
  select count(*)::bigint as comment_count,
    array_agg(distinct visible_reply.author_id) as commenter_ids,
    jsonb_agg(jsonb_build_object('id',visible_reply.id,'author_id',visible_reply.author_id,'body',left(visible_reply.body,180),'created_at',visible_reply.created_at) order by visible_reply.created_at desc,visible_reply.id desc)
      filter(where visible_reply.preview_rank<=2) as comment_preview
  from (
    select reply.id,reply.author_id,reply.body,reply.created_at,
      row_number() over(order by reply.created_at desc,reply.id desc) as preview_rank
    from public.messages reply
    where reply.reply_to_message_id=message.id and reply.channel_id=message.channel_id and reply.community_id=message.community_id
      and reply.deleted_at is null and reply.thread_id is null and public.can_view_message(reply.id)
      and not public.users_are_blocked(auth.uid(),reply.author_id)
  ) visible_reply
) reply_data on true
where message.deleted_at is null and public.can_view_message(message.id) and not public.users_are_blocked(auth.uid(),message.author_id);

revoke all on public.mention_feed_view from public, anon;
grant select on public.mention_feed_view to authenticated;

create function public.list_mention_feed(
  cursor_created_at timestamptz default null,
  cursor_message_id uuid default null,
  result_limit integer default 40
)
returns table(
  message_id uuid, community_id uuid, channel_id uuid, author_id uuid, mentioned_user_ids uuid[],
  body text, title text, created_at timestamptz, source text, attachments jsonb, reactions jsonb,
  view_count bigint, comment_count bigint, commenter_ids uuid[], popularity_score numeric, is_saved boolean,
  comment_preview jsonb, is_unread boolean
)
language sql stable security invoker set search_path=public
as $$
  select feed.message_id,feed.community_id,feed.channel_id,feed.author_id,feed.mentioned_user_ids,
    feed.body,feed.title,feed.created_at,feed.source,feed.attachments,feed.reactions,feed.view_count,
    feed.comment_count,feed.commenter_ids,feed.popularity_score,feed.is_saved,feed.comment_preview,feed.is_unread
  from public.mention_feed_view feed
  where auth.uid() is not null and (
    cursor_created_at is null or feed.created_at<cursor_created_at
    or (feed.created_at=cursor_created_at and cursor_message_id is not null and feed.message_id<cursor_message_id)
  )
  order by feed.created_at desc,feed.message_id desc
  limit least(greatest(result_limit,1),80);
$$;

revoke all on function public.list_mention_feed(timestamptz,uuid,integer) from public,anon;
grant execute on function public.list_mention_feed(timestamptz,uuid,integer) to authenticated;

do $$
declare source_table text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach source_table in array array['content_mentions','messages','message_reactions','read_states','saved_messages','radio_sessions','radio_session_reactions','podcast_episodes','podcast_episode_reactions','podcast_episode_comments'] loop
      if to_regclass('public.'||source_table) is not null and not exists(
        select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=source_table
      ) then execute format('alter publication supabase_realtime add table public.%I',source_table); end if;
    end loop;
  end if;
end;
$$;

comment on view public.mention_feed_view is 'RLS-invoker Feed projection with current-user save, reaction, reply preview, and channel read-state reconciliation.';
comment on function public.list_mention_feed(timestamptz,uuid,integer) is 'Stable cursor Feed page including authoritative current-user unread state.';;
