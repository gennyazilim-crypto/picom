-- Event-driven Feed Algorithm V1 source synchronization and engagement repair.

create or replace function public.feed_actor_is_eligible(target_actor_id uuid, target_author_id uuid, target_community_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select target_actor_id is not null
    and target_actor_id <> target_author_id
    and exists (
      select 1 from public.profiles profile
      where profile.id = target_actor_id
        and not coalesce(profile.is_bot, false)
        and profile.deletion_requested_at is null
    )
    and (
      target_community_id is null
      or not exists (
        select 1 from public.community_bans ban
        where ban.community_id = target_community_id
          and ban.user_id = target_actor_id
          and ban.revoked_at is null
      )
    );
$$;

create or replace function public.rebuild_feed_engagement_rollup(target_feed_item_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare
  item public.feed_items;
  reactor_count integer := 0;
  commenter_count integer := 0;
  additional_count integer := 0;
  saver_count integer := 0;
  viewer_count integer := 0;
  supporter_count integer := 0;
  reaction_component numeric := 0;
  comment_component numeric := 0;
  save_component numeric := 0;
  view_component numeric := 0;
  latest_event_at timestamptz;
begin
  select * into item from public.feed_items where id = target_feed_item_id;
  if not found then return false; end if;

  with reaction_events as (
    select reaction.user_id as actor_id, reaction.created_at
    from public.message_reactions reaction
    where item.source_type in ('text_message','radio_comment') and reaction.message_id = item.source_id
    union all
    select reaction.user_id, reaction.created_at
    from public.radio_session_reactions reaction
    where item.source_type = 'radio_session' and reaction.radio_session_id = item.source_id
    union all
    select reaction.user_id, reaction.created_at
    from public.podcast_episode_reactions reaction
    where item.source_type = 'podcast_episode' and reaction.episode_id = item.source_id
  ),
  valid_reactions as (
    select event.actor_id, max(event.created_at) as latest_at
    from reaction_events event
    where public.feed_actor_is_eligible(event.actor_id, item.author_id, item.community_id)
    group by event.actor_id
  ),
  comment_events as (
    select reply.author_id as actor_id, reply.created_at
    from public.messages reply
    where item.source_type in ('text_message','radio_comment')
      and reply.reply_to_message_id = item.source_id
      and reply.deleted_at is null
      and not exists (
        select 1 from public.moderation_action_records action
        where action.action_type = 'message_delete' and action.target_id = reply.id
      )
    union all
    select comment.author_id, comment.created_at
    from public.podcast_episode_comments comment
    where item.source_type = 'podcast_episode'
      and comment.episode_id = item.source_id
      and comment.deleted_at is null
    union all
    select reply.author_id, reply.created_at
    from public.podcast_episode_comments reply
    where item.source_type = 'podcast_comment'
      and reply.reply_to_comment_id = item.source_id
      and reply.deleted_at is null
    union all
    select child.author_id, child.source_created_at
    from public.feed_items child
    where item.source_type = 'radio_session'
      and child.source_type = 'radio_comment'
      and child.parent_source_id = item.source_id
      and child.deleted_at is null
      and child.moderation_state = 'visible'
  ),
  valid_commenters as (
    select event.actor_id, count(*)::integer as event_count, max(event.created_at) as latest_at
    from comment_events event
    where public.feed_actor_is_eligible(event.actor_id, item.author_id, item.community_id)
    group by event.actor_id
  ),
  save_events as (
    select saved.user_id as actor_id, saved.created_at
    from public.saved_messages saved
    where item.source_type in ('text_message','radio_comment') and saved.message_id = item.source_id
    union all
    select saved.user_id, saved.created_at
    from public.saved_audio_items saved
    where item.source_type in ('radio_session','podcast_episode')
      and saved.item_type = item.source_type
      and saved.item_id = item.source_id
  ),
  valid_savers as (
    select event.actor_id, max(event.created_at) as latest_at
    from save_events event
    where public.feed_actor_is_eligible(event.actor_id, item.author_id, item.community_id)
    group by event.actor_id
  ),
  valid_viewers as (
    select impression.user_id as actor_id, max(impression.opened_at) as latest_at
    from public.feed_impressions impression
    where impression.feed_item_id = item.id
      and impression.opened_at is not null
      and public.feed_actor_is_eligible(impression.user_id, item.author_id, item.community_id)
    group by impression.user_id
  ),
  supporters as (
    select actor_id from valid_reactions
    union select actor_id from valid_commenters
    union select actor_id from valid_savers
  ),
  event_times as (
    select latest_at from valid_reactions
    union all select latest_at from valid_commenters
    union all select latest_at from valid_savers
    union all select latest_at from valid_viewers
  )
  select
    (select count(*)::integer from valid_reactions),
    (select count(*)::integer from valid_commenters),
    coalesce((select sum(greatest(event_count - 1, 0))::integer from valid_commenters), 0),
    (select count(*)::integer from valid_savers),
    (select count(*)::integer from valid_viewers),
    (select count(*)::integer from supporters),
    least(10, (select count(*) from valid_reactions))::numeric,
    (
      least(20, (select count(*) from valid_commenters) * 2)
      + coalesce((select sum(least(2::numeric, greatest(event_count - 1, 0) * 0.5)) from valid_commenters), 0)
    )::numeric,
    least(10, (select count(*) from valid_savers) * 2)::numeric,
    least(3::numeric, (select count(*) from valid_viewers) * 0.1)::numeric,
    (select max(latest_at) from event_times)
  into reactor_count, commenter_count, additional_count, saver_count, viewer_count, supporter_count,
    reaction_component, comment_component, save_component, view_component, latest_event_at;

  insert into public.feed_engagement_rollups(
    feed_item_id, unique_external_reactors, unique_external_commenters, additional_reply_count,
    unique_external_savers, unique_external_viewers, external_supporter_count,
    reaction_score, comment_score, save_score, view_score, raw_score, score_version, updated_at
  ) values (
    item.id, reactor_count, commenter_count, additional_count,
    saver_count, viewer_count, supporter_count,
    reaction_component, comment_component, save_component, view_component,
    round((item.base_score + reaction_component + comment_component + save_component + view_component)::numeric, 2),
    item.score_version, now()
  )
  on conflict (feed_item_id) do update set
    unique_external_reactors = excluded.unique_external_reactors,
    unique_external_commenters = excluded.unique_external_commenters,
    additional_reply_count = excluded.additional_reply_count,
    unique_external_savers = excluded.unique_external_savers,
    unique_external_viewers = excluded.unique_external_viewers,
    external_supporter_count = excluded.external_supporter_count,
    reaction_score = excluded.reaction_score,
    comment_score = excluded.comment_score,
    save_score = excluded.save_score,
    view_score = excluded.view_score,
    raw_score = excluded.raw_score,
    score_version = excluded.score_version,
    updated_at = excluded.updated_at;

  update public.feed_items set last_engagement_at = latest_event_at where id = item.id;
  return true;
end;
$$;

create or replace function public.refresh_feed_rollup_for_source(target_source_type text, target_source_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare target_id uuid; refreshed integer := 0;
begin
  for target_id in
    select item.id from public.feed_items item
    where item.source_type = target_source_type and item.source_id = target_source_id
  loop
    perform public.rebuild_feed_engagement_rollup(target_id);
    refreshed := refreshed + 1;
  end loop;
  return refreshed;
end;
$$;

create or replace function public.sync_message_feed_item(target_message_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  source public.messages;
  radio_parent_id uuid;
  canonical_type text := 'text_message';
  has_text boolean := false;
  has_image boolean := false;
  has_video boolean := false;
  resolved_kind text;
  resolved_base numeric;
  target_feed_item_id uuid;
  is_moderated boolean := false;
begin
  select * into source from public.messages where id = target_message_id;
  if not found then
    update public.feed_items set moderation_state='removed', deleted_at=coalesce(deleted_at,now()), updated_at=now()
    where source_type in ('text_message','radio_comment') and source_id=target_message_id;
    return null;
  end if;

  select session.id into radio_parent_id
  from public.radio_sessions session
  where session.listener_chat_channel_id = source.channel_id and session.status in ('scheduled','live','ended')
  order by session.starts_at desc, session.id desc limit 1;
  if radio_parent_id is not null then canonical_type := 'radio_comment'; end if;

  select exists(
    select 1 from public.moderation_action_records action
    where action.action_type='message_delete' and action.target_id=source.id
  ) into is_moderated;
  has_text := char_length(btrim(coalesce(source.body,''))) > 0;
  select
    coalesce(bool_or(lower(attachment.mime_type) like 'image/%'),false),
    coalesce(bool_or(lower(attachment.mime_type) like 'video/%'),false)
  into has_image,has_video
  from public.attachments attachment
  where attachment.message_id=source.id
    and attachment.status='attached'
    and attachment.scan_status in ('clean','skipped_development');

  resolved_kind := case
    when has_text and has_image and has_video then 'text_image_video'
    when has_image and has_video then 'image_video'
    when has_text and has_video then 'text_video'
    when has_text and has_image then 'text_image'
    when has_video then 'video_only'
    when has_image then 'image_only'
    when has_text then 'text_only'
    else null
  end;
  resolved_base := case resolved_kind
    when 'text_only' then 1 when 'image_only' then 2 when 'text_image' then 3
    when 'video_only' then 4 when 'text_video' then 5 when 'image_video' then 5
    when 'text_image_video' then 6 else 0 end;

  if source.deleted_at is not null or source.webhook_id is not null or is_moderated or resolved_kind is null then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,source.deleted_at,now()),updated_at=now()
    where source_type in ('text_message','radio_comment') and source_id=source.id;
    return null;
  end if;

  update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,now()),updated_at=now()
  where source_id=source.id and source_type in ('text_message','radio_comment') and source_type<>canonical_type;

  insert into public.feed_items(
    source_type,source_id,parent_source_id,community_id,channel_id,author_id,content_kind,base_score,
    moderation_state,deleted_at,source_created_at,source_updated_at,score_version
  ) values (
    canonical_type,source.id,radio_parent_id,source.community_id,source.channel_id,source.author_id,resolved_kind,resolved_base,
    'visible',null,source.created_at,coalesce(source.edited_at,source.created_at),1
  )
  on conflict (source_type,source_id) do update set
    parent_source_id=excluded.parent_source_id,community_id=excluded.community_id,channel_id=excluded.channel_id,
    author_id=excluded.author_id,content_kind=excluded.content_kind,base_score=excluded.base_score,
    moderation_state='visible',deleted_at=null,source_updated_at=excluded.source_updated_at,score_version=1,updated_at=now()
  returning id into target_feed_item_id;

  perform public.rebuild_feed_engagement_rollup(target_feed_item_id);
  return target_feed_item_id;
end;
$$;

create or replace function public.sync_radio_session_feed_item(target_session_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.radio_sessions; target_feed_item_id uuid;
begin
  select * into source from public.radio_sessions where id=target_session_id;
  if not found then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,now()),updated_at=now()
    where source_type='radio_session' and source_id=target_session_id;
    return null;
  end if;
  if source.status in ('draft','cancelled') then
    update public.feed_items set moderation_state=case when source.status='draft' then 'hidden' else 'removed' end,
      deleted_at=case when source.status='cancelled' then coalesce(deleted_at,now()) else null end,source_updated_at=source.updated_at,updated_at=now()
    where source_type='radio_session' and source_id=source.id;
    return null;
  end if;
  insert into public.feed_items(source_type,source_id,community_id,channel_id,author_id,content_kind,base_score,moderation_state,deleted_at,source_created_at,source_updated_at,score_version)
  values('radio_session',source.id,source.community_id,source.channel_id,source.host_user_id,null,4,'visible',null,source.created_at,source.updated_at,1)
  on conflict(source_type,source_id) do update set community_id=excluded.community_id,channel_id=excluded.channel_id,author_id=excluded.author_id,
    base_score=4,moderation_state='visible',deleted_at=null,source_updated_at=excluded.source_updated_at,score_version=1,updated_at=now()
  returning id into target_feed_item_id;
  perform public.rebuild_feed_engagement_rollup(target_feed_item_id);
  return target_feed_item_id;
end;
$$;

create or replace function public.sync_podcast_episode_feed_item(target_episode_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.podcast_episodes; target_feed_item_id uuid;
begin
  select * into source from public.podcast_episodes where id=target_episode_id;
  if not found then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,now()),updated_at=now()
    where source_type='podcast_episode' and source_id=target_episode_id;
    return null;
  end if;
  if source.status <> 'published' then
    update public.feed_items set moderation_state=case when source.status='draft' then 'hidden' else 'removed' end,
      deleted_at=case when source.status='archived' then coalesce(deleted_at,now()) else null end,source_updated_at=source.updated_at,updated_at=now()
    where source_type='podcast_episode' and source_id=source.id;
    return null;
  end if;
  insert into public.feed_items(source_type,source_id,community_id,author_id,content_kind,base_score,moderation_state,deleted_at,source_created_at,source_updated_at,score_version)
  values('podcast_episode',source.id,source.community_id,source.author_user_id,null,4,'visible',null,coalesce(source.published_at,source.created_at),source.updated_at,1)
  on conflict(source_type,source_id) do update set community_id=excluded.community_id,author_id=excluded.author_id,base_score=4,
    moderation_state='visible',deleted_at=null,source_created_at=excluded.source_created_at,source_updated_at=excluded.source_updated_at,score_version=1,updated_at=now()
  returning id into target_feed_item_id;
  perform public.rebuild_feed_engagement_rollup(target_feed_item_id);
  return target_feed_item_id;
end;
$$;

create or replace function public.sync_podcast_comment_feed_item(target_comment_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.podcast_episode_comments; episode public.podcast_episodes; target_feed_item_id uuid;
begin
  select * into source from public.podcast_episode_comments where id=target_comment_id;
  if not found or source.deleted_at is not null or source.author_id is null then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,now()),updated_at=now()
    where source_type='podcast_comment' and source_id=target_comment_id;
    return null;
  end if;
  select * into episode from public.podcast_episodes where id=source.episode_id;
  if not found or episode.status<>'published' then
    update public.feed_items set moderation_state='hidden',updated_at=now()
    where source_type='podcast_comment' and source_id=target_comment_id;
    return null;
  end if;
  insert into public.feed_items(source_type,source_id,parent_source_id,community_id,author_id,content_kind,base_score,moderation_state,deleted_at,source_created_at,source_updated_at,score_version)
  values('podcast_comment',source.id,source.episode_id,episode.community_id,source.author_id,null,1,'visible',null,source.created_at,source.updated_at,1)
  on conflict(source_type,source_id) do update set parent_source_id=excluded.parent_source_id,community_id=excluded.community_id,author_id=excluded.author_id,
    base_score=1,moderation_state='visible',deleted_at=null,source_updated_at=excluded.source_updated_at,score_version=1,updated_at=now()
  returning id into target_feed_item_id;
  perform public.rebuild_feed_engagement_rollup(target_feed_item_id);
  return target_feed_item_id;
end;
$$;

create or replace function public.feed_message_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,now()),updated_at=now()
    where source_type in('text_message','radio_comment') and source_id=old.id;
    if old.reply_to_message_id is not null then
      perform public.refresh_feed_rollup_for_source('text_message',old.reply_to_message_id);
      perform public.refresh_feed_rollup_for_source('radio_comment',old.reply_to_message_id);
    end if;
  else
    perform public.sync_message_feed_item(new.id);
    if tg_op='UPDATE' and old.reply_to_message_id is distinct from new.reply_to_message_id and old.reply_to_message_id is not null then
      perform public.refresh_feed_rollup_for_source('text_message',old.reply_to_message_id);
      perform public.refresh_feed_rollup_for_source('radio_comment',old.reply_to_message_id);
    end if;
    if new.reply_to_message_id is not null then
      perform public.refresh_feed_rollup_for_source('text_message',new.reply_to_message_id);
      perform public.refresh_feed_rollup_for_source('radio_comment',new.reply_to_message_id);
    end if;
  end if;
  return null;
end;
$$;

create or replace function public.feed_attachment_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op<>'INSERT' and old.message_id is not null then perform public.sync_message_feed_item(old.message_id); end if;
  if tg_op<>'DELETE' and new.message_id is not null and (tg_op='INSERT' or old.message_id is distinct from new.message_id) then perform public.sync_message_feed_item(new.message_id); end if;
  return null;
end;
$$;

create or replace function public.feed_message_engagement_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_message_id uuid;
begin
  target_message_id := case when tg_op='DELETE' then old.message_id else new.message_id end;
  perform public.refresh_feed_rollup_for_source('text_message',target_message_id);
  perform public.refresh_feed_rollup_for_source('radio_comment',target_message_id);
  return null;
end;
$$;

create or replace function public.feed_radio_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,now()),updated_at=now() where source_type='radio_session' and source_id=old.id;
  else perform public.sync_radio_session_feed_item(new.id); end if;
  return null;
end;
$$;

create or replace function public.feed_radio_engagement_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.refresh_feed_rollup_for_source('radio_session',case when tg_op='DELETE' then old.radio_session_id else new.radio_session_id end);
  return null;
end;
$$;

create or replace function public.feed_podcast_episode_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,now()),updated_at=now() where source_type='podcast_episode' and source_id=old.id;
  else perform public.sync_podcast_episode_feed_item(new.id); end if;
  return null;
end;
$$;

create or replace function public.feed_podcast_comment_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target_episode_id uuid; target_parent_id uuid;
begin
  target_episode_id := case when tg_op='DELETE' then old.episode_id else new.episode_id end;
  target_parent_id := case when tg_op='DELETE' then old.reply_to_comment_id else new.reply_to_comment_id end;
  if tg_op='DELETE' then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,now()),updated_at=now() where source_type='podcast_comment' and source_id=old.id;
  else perform public.sync_podcast_comment_feed_item(new.id); end if;
  perform public.refresh_feed_rollup_for_source('podcast_episode',target_episode_id);
  if target_parent_id is not null then perform public.refresh_feed_rollup_for_source('podcast_comment',target_parent_id); end if;
  return null;
end;
$$;

create or replace function public.feed_podcast_reaction_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.refresh_feed_rollup_for_source('podcast_episode',case when tg_op='DELETE' then old.episode_id else new.episode_id end);
  return null;
end;
$$;

create or replace function public.feed_audio_save_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.refresh_feed_rollup_for_source(case when tg_op='DELETE' then old.item_type else new.item_type end,case when tg_op='DELETE' then old.item_id else new.item_id end);
  return null;
end;
$$;

create or replace function public.feed_impression_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='DELETE' then perform public.rebuild_feed_engagement_rollup(old.feed_item_id);
  else perform public.rebuild_feed_engagement_rollup(new.feed_item_id);
  end if;
  return null;
end;
$$;

create or replace function public.feed_moderation_action_changed()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.action_type='message_delete' and new.target_id is not null then
    update public.feed_items set moderation_state='removed',deleted_at=coalesce(deleted_at,new.created_at),updated_at=now()
    where source_id=new.target_id;
  end if;
  return null;
end;
$$;

drop trigger if exists feed_messages_sync on public.messages;
create trigger feed_messages_sync after insert or update or delete on public.messages for each row execute function public.feed_message_changed();
drop trigger if exists feed_attachments_sync on public.attachments;
create trigger feed_attachments_sync after insert or update or delete on public.attachments for each row execute function public.feed_attachment_changed();
drop trigger if exists feed_message_reactions_rollup on public.message_reactions;
create trigger feed_message_reactions_rollup after insert or update or delete on public.message_reactions for each row execute function public.feed_message_engagement_changed();
drop trigger if exists feed_saved_messages_rollup on public.saved_messages;
create trigger feed_saved_messages_rollup after insert or update or delete on public.saved_messages for each row execute function public.feed_message_engagement_changed();
drop trigger if exists feed_radio_sessions_sync on public.radio_sessions;
create trigger feed_radio_sessions_sync after insert or update or delete on public.radio_sessions for each row execute function public.feed_radio_changed();
drop trigger if exists feed_radio_reactions_rollup on public.radio_session_reactions;
create trigger feed_radio_reactions_rollup after insert or update or delete on public.radio_session_reactions for each row execute function public.feed_radio_engagement_changed();
drop trigger if exists feed_podcast_episodes_sync on public.podcast_episodes;
create trigger feed_podcast_episodes_sync after insert or update or delete on public.podcast_episodes for each row execute function public.feed_podcast_episode_changed();
drop trigger if exists feed_podcast_comments_sync on public.podcast_episode_comments;
create trigger feed_podcast_comments_sync after insert or update or delete on public.podcast_episode_comments for each row execute function public.feed_podcast_comment_changed();
drop trigger if exists feed_podcast_reactions_rollup on public.podcast_episode_reactions;
create trigger feed_podcast_reactions_rollup after insert or update or delete on public.podcast_episode_reactions for each row execute function public.feed_podcast_reaction_changed();
drop trigger if exists feed_audio_saves_rollup on public.saved_audio_items;
create trigger feed_audio_saves_rollup after insert or update or delete on public.saved_audio_items for each row execute function public.feed_audio_save_changed();
drop trigger if exists feed_impressions_rollup on public.feed_impressions;
create trigger feed_impressions_rollup after insert or update of opened_at or delete on public.feed_impressions for each row execute function public.feed_impression_changed();
drop trigger if exists feed_moderation_records_sync on public.moderation_action_records;
create trigger feed_moderation_records_sync after insert on public.moderation_action_records for each row execute function public.feed_moderation_action_changed();

create or replace function public.reconcile_feed_sources_v1(target_scope text, after_source_id uuid default null, result_limit integer default 500)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare source_id uuid; processed integer:=0; last_id uuid;
begin
  if target_scope not in ('text_message','radio_session','podcast_episode','podcast_comment') then raise exception 'FEED_RECONCILE_SCOPE_INVALID'; end if;
  result_limit:=greatest(1,least(coalesce(result_limit,500),2000));
  for source_id in
    select candidate.id from (
      select message.id from public.messages message where target_scope='text_message' and (after_source_id is null or message.id>after_source_id)
      union all select session.id from public.radio_sessions session where target_scope='radio_session' and (after_source_id is null or session.id>after_source_id)
      union all select episode.id from public.podcast_episodes episode where target_scope='podcast_episode' and (after_source_id is null or episode.id>after_source_id)
      union all select comment.id from public.podcast_episode_comments comment where target_scope='podcast_comment' and (after_source_id is null or comment.id>after_source_id)
    ) candidate order by candidate.id limit result_limit
  loop
    if target_scope='text_message' then perform public.sync_message_feed_item(source_id);
    elsif target_scope='radio_session' then perform public.sync_radio_session_feed_item(source_id);
    elsif target_scope='podcast_episode' then perform public.sync_podcast_episode_feed_item(source_id);
    else perform public.sync_podcast_comment_feed_item(source_id); end if;
    processed:=processed+1;last_id:=source_id;
  end loop;
  return jsonb_build_object('scope',target_scope,'processed',processed,'next_cursor',last_id,'batch_limit',result_limit);
end;
$$;

create or replace function public.reconcile_feed_rollups_v1(after_feed_item_id uuid default null, result_limit integer default 500)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare target_id uuid;processed integer:=0;last_id uuid;
begin
  result_limit:=greatest(1,least(coalesce(result_limit,500),2000));
  for target_id in select item.id from public.feed_items item where after_feed_item_id is null or item.id>after_feed_item_id order by item.id limit result_limit
  loop perform public.rebuild_feed_engagement_rollup(target_id);processed:=processed+1;last_id:=target_id;end loop;
  return jsonb_build_object('processed',processed,'next_cursor',last_id,'batch_limit',result_limit);
end;
$$;

revoke all on function public.feed_actor_is_eligible(uuid,uuid,uuid),public.rebuild_feed_engagement_rollup(uuid),
  public.refresh_feed_rollup_for_source(text,uuid),public.sync_message_feed_item(uuid),public.sync_radio_session_feed_item(uuid),
  public.sync_podcast_episode_feed_item(uuid),public.sync_podcast_comment_feed_item(uuid),public.reconcile_feed_sources_v1(text,uuid,integer),
  public.reconcile_feed_rollups_v1(uuid,integer) from public,anon,authenticated;

comment on function public.reconcile_feed_sources_v1(text,uuid,integer) is 'Operator-only bounded source backfill. Invoke repeatedly with the returned next_cursor.';
comment on function public.reconcile_feed_rollups_v1(uuid,integer) is 'Operator-only bounded rollup repair. Never grant to renderer roles.';

