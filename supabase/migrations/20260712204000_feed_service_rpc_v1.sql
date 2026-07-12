-- Batch Feed hydration and user-state RPCs. Source content is returned only after access checks.

create or replace function public.feed_source_payload_v1(target_feed_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item public.feed_items;payload jsonb;
begin
  select * into item from public.feed_items where id=target_feed_item_id and deleted_at is null and moderation_state='visible';
  if not found or not public.can_view_feed_item(item.id) then return null; end if;
  if item.source_type in('text_message','radio_comment') then
    select jsonb_strip_nulls(jsonb_build_object(
      'body',message.body,
      'attachments',coalesce((
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'id',attachment.id,'url',attachment.public_url,'thumbnail_url',attachment.thumbnail_url,
          'file_name',attachment.file_name,'mime_type',attachment.mime_type,'width',attachment.width,'height',attachment.height
        )) order by attachment.created_at,attachment.id)
        from public.attachments attachment where attachment.message_id=message.id and attachment.status='attached'
          and attachment.scan_status in('clean','skipped_development') and attachment.public_url is not null
      ),'[]'::jsonb)
    )) into payload from public.messages message where message.id=item.source_id and message.deleted_at is null;
  elsif item.source_type='radio_session' then
    select jsonb_strip_nulls(jsonb_build_object(
      'title',session.title,'body',session.description,'status',session.status,'starts_at',session.starts_at,
      'duration_seconds',greatest(0,extract(epoch from (coalesce(session.ended_at,session.scheduled_end_at,statement_timestamp())-coalesce(session.actual_started_at,session.starts_at)))::integer),
      'listener_count',session.listener_count,'cover_url',session.cover_url,'host_id',session.host_user_id
    )) into payload from public.radio_sessions session where session.id=item.source_id and session.status in('scheduled','live','ended');
  elsif item.source_type='podcast_episode' then
    select jsonb_strip_nulls(jsonb_build_object(
      'title',episode.title,'body',episode.description,'status',episode.status,'duration_seconds',episode.duration_seconds,
      'cover_url',episode.cover_url,'author_id',episode.author_user_id
    )) into payload from public.podcast_episodes episode where episode.id=item.source_id and episode.status='published';
  elsif item.source_type='podcast_comment' then
    select jsonb_strip_nulls(jsonb_build_object('body',comment.body,'podcast_episode_id',comment.episode_id,'author_id',comment.author_id))
    into payload from public.podcast_episode_comments comment where comment.id=item.source_id and comment.deleted_at is null;
  end if;
  return payload;
end;
$$;

create or replace function public.feed_reaction_summary_v1(target_feed_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item public.feed_items;result jsonb;
begin
  select * into item from public.feed_items where id=target_feed_item_id;
  if not found or not public.can_view_feed_item(item.id) then return '[]'::jsonb; end if;
  with events as (
    select reaction.user_id,reaction.emoji from public.message_reactions reaction where item.source_type in('text_message','radio_comment') and reaction.message_id=item.source_id
    union all select reaction.user_id,reaction.emoji from public.radio_session_reactions reaction where item.source_type='radio_session' and reaction.radio_session_id=item.source_id
    union all select reaction.user_id,reaction.emoji from public.podcast_episode_reactions reaction where item.source_type='podcast_episode' and reaction.episode_id=item.source_id
  ),summary as (
    select event.emoji,count(*)::integer as reaction_count,bool_or(event.user_id=auth.uid()) as reacted_by_current_user
    from events event where public.feed_actor_is_eligible(event.user_id,item.author_id,item.community_id) group by event.emoji
  )
  select coalesce(jsonb_agg(jsonb_build_object('emoji',summary.emoji,'count',summary.reaction_count,'reacted_by_current_user',summary.reacted_by_current_user)
    order by summary.reaction_count desc,summary.emoji),'[]'::jsonb) into result from summary;
  return result;
end;
$$;

create or replace function public.feed_comment_summary_v1(target_feed_item_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare item public.feed_items;result jsonb;
begin
  select * into item from public.feed_items where id=target_feed_item_id;
  if not found or not public.can_view_feed_item(item.id) then return jsonb_build_object('commenter_ids','[]'::jsonb,'comment_count',0); end if;
  with events as (
    select reply.author_id as actor_id,reply.created_at from public.messages reply
    where item.source_type in('text_message','radio_comment') and reply.reply_to_message_id=item.source_id and reply.deleted_at is null
      and not exists(select 1 from public.moderation_action_records action where action.action_type='message_delete' and action.target_id=reply.id)
    union all select child.author_id,child.source_created_at from public.feed_items child
    where item.source_type='radio_session' and child.source_type='radio_comment' and child.parent_source_id=item.source_id and child.deleted_at is null and child.moderation_state='visible'
    union all select comment.author_id,comment.created_at from public.podcast_episode_comments comment
    where item.source_type='podcast_episode' and comment.episode_id=item.source_id and comment.deleted_at is null
    union all select reply.author_id,reply.created_at from public.podcast_episode_comments reply
    where item.source_type='podcast_comment' and reply.reply_to_comment_id=item.source_id and reply.deleted_at is null
  ),valid as (
    select event.actor_id,event.created_at from events event where public.feed_actor_is_eligible(event.actor_id,item.author_id,item.community_id)
  ),recent_commenters as (
    select valid.actor_id,max(valid.created_at) as latest_at from valid group by valid.actor_id order by latest_at desc limit 8
  )
  select jsonb_build_object(
    'commenter_ids',coalesce((select to_jsonb(array_agg(recent.actor_id order by recent.latest_at desc)) from recent_commenters recent),'[]'::jsonb),
    'comment_count',(select count(*)::integer from valid)
  ) into result;
  return result;
end;
$$;

create or replace function public.get_feed_item_metadata(target_feed_item_ids uuid[])
returns table(feed_item_id uuid,source_payload jsonb,reaction_summary jsonb,commenter_ids uuid[],comment_count integer)
language sql stable security definer set search_path=public,pg_temp as $$
  with requested as (
    select distinct requested_id from unnest(coalesce(target_feed_item_ids,'{}'::uuid[])) requested_id limit 50
  ),visible as (
    select item.id from requested join public.feed_items item on item.id=requested.requested_id
    where item.deleted_at is null and item.moderation_state='visible' and public.can_view_feed_item(item.id)
      and not public.users_are_blocked(auth.uid(),item.author_id)
  )
  select visible.id,payload.value,reactions.value,
    coalesce(array(select value::uuid from jsonb_array_elements_text(comments.value->'commenter_ids') value),'{}'::uuid[]),
    coalesce((comments.value->>'comment_count')::integer,0)
  from visible
  cross join lateral (select public.feed_source_payload_v1(visible.id) as value) payload
  cross join lateral (select public.feed_reaction_summary_v1(visible.id) as value) reactions
  cross join lateral (select public.feed_comment_summary_v1(visible.id) as value) comments
  where payload.value is not null;
$$;

create or replace function public.set_feed_user_state_v1(target_feed_item_id uuid,target_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare viewer_id uuid:=auth.uid();state public.feed_user_states;changed_at timestamptz:=statement_timestamp();
begin
  if viewer_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_action not in('read','save','unsave','hide','seen','opened') then raise exception 'FEED_STATE_ACTION_INVALID' using errcode='22023'; end if;
  if not public.can_view_feed_item(target_feed_item_id) then raise exception 'FEED_ITEM_ACCESS_LOST' using errcode='42501'; end if;
  insert into public.feed_user_states(user_id,feed_item_id) values(viewer_id,target_feed_item_id)
  on conflict(user_id,feed_item_id) do nothing;
  update public.feed_user_states set
    read_at=case when target_action in('read','opened') then changed_at else read_at end,
    saved_at=case when target_action='save' then changed_at when target_action='unsave' then null else saved_at end,
    hidden_at=case when target_action='hide' then changed_at else hidden_at end,
    first_seen_at=case when target_action in('seen','opened','read') then coalesce(first_seen_at,changed_at) else first_seen_at end,
    last_seen_at=case when target_action in('seen','opened','read') then changed_at else last_seen_at end,
    opened_at=case when target_action='opened' then changed_at else opened_at end
  where user_id=viewer_id and feed_item_id=target_feed_item_id returning * into state;
  if target_action='opened' then
    update public.feed_impressions set opened_at=coalesce(opened_at,changed_at)
    where id=(select impression.id from public.feed_impressions impression where impression.user_id=viewer_id and impression.feed_item_id=target_feed_item_id order by impression.shown_at desc limit 1);
  end if;
  return jsonb_build_object('feed_item_id',state.feed_item_id,'is_read',state.read_at is not null,'is_saved',state.saved_at is not null,
    'is_hidden',state.hidden_at is not null,'read_at',state.read_at,'saved_at',state.saved_at,'opened_at',state.opened_at);
end;
$$;

create or replace function public.record_feed_impressions_v1(target_session_id uuid,target_feed_item_ids uuid[],target_positions integer[],target_feed_mode text,target_as_of timestamptz)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare viewer_id uuid:=auth.uid();item_count integer;position_index integer;written integer:=0;
begin
  if viewer_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  item_count:=cardinality(target_feed_item_ids);
  if target_session_id is null or target_feed_mode not in('feed','friends') or target_as_of is null or item_count<1 or item_count>50 or item_count<>cardinality(target_positions) then
    raise exception 'FEED_IMPRESSION_INPUT_INVALID' using errcode='22023';
  end if;
  for position_index in 1..item_count loop
    if target_positions[position_index]>=0 and public.can_view_feed_item(target_feed_item_ids[position_index]) then
      insert into public.feed_impressions(user_id,feed_item_id,session_id,position,surface,feed_mode,score_version,as_of,shown_at)
      values(viewer_id,target_feed_item_ids[position_index],target_session_id,target_positions[position_index],'mention_feed',target_feed_mode,1,target_as_of,statement_timestamp())
      on conflict(user_id,session_id,feed_item_id) do update set position=excluded.position,as_of=excluded.as_of;
      written:=written+1;
    end if;
  end loop;
  return written;
end;
$$;

revoke all on function public.feed_source_payload_v1(uuid),public.feed_reaction_summary_v1(uuid),public.feed_comment_summary_v1(uuid),
  public.get_feed_item_metadata(uuid[]),public.set_feed_user_state_v1(uuid,text),public.record_feed_impressions_v1(uuid,uuid[],integer[],text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.get_feed_item_metadata(uuid[]),public.set_feed_user_state_v1(uuid,text),
  public.record_feed_impressions_v1(uuid,uuid[],integer[],text,timestamptz) to authenticated;

comment on function public.get_feed_item_metadata(uuid[]) is 'Access-checked batch hydration. Returns no tokens, storage paths, or inaccessible source data.';
comment on function public.record_feed_impressions_v1(uuid,uuid[],integer[],text,timestamptz) is 'Privacy-minimal batch impression recorder; source bodies are never persisted.';

