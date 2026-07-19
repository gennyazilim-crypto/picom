-- Production Mention Feed read model. Mention extraction is populated by a trusted
-- pipeline in Task 269; normal clients receive SELECT only.

create table if not exists public.message_mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (message_id, mentioned_user_id)
);
create index if not exists idx_message_mentions_user_created
  on public.message_mentions(mentioned_user_id, created_at desc, message_id);
create index if not exists idx_message_mentions_message
  on public.message_mentions(message_id, mentioned_user_id);
alter table public.message_mentions enable row level security;
revoke all on public.message_mentions from public, anon, authenticated;
grant select on public.message_mentions to authenticated;
drop policy if exists "message_mentions_select_visible_message" on public.message_mentions;
create policy "message_mentions_select_visible_message"
on public.message_mentions for select to authenticated
using (public.can_view_message(message_id));
-- Follow rows are relationship data, not a public social graph.
drop policy if exists "follows_select_authenticated" on public.user_follows;
drop policy if exists "follows_select_participants" on public.user_follows;
create policy "follows_select_participants"
on public.user_follows for select to authenticated
using (follower_id = auth.uid() or followed_id = auth.uid());
drop view if exists public.mention_feed_view;
create view public.mention_feed_view
with (security_invoker = true)
as
select
  message.id as message_id,
  message.community_id,
  message.channel_id,
  message.author_id,
  mention_data.mentioned_user_ids,
  message.body,
  null::text as title,
  message.created_at,
  case
    when exists (
      select 1
      from public.user_follows follow
      where follow.follower_id = auth.uid()
        and (
          follow.followed_id = message.author_id
          or follow.followed_id = any(mention_data.mentioned_user_ids)
        )
    ) then 'following'
    else 'popular_feed'
  end as source,
  coalesce(attachment_data.payload, '[]'::jsonb) as attachments,
  coalesce(reaction_data.payload, '[]'::jsonb) as reactions,
  0::bigint as view_count,
  0::bigint as comment_count,
  array[]::uuid[] as commenter_ids,
  least(100::numeric, coalesce(reaction_data.total_count, 0)::numeric * 2) as popularity_score,
  exists (
    select 1 from public.saved_messages saved
    where saved.user_id = auth.uid() and saved.message_id = message.id
  ) as is_saved
from public.messages message
join lateral (
  select array_agg(mention.mentioned_user_id order by mention.mentioned_user_id) as mentioned_user_ids
  from public.message_mentions mention
  where mention.message_id = message.id
) mention_data on cardinality(mention_data.mentioned_user_ids) > 0
left join lateral (
  select jsonb_agg(
    jsonb_build_object(
      'id', attachment.id,
      'public_url', attachment.public_url,
      'thumbnail_url', attachment.thumbnail_url,
      'file_name', attachment.file_name,
      'mime_type', attachment.mime_type,
      'width', attachment.width,
      'height', attachment.height,
      'scan_status', attachment.scan_status
    ) order by attachment.created_at, attachment.id
  ) as payload
  from public.attachments attachment
  where attachment.message_id = message.id
    and attachment.status = 'attached'
    and attachment.scan_status in ('clean', 'skipped_development')
    and attachment.public_url is not null
) attachment_data on true
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'emoji', grouped.emoji,
        'count', grouped.reaction_count,
        'reacted_by_current_user', grouped.reacted_by_current_user
      ) order by grouped.reaction_count desc, grouped.emoji
    ) as payload,
    sum(grouped.reaction_count)::bigint as total_count
  from (
    select
      reaction.emoji,
      count(*)::bigint as reaction_count,
      bool_or(reaction.user_id = auth.uid()) as reacted_by_current_user
    from public.message_reactions reaction
    where reaction.message_id = message.id
    group by reaction.emoji
  ) grouped
) reaction_data on true
where message.deleted_at is null
  and public.can_view_message(message.id)
  and not public.users_are_blocked(auth.uid(), message.author_id);
revoke all on public.mention_feed_view from public, anon;
grant select on public.mention_feed_view to authenticated;
create or replace function public.list_mention_feed(
  cursor_created_at timestamptz default null,
  cursor_message_id uuid default null,
  result_limit integer default 40
)
returns table (
  message_id uuid,
  community_id uuid,
  channel_id uuid,
  author_id uuid,
  mentioned_user_ids uuid[],
  body text,
  title text,
  created_at timestamptz,
  source text,
  attachments jsonb,
  reactions jsonb,
  view_count bigint,
  comment_count bigint,
  commenter_ids uuid[],
  popularity_score numeric,
  is_saved boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    feed.message_id,
    feed.community_id,
    feed.channel_id,
    feed.author_id,
    feed.mentioned_user_ids,
    feed.body,
    feed.title,
    feed.created_at,
    feed.source,
    feed.attachments,
    feed.reactions,
    feed.view_count,
    feed.comment_count,
    feed.commenter_ids,
    feed.popularity_score,
    feed.is_saved
  from public.mention_feed_view feed
  where auth.uid() is not null
    and (
      cursor_created_at is null
      or feed.created_at < cursor_created_at
      or (feed.created_at = cursor_created_at and cursor_message_id is not null and feed.message_id < cursor_message_id)
    )
  order by feed.created_at desc, feed.message_id desc
  limit least(greatest(result_limit, 1), 80);
$$;
revoke all on function public.list_mention_feed(timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_mention_feed(timestamptz, uuid, integer) to authenticated;
comment on table public.message_mentions is
  'Normalized mention references written by a trusted extraction pipeline; no message content is duplicated.';
comment on view public.mention_feed_view is
  'RLS-invoker Mention Feed projection. Private/inaccessible/deleted/blocked-author messages are excluded before returning rows.';
comment on function public.list_mention_feed(timestamptz, uuid, integer) is
  'Stable cursor page over the RLS-invoker Mention Feed projection.';
