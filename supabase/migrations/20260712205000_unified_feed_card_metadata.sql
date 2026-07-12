-- Unified Feed card hydration: safe comment previews and approved verification summaries.

create or replace function public.feed_comment_previews_v1(target_feed_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item public.feed_items;result jsonb;
begin
  select * into item from public.feed_items where id=target_feed_item_id;
  if not found or not public.can_view_feed_item(item.id) then return '[]'::jsonb; end if;
  with events as (
    select reply.id,reply.author_id,left(btrim(reply.body),180) as body,reply.created_at from public.messages reply
    where item.source_type in('text_message','radio_comment') and reply.reply_to_message_id=item.source_id and reply.deleted_at is null
      and not exists(select 1 from public.moderation_action_records action where action.action_type='message_delete' and action.target_id=reply.id)
    union all
    select child.source_id,child.author_id,left(btrim(message.body),180),child.source_created_at
    from public.feed_items child join public.messages message on message.id=child.source_id and message.deleted_at is null
    where item.source_type='radio_session' and child.source_type='radio_comment' and child.parent_source_id=item.source_id and child.deleted_at is null and child.moderation_state='visible'
    union all
    select comment.id,comment.author_id,left(btrim(comment.body),180),comment.created_at from public.podcast_episode_comments comment
    where item.source_type='podcast_episode' and comment.episode_id=item.source_id and comment.deleted_at is null
    union all
    select reply.id,reply.author_id,left(btrim(reply.body),180),reply.created_at from public.podcast_episode_comments reply
    where item.source_type='podcast_comment' and reply.reply_to_comment_id=item.source_id and reply.deleted_at is null
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',preview.id,'author_id',preview.author_id,'body',preview.body,'created_at',preview.created_at)
    order by preview.created_at desc,preview.id desc),'[]'::jsonb) into result
  from (select event.* from events event where public.feed_actor_is_eligible(event.author_id,item.author_id,item.community_id)
    order by event.created_at desc,event.id desc limit 2) preview;
  return result;
end;
$$;

create or replace function public.get_feed_item_metadata_v2(target_feed_item_ids uuid[])
returns table(feed_item_id uuid,source_payload jsonb,reaction_summary jsonb,commenter_ids uuid[],comment_count integer,comment_previews jsonb)
language sql stable security definer set search_path=public,pg_temp as $$
  with requested as (select distinct requested_id from unnest(coalesce(target_feed_item_ids,'{}'::uuid[])) requested_id limit 50),
  visible as (
    select item.id from requested join public.feed_items item on item.id=requested.requested_id
    where item.deleted_at is null and item.moderation_state='visible' and public.can_view_feed_item(item.id)
      and not public.users_are_blocked(auth.uid(),item.author_id)
  )
  select visible.id,payload.value,reactions.value,
    coalesce(array(select value::uuid from jsonb_array_elements_text(comments.value->'commenter_ids') value),'{}'::uuid[]),
    coalesce((comments.value->>'comment_count')::integer,0),previews.value
  from visible
  cross join lateral(select public.feed_source_payload_v1(visible.id) as value) payload
  cross join lateral(select public.feed_reaction_summary_v1(visible.id) as value) reactions
  cross join lateral(select public.feed_comment_summary_v1(visible.id) as value) comments
  cross join lateral(select public.feed_comment_previews_v1(visible.id) as value) previews
  where payload.value is not null;
$$;

create or replace function public.get_feed_author_verifications(target_user_ids uuid[])
returns table(user_id uuid,verification_type text)
language sql stable security definer set search_path=public,pg_temp as $$
  select distinct on (verification.user_id) verification.user_id,
    case when verification.type='creator_verified' then 'verified_user' else verification.type end
  from public.profile_verifications verification
  join (select distinct id from unnest(coalesce(target_user_ids,'{}'::uuid[])) id limit 100) requested on requested.id=verification.user_id
  where verification.status='approved' and verification.revoked_at is null
  order by verification.user_id,case verification.type when 'picom_staff' then 1 when 'verified_user' then 2 when 'creator_verified' then 3 else 4 end,verification.reviewed_at desc nulls last;
$$;

revoke all on function public.feed_comment_previews_v1(uuid),public.get_feed_item_metadata_v2(uuid[]),public.get_feed_author_verifications(uuid[]) from public,anon,authenticated;
grant execute on function public.get_feed_item_metadata_v2(uuid[]),public.get_feed_author_verifications(uuid[]) to authenticated;
comment on function public.feed_comment_previews_v1(uuid) is 'At most two access-checked short comment previews; no unsafe HTML.';

