-- Task 456: Podcast social interactions and listener-state hardening.
begin;

create or replace function public.can_use_podcast_listener_state(target_episode_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists (
    select 1 from public.podcast_episodes episode
    where episode.id=target_episode_id
      and episode.status='published'
      and public.can_view_podcast_episode(episode.id)
      and not public.users_are_blocked(auth.uid(),episode.author_user_id)
  );
$$;

create or replace function public.can_interact_with_podcast_episode(target_episode_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.can_use_podcast_listener_state(target_episode_id) and exists (
    select 1 from public.podcast_episodes episode
    where episode.id=target_episode_id
      and public.is_community_member(episode.community_id)
  );
$$;

create or replace function public.validate_podcast_comment_write()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_community_id uuid; settings public.community_moderation_settings%rowtype; mention_count integer;
begin
  if tg_op='UPDATE' then
    if new.episode_id<>old.episode_id or new.author_id is distinct from old.author_id or new.reply_to_comment_id is distinct from old.reply_to_comment_id then
      raise exception 'podcast comment identity is immutable' using errcode='42501';
    end if;
    if old.deleted_at is not null then raise exception 'deleted podcast comment is immutable' using errcode='42501'; end if;
    if new.deleted_at is not null then new.body:=old.body; return new; end if;
  end if;
  if not public.can_interact_with_podcast_episode(new.episode_id) then raise exception 'podcast interaction denied' using errcode='42501'; end if;
  select episode.community_id into target_community_id from public.podcast_episodes episode where episode.id=new.episode_id;
  select * into settings from public.community_moderation_settings item where item.community_id=target_community_id;
  if not found then return new; end if;
  if exists(select 1 from unnest(settings.blocked_words) word where word<>'' and position(lower(word) in lower(new.body))>0) then raise exception 'podcast comment blocked by community word filter'; end if;
  select count(*) into mention_count from regexp_matches(new.body,'@[A-Za-z0-9_]+','g');
  if mention_count>settings.max_mentions_per_message then raise exception 'podcast comment exceeds community mention limit'; end if;
  if settings.block_links and new.body~*'(https?://|www\.)' then raise exception 'links are blocked in this community'; end if;
  if tg_op='INSERT' and settings.slow_mode_seconds>0 and exists(select 1 from public.podcast_episode_comments comment where comment.episode_id=new.episode_id and comment.author_id=auth.uid() and comment.deleted_at is null and comment.created_at>now()-make_interval(secs=>settings.slow_mode_seconds)) then raise exception 'community slow mode is active'; end if;
  return new;
end;
$$;

drop trigger if exists podcast_comment_interaction_guard on public.podcast_episode_comments;
create trigger podcast_comment_interaction_guard before insert or update on public.podcast_episode_comments for each row execute function public.validate_podcast_comment_write();

drop policy if exists "podcast reactions follow episode visibility" on public.podcast_episode_reactions;
drop policy if exists "community members add own podcast reactions" on public.podcast_episode_reactions;
drop policy if exists "users delete own podcast reactions" on public.podcast_episode_reactions;
create policy "podcast reactions follow unblocked episode visibility" on public.podcast_episode_reactions for select to authenticated using (public.can_view_podcast_episode(episode_id) and (user_id=auth.uid() or not public.users_are_blocked(auth.uid(),user_id)));
create policy "members add own reactions to interactive podcast" on public.podcast_episode_reactions for insert to authenticated with check (user_id=auth.uid() and public.can_interact_with_podcast_episode(episode_id));
create policy "users remove own podcast reactions" on public.podcast_episode_reactions for delete to authenticated using (user_id=auth.uid());

drop policy if exists "podcast comments follow episode visibility" on public.podcast_episode_comments;
drop policy if exists "community members add own podcast comments" on public.podcast_episode_comments;
drop policy if exists "comment authors update their comments" on public.podcast_episode_comments;
create policy "podcast comments follow unblocked episode visibility" on public.podcast_episode_comments for select to authenticated using (public.can_view_podcast_episode(episode_id) and (author_id is null or author_id=auth.uid() or not public.users_are_blocked(auth.uid(),author_id)));
create policy "members add own comments to interactive podcast" on public.podcast_episode_comments for insert to authenticated with check (author_id=auth.uid() and public.can_interact_with_podcast_episode(episode_id));
create policy "comment authors edit or soft delete own comments" on public.podcast_episode_comments for update to authenticated using (author_id=auth.uid()) with check (author_id=auth.uid());

drop policy if exists "users save visible audio for themselves" on public.saved_audio_items;
create policy "users save authorized audio for themselves" on public.saved_audio_items for insert to authenticated with check (
  user_id=auth.uid() and (
    (item_type='radio_session' and public.can_view_radio_session(item_id))
    or (item_type='podcast_episode' and public.can_use_podcast_listener_state(item_id))
  )
);

drop policy if exists "users read own visible podcast progress" on public.podcast_playback_progress;
drop policy if exists "users create own visible podcast progress" on public.podcast_playback_progress;
drop policy if exists "users update own visible podcast progress" on public.podcast_playback_progress;
create policy "users read own authorized podcast progress" on public.podcast_playback_progress for select to authenticated using (user_id=auth.uid() and public.can_use_podcast_listener_state(episode_id));
create policy "users create own authorized podcast progress" on public.podcast_playback_progress for insert to authenticated with check (user_id=auth.uid() and public.can_use_podcast_listener_state(episode_id));
create policy "users update own authorized podcast progress" on public.podcast_playback_progress for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and public.can_use_podcast_listener_state(episode_id));

alter table public.podcast_episodes replica identity full;
alter table public.podcast_episode_reactions replica identity full;
alter table public.podcast_episode_comments replica identity full;
alter table public.saved_audio_items replica identity full;
alter table public.podcast_playback_progress replica identity full;

do $$
declare table_name text;
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach table_name in array array['podcast_episodes','podcast_episode_reactions','podcast_episode_comments','saved_audio_items','podcast_playback_progress'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then execute format('alter publication supabase_realtime add table public.%I',table_name); end if;
    end loop;
  end if;
end;
$$;

revoke all on function public.can_use_podcast_listener_state(uuid),public.can_interact_with_podcast_episode(uuid) from public,anon;
grant execute on function public.can_use_podcast_listener_state(uuid),public.can_interact_with_podcast_episode(uuid) to authenticated;
comment on function public.can_interact_with_podcast_episode(uuid) is 'Canonical Podcast reaction/comment permission: published, visible, unblocked, and joined member.';
comment on function public.can_use_podcast_listener_state(uuid) is 'Canonical save/progress permission: published, visible, and unblocked; visitors may retain private listener state without gaining participation rights.';

commit;
