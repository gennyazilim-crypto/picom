alter table public.podcast_series
  add column if not exists cover_storage_path text,
  add column if not exists tags text[] not null default '{}';

alter table public.podcast_episodes
  add column if not exists host_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists cover_storage_path text,
  add column if not exists audio_storage_path text,
  add column if not exists audio_mime_type text,
  add column if not exists audio_size_bytes bigint,
  add column if not exists is_explicit boolean not null default false,
  add column if not exists tags text[] not null default '{}';

alter table public.podcast_episode_comments
  add column if not exists reply_to_comment_id uuid references public.podcast_episode_comments(id) on delete set null;

create table if not exists public.podcast_playback_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  completed_at timestamptz,
  last_played_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, episode_id),
  check (duration_seconds = 0 or position_seconds <= duration_seconds)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='podcast_episode_audio_mime_check' and conrelid='public.podcast_episodes'::regclass) then
    alter table public.podcast_episodes add constraint podcast_episode_audio_mime_check
      check (audio_mime_type is null or audio_mime_type in ('audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/webm'));
  end if;
  if not exists (select 1 from pg_constraint where conname='podcast_episode_audio_size_check' and conrelid='public.podcast_episodes'::regclass) then
    alter table public.podcast_episodes add constraint podcast_episode_audio_size_check
      check (audio_size_bytes is null or audio_size_bytes between 1 and 104857600);
  end if;
  if not exists (select 1 from pg_constraint where conname='podcast_episode_tags_count_check' and conrelid='public.podcast_episodes'::regclass) then
    alter table public.podcast_episodes add constraint podcast_episode_tags_count_check check (cardinality(tags) <= 20);
  end if;
  if not exists (select 1 from pg_constraint where conname='podcast_series_tags_count_check' and conrelid='public.podcast_series'::regclass) then
    alter table public.podcast_series add constraint podcast_series_tags_count_check check (cardinality(tags) <= 20);
  end if;
end
$$;

create index if not exists podcast_progress_user_recent_idx on public.podcast_playback_progress(user_id,last_played_at desc);
create index if not exists podcast_progress_episode_idx on public.podcast_playback_progress(episode_id);
create index if not exists podcast_comments_reply_idx on public.podcast_episode_comments(reply_to_comment_id) where reply_to_comment_id is not null;

drop trigger if exists podcast_progress_set_updated_at on public.podcast_playback_progress;
create trigger podcast_progress_set_updated_at before update on public.podcast_playback_progress for each row execute function public.set_audio_updated_at();

create or replace function public.enforce_podcast_community_kind()
returns trigger language plpgsql security definer set search_path=public as $$
declare target_kind public.community_kind; series_community_id uuid;
begin
  select community.kind into target_kind from public.communities community where community.id=new.community_id;
  if target_kind is distinct from 'podcast'::public.community_kind then
    raise exception 'PODCAST_COMMUNITY_KIND_REQUIRED' using errcode='23514';
  end if;
  if tg_table_name='podcast_episodes' and new.series_id is not null then
    select series.community_id into series_community_id from public.podcast_series series where series.id=new.series_id;
    if series_community_id is distinct from new.community_id then raise exception 'PODCAST_SERIES_COMMUNITY_MISMATCH' using errcode='23514'; end if;
  end if;
  return new;
end
$$;

drop trigger if exists podcast_settings_kind_guard on public.podcast_community_settings;
create trigger podcast_settings_kind_guard before insert or update of community_id on public.podcast_community_settings for each row execute function public.enforce_podcast_community_kind();
drop trigger if exists podcast_series_kind_guard on public.podcast_series;
create trigger podcast_series_kind_guard before insert or update of community_id on public.podcast_series for each row execute function public.enforce_podcast_community_kind();
drop trigger if exists podcast_episode_kind_guard on public.podcast_episodes;
create trigger podcast_episode_kind_guard before insert or update of community_id,series_id on public.podcast_episodes for each row execute function public.enforce_podcast_community_kind();

do $$
begin
  if exists (
    select 1 from public.podcast_episodes episode join public.communities community on community.id=episode.community_id
    where community.kind is distinct from 'podcast'::public.community_kind
  ) or exists (
    select 1 from public.podcast_series series join public.communities community on community.id=series.community_id
    where community.kind is distinct from 'podcast'::public.community_kind
  ) then raise exception 'PODCAST_LEGACY_KIND_MISMATCH' using errcode='23514'; end if;
end
$$;

create or replace function public.validate_podcast_episode_write()
returns trigger language plpgsql security definer set search_path=public as $$
declare publishing boolean;
begin
  if tg_op='INSERT' then publishing:=new.status='published'; else publishing:=new.status='published' and old.status is distinct from 'published'; end if;
  if new.audio_storage_path is not null then
    if new.audio_storage_path !~ ('^communities/'||new.community_id::text||'/podcasts/'||new.id::text||'/audio/[0-9a-f-]{36}\.(mp3|m4a|ogg|wav|webm)$') then raise exception 'PODCAST_AUDIO_PATH_INVALID' using errcode='23514'; end if;
    if new.audio_mime_type is null or new.audio_size_bytes is null then raise exception 'PODCAST_AUDIO_METADATA_REQUIRED' using errcode='23514'; end if;
  end if;
  if new.cover_storage_path is not null and new.cover_storage_path !~ ('^communities/'||new.community_id::text||'/podcasts/'||new.id::text||'/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$') then
    raise exception 'PODCAST_COVER_PATH_INVALID' using errcode='23514';
  end if;
  if publishing and (new.published_at is null or new.duration_seconds <= 0 or new.audio_storage_path is null) then
    raise exception 'PODCAST_PUBLISHING_MEDIA_REQUIRED' using errcode='23514';
  end if;
  if publishing and not public.can_manage_community_audio(new.community_id,'publishPodcasts') then raise exception 'PODCAST_PUBLISH_PERMISSION_REQUIRED' using errcode='42501'; end if;
  if tg_op='UPDATE' then
    if (new.status is distinct from old.status or new.audio_storage_path is distinct from old.audio_storage_path or new.cover_storage_path is distinct from old.cover_storage_path or new.audio_mime_type is distinct from old.audio_mime_type or new.audio_size_bytes is distinct from old.audio_size_bytes or new.author_user_id is distinct from old.author_user_id or new.host_user_id is distinct from old.host_user_id)
      and not public.can_manage_community_audio(new.community_id,'publishPodcasts') then raise exception 'PODCAST_PUBLISH_PERMISSION_REQUIRED' using errcode='42501'; end if;
  end if;
  return new;
end
$$;

drop trigger if exists podcast_episode_write_guard on public.podcast_episodes;
create trigger podcast_episode_write_guard before insert or update on public.podcast_episodes for each row execute function public.validate_podcast_episode_write();

create or replace function public.validate_podcast_comment_reply()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.reply_to_comment_id is not null and not exists(select 1 from public.podcast_episode_comments parent where parent.id=new.reply_to_comment_id and parent.episode_id=new.episode_id and parent.deleted_at is null) then
    raise exception 'PODCAST_COMMENT_REPLY_INVALID' using errcode='23514';
  end if;
  return new;
end
$$;
drop trigger if exists podcast_comment_reply_guard on public.podcast_episode_comments;
create trigger podcast_comment_reply_guard before insert or update of episode_id,reply_to_comment_id on public.podcast_episode_comments for each row execute function public.validate_podcast_comment_reply();

alter table public.podcast_playback_progress enable row level security;
drop policy if exists "users read own visible podcast progress" on public.podcast_playback_progress;
create policy "users read own visible podcast progress" on public.podcast_playback_progress for select to authenticated using (user_id=auth.uid() and public.can_view_podcast_episode(episode_id));
drop policy if exists "users create own visible podcast progress" on public.podcast_playback_progress;
create policy "users create own visible podcast progress" on public.podcast_playback_progress for insert to authenticated with check (user_id=auth.uid() and public.can_view_podcast_episode(episode_id));
drop policy if exists "users update own visible podcast progress" on public.podcast_playback_progress;
create policy "users update own visible podcast progress" on public.podcast_playback_progress for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid() and public.can_view_podcast_episode(episode_id));
drop policy if exists "users delete own podcast progress" on public.podcast_playback_progress;
create policy "users delete own podcast progress" on public.podcast_playback_progress for delete to authenticated using (user_id=auth.uid());

drop policy if exists "podcast episodes created by permitted publishers" on public.podcast_episodes;
drop policy if exists "podcast episodes created by permitted publishers" on public.podcast_episodes;
create policy "podcast episodes created by permitted publishers" on public.podcast_episodes for insert to authenticated with check (author_user_id=auth.uid() and public.can_manage_community_audio(community_id,'publishPodcasts'));
drop policy if exists "podcast episodes managed by author publisher or editor" on public.podcast_episodes;
drop policy if exists "podcast episodes managed by publisher or editor" on public.podcast_episodes;
drop policy if exists "podcast episodes managed by publisher or editor" on public.podcast_episodes;
create policy "podcast episodes managed by publisher or editor" on public.podcast_episodes for update to authenticated
using (public.can_manage_community_audio(community_id,'publishPodcasts') or public.can_manage_community_audio(community_id,'editPodcastMetadata'))
with check (public.can_manage_community_audio(community_id,'publishPodcasts') or public.can_manage_community_audio(community_id,'editPodcastMetadata'));
drop policy if exists "podcast episodes deleted by host or community audio managers" on public.podcast_episodes;
drop policy if exists "podcast episodes deleted by author or community audio managers" on public.podcast_episodes;
drop policy if exists "podcast episodes deleted by publishers" on public.podcast_episodes;
create policy "podcast episodes deleted by publishers" on public.podcast_episodes for delete to authenticated using (public.can_manage_community_audio(community_id,'publishPodcasts'));

create or replace function public.can_manage_podcast_episode(target_episode_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.podcast_episodes episode
    where episode.id=target_episode_id
      and public.can_manage_community_audio(episode.community_id,'publishPodcasts')
  );
$$;

create or replace function public.can_view_podcast_audio_object(object_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[]:=storage.foldername(object_name); target_id uuid;
begin
  if object_name !~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/audio/[0-9a-f-]{36}\.(mp3|m4a|ogg|wav|webm)$' then return false; end if;
  target_id:=parts[4]::uuid;
  return exists(select 1 from public.podcast_episodes episode where episode.id=target_id and episode.community_id::text=parts[2] and public.can_view_podcast_episode(episode.id));
end
$$;

create or replace function public.can_manage_podcast_audio_object(object_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[]:=storage.foldername(object_name); target_id uuid;
begin
  if object_name !~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/audio/[0-9a-f-]{36}\.(mp3|m4a|ogg|wav|webm)$' then return false; end if;
  target_id:=parts[4]::uuid;
  return exists(select 1 from public.podcast_episodes episode where episode.id=target_id and episode.community_id::text=parts[2] and public.can_manage_podcast_episode(episode.id));
end
$$;

create or replace function public.can_view_podcast_cover_object(object_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[]:=storage.foldername(object_name); target_id uuid;
begin
  if object_name ~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' then
    target_id:=parts[4]::uuid; return exists(select 1 from public.podcast_episodes episode where episode.id=target_id and episode.community_id::text=parts[2] and public.can_view_podcast_episode(episode.id));
  elsif object_name ~ '^communities/[0-9a-f-]{36}/podcasts/series/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' then
    target_id:=parts[5]::uuid; return exists(select 1 from public.podcast_series series where series.id=target_id and series.community_id::text=parts[2] and public.can_view_community_audio(series.community_id,null));
  end if;
  return false;
end
$$;

create or replace function public.can_manage_podcast_cover_object(object_name text)
returns boolean language plpgsql stable security definer set search_path=public,storage as $$
declare parts text[]:=storage.foldername(object_name); target_id uuid;
begin
  if object_name ~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' then
    target_id:=parts[4]::uuid; return exists(select 1 from public.podcast_episodes episode where episode.id=target_id and episode.community_id::text=parts[2] and public.can_manage_podcast_episode(episode.id));
  elsif object_name ~ '^communities/[0-9a-f-]{36}/podcasts/series/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' then
    target_id:=parts[5]::uuid; return exists(select 1 from public.podcast_series series where series.id=target_id and series.community_id::text=parts[2] and public.can_manage_community_audio(series.community_id,'managePodcastSeries'));
  end if;
  return false;
end
$$;

grant execute on function public.can_view_podcast_audio_object(text),public.can_manage_podcast_audio_object(text),public.can_view_podcast_cover_object(text),public.can_manage_podcast_cover_object(text) to authenticated;

drop policy if exists "podcast audio read follows episode visibility" on storage.objects;
drop policy if exists "podcast audio read follows episode visibility" on storage.objects;
create policy "podcast audio read follows episode visibility" on storage.objects for select to authenticated using (bucket_id='podcast-audio' and public.can_view_podcast_audio_object(name));
drop policy if exists "podcast audio writers manage authorized episode objects" on storage.objects;
drop policy if exists "podcast audio writers manage authorized episode objects" on storage.objects;
create policy "podcast audio writers manage authorized episode objects" on storage.objects for insert to authenticated with check (bucket_id='podcast-audio' and public.can_manage_podcast_audio_object(name));
drop policy if exists "podcast audio writers update authorized episode objects" on storage.objects;
drop policy if exists "podcast audio writers update authorized episode objects" on storage.objects;
create policy "podcast audio writers update authorized episode objects" on storage.objects for update to authenticated using (bucket_id='podcast-audio' and public.can_manage_podcast_audio_object(name)) with check (bucket_id='podcast-audio' and public.can_manage_podcast_audio_object(name));
drop policy if exists "podcast audio writers delete authorized episode objects" on storage.objects;
drop policy if exists "podcast audio writers delete authorized episode objects" on storage.objects;
create policy "podcast audio writers delete authorized episode objects" on storage.objects for delete to authenticated using (bucket_id='podcast-audio' and public.can_manage_podcast_audio_object(name));

drop policy if exists "audio covers read follows radio or podcast visibility" on storage.objects;
drop policy if exists "audio covers read follows radio or podcast visibility" on storage.objects;
create policy "audio covers read follows radio or podcast visibility" on storage.objects for select to authenticated using (bucket_id='audio-covers' and (public.can_view_radio_cover_object(name) or public.can_view_podcast_cover_object(name)));
drop policy if exists "audio cover writers manage authorized audio objects" on storage.objects;
drop policy if exists "audio cover writers manage authorized audio objects" on storage.objects;
create policy "audio cover writers manage authorized audio objects" on storage.objects for insert to authenticated with check (bucket_id='audio-covers' and (public.can_manage_radio_cover_object(name) or public.can_manage_podcast_cover_object(name)));
drop policy if exists "audio cover writers update authorized audio objects" on storage.objects;
drop policy if exists "audio cover writers update authorized audio objects" on storage.objects;
create policy "audio cover writers update authorized audio objects" on storage.objects for update to authenticated using (bucket_id='audio-covers' and (public.can_manage_radio_cover_object(name) or public.can_manage_podcast_cover_object(name))) with check (bucket_id='audio-covers' and (public.can_manage_radio_cover_object(name) or public.can_manage_podcast_cover_object(name)));
drop policy if exists "audio cover writers delete authorized audio objects" on storage.objects;
drop policy if exists "audio cover writers delete authorized audio objects" on storage.objects;
create policy "audio cover writers delete authorized audio objects" on storage.objects for delete to authenticated using (bucket_id='audio-covers' and (public.can_manage_radio_cover_object(name) or public.can_manage_podcast_cover_object(name)));

revoke all on public.podcast_playback_progress from anon;
grant select,insert,update,delete on public.podcast_playback_progress to authenticated;
comment on table public.podcast_playback_progress is 'Private per-user Podcast resume state; episode visibility remains RLS-authoritative.';
comment on column public.podcast_episodes.audio_storage_path is 'Private podcast-audio object path; UI resolves a short-lived signed URL through the service layer.';
comment on column public.podcast_episodes.audio_url is 'Legacy compatibility field. New publishing uses audio_storage_path and private signed URLs.';;
