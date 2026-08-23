-- Feed attachments: project private storage_path instead of requiring public_url.
-- message-attachments is a private bucket; uploads intentionally persist public_url = null.
--
-- Audit (2026-08-02):
-- - Forward-only REPLACE of security_invoker view (idempotent re-apply safe).
-- - Does not change list_mention_feed / list_ranked_unified_feed signatures or cursor order.
-- - Attachment paths appear only on rows already filtered by can_view_message + block checks.
-- - No SECURITY DEFINER; no PUBLIC/anon grants (revoke + authenticated SELECT only).
-- - Forward-fix if needed: recreate prior attachment lateral that required public_url IS NOT NULL
--   (see 20260711148200_feed_realtime_unread_projection.sql) — prefer additive follow-up migration.
-- Dependency: requires mention_feed_view + attachments + can_view_message (feed production lineage).

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
  select jsonb_agg(jsonb_build_object(
    'id',attachment.id,
    'storage_path',attachment.storage_path,
    'public_url',attachment.public_url,
    'thumbnail_url',attachment.thumbnail_url,
    'file_name',attachment.file_name,
    'mime_type',attachment.mime_type,
    'width',attachment.width,
    'height',attachment.height,
    'scan_status',attachment.scan_status
  ) order by attachment.created_at,attachment.id) as payload
  from public.attachments attachment
  where attachment.message_id=message.id
    and attachment.status='attached'
    and attachment.scan_status in('clean','skipped_development')
    and nullif(btrim(attachment.storage_path),'') is not null
    -- Reject obvious traversal / absolute / foreign-looking keys before projection.
    and position('..' in attachment.storage_path) = 0
    and attachment.storage_path !~ '[\\]'
    and attachment.storage_path !~ '^/'
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

comment on view public.mention_feed_view is
  'RLS-invoker Feed projection; attachments expose storage_path for private-bucket signed URL resolution.';
