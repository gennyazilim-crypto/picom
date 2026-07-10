-- Aggregate-safe reaction reads and mutations. Renderer clients receive counts
-- and their own boolean state, never another user's reaction identity.

create index if not exists idx_reactions_message_emoji_user
  on public.message_reactions(message_id, emoji, user_id);

create or replace function public.list_message_reaction_summaries(target_message_ids uuid[])
returns table(message_id uuid, emoji text, reaction_count bigint, reacted_by_current_user boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requested as (
    select distinct requested_id
    from unnest(coalesce(target_message_ids[1:100], array[]::uuid[])) requested_id
  ),
  grouped as (
    select reaction.message_id, reaction.emoji, count(*)::bigint as reaction_count,
      bool_or(reaction.user_id = auth.uid()) as reacted_by_current_user
    from requested
    join public.messages message on message.id = requested.requested_id
    join public.message_reactions reaction on reaction.message_id = message.id
    where auth.uid() is not null
      and message.deleted_at is null
      and public.can_view_message(message.id)
    group by reaction.message_id, reaction.emoji
  ),
  ranked as (
    select grouped.*, row_number() over(partition by grouped.message_id order by grouped.reaction_count desc, grouped.emoji) as emoji_rank
    from grouped
  )
  select ranked.message_id, ranked.emoji, ranked.reaction_count, ranked.reacted_by_current_user
  from ranked
  where ranked.emoji_rank <= 8
  order by ranked.message_id, ranked.reaction_count desc, ranked.emoji;
$$;

create or replace function public.set_message_reaction(target_message_id uuid, target_emoji text, target_reacted boolean)
returns table(message_id uuid, emoji text, reaction_count bigint, reacted_by_current_user boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_emoji text := btrim(target_emoji);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if normalized_emoji = '' or char_length(normalized_emoji) > 64 or normalized_emoji ~ '[[:cntrl:]]' then
    raise exception 'REACTION_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.messages message
    join public.community_members member on member.community_id = message.community_id and member.user_id = auth.uid()
    where message.id = target_message_id and message.deleted_at is null and public.can_view_message(message.id)
  ) then
    raise exception 'REACTION_FORBIDDEN' using errcode = '42501';
  end if;

  if target_reacted then
    insert into public.message_reactions(message_id, user_id, emoji)
    values(target_message_id, auth.uid(), normalized_emoji)
    on conflict(message_id, user_id, emoji) do nothing;
  else
    delete from public.message_reactions reaction
    where reaction.message_id = target_message_id and reaction.user_id = auth.uid() and reaction.emoji = normalized_emoji;
  end if;

  return query
  select target_message_id, normalized_emoji, count(reaction.id)::bigint,
    exists(select 1 from public.message_reactions mine where mine.message_id=target_message_id and mine.user_id=auth.uid() and mine.emoji=normalized_emoji)
  from public.message_reactions reaction
  where reaction.message_id = target_message_id and reaction.emoji = normalized_emoji;
end;
$$;

revoke all on function public.list_message_reaction_summaries(uuid[]), public.set_message_reaction(uuid,text,boolean) from public, anon;
grant execute on function public.list_message_reaction_summaries(uuid[]), public.set_message_reaction(uuid,text,boolean) to authenticated;
revoke insert, delete on public.message_reactions from authenticated;

drop policy if exists "message_reactions_select_visible_message" on public.message_reactions;
drop policy if exists "message_reactions_select_own_visible_message" on public.message_reactions;
create policy "message_reactions_select_own_visible_message"
on public.message_reactions for select to authenticated
using(user_id = auth.uid() and public.can_view_message(message_id));

create or replace view public.mention_feed_view
with (security_invoker = true)
as
select
  message.id as message_id, message.community_id, message.channel_id, message.author_id,
  mention_data.mentioned_user_ids, message.body, null::text as title, message.created_at,
  case when exists(select 1 from public.user_follows follow where follow.follower_id=auth.uid() and (follow.followed_id=message.author_id or follow.followed_id=any(mention_data.mentioned_user_ids))) then 'following' else 'popular_feed' end as source,
  coalesce(attachment_data.payload,'[]'::jsonb) as attachments,
  coalesce(reaction_data.payload,'[]'::jsonb) as reactions,
  0::bigint as view_count, 0::bigint as comment_count, array[]::uuid[] as commenter_ids,
  least(100::numeric,coalesce(reaction_data.total_count,0)::numeric*2) as popularity_score,
  exists(select 1 from public.saved_messages saved where saved.user_id=auth.uid() and saved.message_id=message.id) as is_saved
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
where message.deleted_at is null and public.can_view_message(message.id) and not public.users_are_blocked(auth.uid(),message.author_id);

comment on function public.list_message_reaction_summaries(uuid[]) is 'Returns up to eight aggregate emoji counts per visible message plus only the caller reaction boolean; no reactor identities.';
comment on function public.set_message_reaction(uuid,text,boolean) is 'Idempotent member-only reaction mutation returning one aggregate-safe summary row.';
