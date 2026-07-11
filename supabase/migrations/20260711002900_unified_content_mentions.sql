begin;

create table if not exists public.content_mentions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('text_message', 'radio_session', 'radio_chat', 'podcast_episode', 'podcast_comment')),
  source_id uuid not null,
  parent_source_id uuid,
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles(id) on delete cascade,
  preview text not null check (char_length(preview) <= 500),
  source_created_at timestamptz not null,
  source_updated_at timestamptz not null,
  visibility_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_type, source_id, mentioned_user_id),
  check (author_id <> mentioned_user_id),
  check ((source_type = 'podcast_comment' and parent_source_id is not null) or (source_type <> 'podcast_comment' and parent_source_id is null))
);

create index if not exists content_mentions_recipient_feed_idx on public.content_mentions(mentioned_user_id, source_created_at desc, id desc);
create index if not exists content_mentions_community_feed_idx on public.content_mentions(community_id, source_created_at desc);
create index if not exists content_mentions_source_idx on public.content_mentions(source_type, source_id);
create index if not exists content_mentions_author_idx on public.content_mentions(author_id);

create or replace function public.content_mention_visibility_context(target_community_id uuid, target_channel_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'communityVisibility', coalesce(community.visibility, 'private'),
    'channelPrivate', case when target_channel_id is null then null else coalesce(channel.is_private, true) end,
    'publicReadEnabled', coalesce(community.public_read_enabled, false) and coalesce(channel.public_read_enabled, true)
  )
  from public.communities community
  left join public.channels channel on channel.id = target_channel_id and channel.community_id = community.id
  where community.id = target_community_id
$$;

create or replace function public.extract_content_mention_user_ids(target_community_id uuid, source_author_id uuid, source_text text)
returns table(user_id uuid) language sql stable security definer set search_path = public, pg_temp as $$
  with tokens as (
    select lower(match[2]) as username
    from regexp_matches(coalesce(source_text, ''), '(^|[^a-zA-Z0-9_.-])@([a-zA-Z0-9_.-]{1,32})', 'g') match
  )
  select profile.id
  from tokens
  join public.profiles profile on lower(profile.username) = tokens.username
  join public.community_members member on member.community_id = target_community_id and member.user_id = profile.id
  where profile.id <> source_author_id
  group by profile.id
  order by profile.id
  limit 20
$$;

revoke all on function public.content_mention_visibility_context(uuid, uuid) from public, anon, authenticated;
revoke all on function public.extract_content_mention_user_ids(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.assert_content_mention_source_compatibility()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  source_matches boolean := false;
  radio_chat_channel boolean := false;
begin
  if new.source_type in ('text_message', 'radio_chat') then
    select exists (
      select 1 from public.messages message
      where message.id = new.source_id and message.community_id = new.community_id
        and message.channel_id = new.channel_id and message.author_id = new.author_id and message.deleted_at is null
    ) into source_matches;
    select exists (
      select 1 from public.messages message
      where message.id = new.source_id and (
        exists (select 1 from public.radio_sessions session where session.community_id = message.community_id and session.listener_chat_channel_id = message.channel_id)
        or exists (select 1 from public.radio_community_settings settings where settings.community_id = message.community_id and settings.listener_chat_channel_id = message.channel_id)
      )
    ) into radio_chat_channel;
    source_matches := source_matches and ((new.source_type = 'radio_chat' and radio_chat_channel) or (new.source_type = 'text_message' and not radio_chat_channel));
  elsif new.source_type = 'radio_session' then
    select exists (
      select 1 from public.radio_sessions session
      where session.id = new.source_id and session.community_id = new.community_id and session.host_user_id = new.author_id
        and new.channel_id is not distinct from session.channel_id and session.status <> 'cancelled'
    ) into source_matches;
  elsif new.source_type = 'podcast_episode' then
    select exists (
      select 1 from public.podcast_episodes episode
      where episode.id = new.source_id and episode.community_id = new.community_id and episode.author_user_id = new.author_id
        and new.channel_id is null and episode.status = 'published'
    ) into source_matches;
  elsif new.source_type = 'podcast_comment' then
    select exists (
      select 1 from public.podcast_episode_comments comment
      join public.podcast_episodes episode on episode.id = comment.episode_id
      where comment.id = new.source_id and episode.id = new.parent_source_id and episode.community_id = new.community_id
        and comment.author_id = new.author_id and new.channel_id is null and comment.deleted_at is null and episode.status = 'published'
    ) into source_matches;
  end if;
  if not source_matches then raise exception 'CONTENT_MENTION_SOURCE_MISMATCH' using errcode = '23514'; end if;
  return new;
end
$$;

create trigger content_mentions_source_compatibility
before insert or update on public.content_mentions
for each row execute function public.assert_content_mention_source_compatibility();

create or replace function public.refresh_message_content_mentions(target_message_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  source public.messages%rowtype;
  canonical_type text;
begin
  delete from public.content_mentions where source_type in ('text_message', 'radio_chat') and source_id = target_message_id;
  select * into source from public.messages where id = target_message_id;
  if not found or source.deleted_at is not null or source.webhook_id is not null then return; end if;
  canonical_type := case when
    exists (select 1 from public.radio_sessions session where session.community_id = source.community_id and session.listener_chat_channel_id = source.channel_id)
    or exists (select 1 from public.radio_community_settings settings where settings.community_id = source.community_id and settings.listener_chat_channel_id = source.channel_id)
    then 'radio_chat' else 'text_message' end;
  insert into public.content_mentions(source_type, source_id, community_id, channel_id, author_id, mentioned_user_id, preview, source_created_at, source_updated_at, visibility_context)
  select canonical_type, source.id, source.community_id, source.channel_id, source.author_id, mention.mentioned_user_id,
    left(source.body, 500), source.created_at, coalesce(source.edited_at, source.created_at),
    public.content_mention_visibility_context(source.community_id, source.channel_id)
  from public.message_mentions mention where mention.message_id = source.id
  on conflict (source_type, source_id, mentioned_user_id) do update set
    preview = excluded.preview, source_updated_at = excluded.source_updated_at, visibility_context = excluded.visibility_context;
end
$$;

create or replace function public.sync_message_content_mentions()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.refresh_message_content_mentions(coalesce(new.message_id, old.message_id));
  return coalesce(new, old);
end
$$;

create trigger message_mentions_sync_unified
after insert or update or delete on public.message_mentions
for each row execute function public.sync_message_content_mentions();

create or replace function public.sync_message_source_content_mentions()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.refresh_message_content_mentions(new.id);
  return new;
end
$$;

create trigger zz_messages_sync_unified_mentions
after insert or update of body, deleted_at, community_id, channel_id, author_id on public.messages
for each row execute function public.sync_message_source_content_mentions();

create or replace function public.refresh_radio_content_mentions(target_session_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.radio_sessions%rowtype;
begin
  delete from public.content_mentions where source_type = 'radio_session' and source_id = target_session_id;
  select * into source from public.radio_sessions where id = target_session_id;
  if not found or source.status = 'cancelled' then return; end if;
  insert into public.content_mentions(source_type, source_id, community_id, channel_id, author_id, mentioned_user_id, preview, source_created_at, source_updated_at, visibility_context)
  select 'radio_session', source.id, source.community_id, source.channel_id, source.host_user_id, mentioned.user_id,
    left(concat_ws(E'\n', source.title, source.description), 500), source.created_at, source.updated_at,
    public.content_mention_visibility_context(source.community_id, source.channel_id)
  from public.extract_content_mention_user_ids(source.community_id, source.host_user_id, concat_ws(E'\n', source.title, source.description)) mentioned;
end
$$;

create or replace function public.sync_radio_content_mentions()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then delete from public.content_mentions where source_type = 'radio_session' and source_id = old.id; return old; end if;
  perform public.refresh_radio_content_mentions(new.id); return new;
end
$$;

create trigger radio_sessions_sync_unified_mentions
after insert or update of title, description, status, host_user_id, community_id, channel_id or delete on public.radio_sessions
for each row execute function public.sync_radio_content_mentions();

create or replace function public.refresh_podcast_comment_content_mentions(target_comment_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.podcast_episode_comments%rowtype; episode public.podcast_episodes%rowtype;
begin
  delete from public.content_mentions where source_type = 'podcast_comment' and source_id = target_comment_id;
  select * into source from public.podcast_episode_comments where id = target_comment_id;
  if not found or source.deleted_at is not null or source.author_id is null then return; end if;
  select * into episode from public.podcast_episodes where id = source.episode_id;
  if not found or episode.status <> 'published' then return; end if;
  insert into public.content_mentions(source_type, source_id, parent_source_id, community_id, author_id, mentioned_user_id, preview, source_created_at, source_updated_at, visibility_context)
  select 'podcast_comment', source.id, episode.id, episode.community_id, source.author_id, mentioned.user_id,
    left(source.body, 500), source.created_at, source.updated_at,
    public.content_mention_visibility_context(episode.community_id, null)
  from public.extract_content_mention_user_ids(episode.community_id, source.author_id, source.body) mentioned;
end
$$;

create or replace function public.sync_podcast_comment_content_mentions()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then delete from public.content_mentions where source_type = 'podcast_comment' and source_id = old.id; return old; end if;
  perform public.refresh_podcast_comment_content_mentions(new.id); return new;
end
$$;

create trigger podcast_comments_sync_unified_mentions
after insert or update of body, deleted_at, author_id, episode_id or delete on public.podcast_episode_comments
for each row execute function public.sync_podcast_comment_content_mentions();

create or replace function public.refresh_podcast_episode_content_mentions(target_episode_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare source public.podcast_episodes%rowtype; comment record;
begin
  delete from public.content_mentions where source_type = 'podcast_episode' and source_id = target_episode_id;
  select * into source from public.podcast_episodes where id = target_episode_id;
  if not found or source.status <> 'published' then
    delete from public.content_mentions where source_type = 'podcast_comment' and parent_source_id = target_episode_id;
    return;
  end if;
  insert into public.content_mentions(source_type, source_id, community_id, author_id, mentioned_user_id, preview, source_created_at, source_updated_at, visibility_context)
  select 'podcast_episode', source.id, source.community_id, source.author_user_id, mentioned.user_id,
    left(concat_ws(E'\n', source.title, source.description), 500), coalesce(source.published_at, source.created_at), source.updated_at,
    public.content_mention_visibility_context(source.community_id, null)
  from public.extract_content_mention_user_ids(source.community_id, source.author_user_id, concat_ws(E'\n', source.title, source.description)) mentioned;
  for comment in select id from public.podcast_episode_comments where episode_id = source.id loop
    perform public.refresh_podcast_comment_content_mentions(comment.id);
  end loop;
end
$$;

create or replace function public.sync_podcast_episode_content_mentions()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' then delete from public.content_mentions where source_type in ('podcast_episode', 'podcast_comment') and (source_id = old.id or parent_source_id = old.id); return old; end if;
  perform public.refresh_podcast_episode_content_mentions(new.id); return new;
end
$$;

create trigger podcast_episodes_sync_unified_mentions
after insert or update of title, description, status, author_user_id, community_id, published_at or delete on public.podcast_episodes
for each row execute function public.sync_podcast_episode_content_mentions();

create or replace function public.can_view_content_mention(target public.content_mentions)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null
    and not public.users_are_blocked(auth.uid(), target.author_id)
    and case target.source_type
      when 'text_message' then public.can_view_message(target.source_id)
      when 'radio_chat' then public.can_view_message(target.source_id)
      when 'radio_session' then public.can_view_radio_session(target.source_id)
      when 'podcast_episode' then public.can_view_podcast_episode(target.source_id)
      when 'podcast_comment' then exists (
        select 1 from public.podcast_episode_comments comment
        where comment.id = target.source_id and comment.deleted_at is null and public.can_view_podcast_episode(comment.episode_id)
      )
      else false
    end
$$;

revoke all on function public.assert_content_mention_source_compatibility() from public, anon, authenticated;
revoke all on function public.refresh_message_content_mentions(uuid) from public, anon, authenticated;
revoke all on function public.sync_message_content_mentions() from public, anon, authenticated;
revoke all on function public.sync_message_source_content_mentions() from public, anon, authenticated;
revoke all on function public.refresh_radio_content_mentions(uuid) from public, anon, authenticated;
revoke all on function public.sync_radio_content_mentions() from public, anon, authenticated;
revoke all on function public.refresh_podcast_comment_content_mentions(uuid) from public, anon, authenticated;
revoke all on function public.sync_podcast_comment_content_mentions() from public, anon, authenticated;
revoke all on function public.refresh_podcast_episode_content_mentions(uuid) from public, anon, authenticated;
revoke all on function public.sync_podcast_episode_content_mentions() from public, anon, authenticated;
revoke all on function public.can_view_content_mention(public.content_mentions) from public, anon;
grant execute on function public.can_view_content_mention(public.content_mentions) to authenticated;

alter table public.content_mentions enable row level security;
alter table public.content_mentions force row level security;
revoke all on table public.content_mentions from public, anon, authenticated;
grant select on table public.content_mentions to authenticated;
create policy content_mentions_select_visible on public.content_mentions for select to authenticated using (public.can_view_content_mention(content_mentions));

create or replace function public.list_unified_content_mentions(
  cursor_created_at timestamptz default null,
  cursor_mention_id uuid default null,
  source_types text[] default null,
  community_filter uuid default null,
  result_limit integer default 30
)
returns table (
  id uuid, source_type text, source_id uuid, parent_source_id uuid, community_id uuid, channel_id uuid,
  author_id uuid, mentioned_user_id uuid, preview text, source_created_at timestamptz,
  source_updated_at timestamptz, visibility_context jsonb
)
language sql stable security invoker set search_path = public, pg_temp as $$
  select mention.id, mention.source_type, mention.source_id, mention.parent_source_id, mention.community_id, mention.channel_id,
    mention.author_id, mention.mentioned_user_id, mention.preview, mention.source_created_at,
    mention.source_updated_at, mention.visibility_context
  from public.content_mentions mention
  where (source_types is null or mention.source_type = any(source_types))
    and (community_filter is null or mention.community_id = community_filter)
    and (cursor_created_at is null or (mention.source_created_at, mention.id) < (cursor_created_at, cursor_mention_id))
  order by mention.source_created_at desc, mention.id desc
  limit greatest(1, least(coalesce(result_limit, 30), 50))
$$;

revoke all on function public.list_unified_content_mentions(timestamptz, uuid, text[], uuid, integer) from public, anon;
grant execute on function public.list_unified_content_mentions(timestamptz, uuid, text[], uuid, integer) to authenticated;

select public.refresh_message_content_mentions(message.id) from public.messages message where message.deleted_at is null;
select public.refresh_radio_content_mentions(session.id) from public.radio_sessions session where session.status <> 'cancelled';
select public.refresh_podcast_episode_content_mentions(episode.id) from public.podcast_episodes episode where episode.status = 'published';

commit;
