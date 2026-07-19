-- Picom radio and podcast storage foundation.
-- All media buckets remain private; access follows community/channel RLS.

create table if not exists public.radio_sessions (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  host_user_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'cancelled')),
  starts_at timestamptz not null,
  ended_at timestamptz,
  cover_url text,
  listener_count integer not null default 0 check (listener_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= starts_at)
);
create table if not exists public.radio_listeners (
  id uuid primary key default gen_random_uuid(),
  radio_session_id uuid not null references public.radio_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  muted boolean not null default false,
  check (left_at is null or left_at >= joined_at)
);
create table if not exists public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 12000),
  cover_url text,
  audio_url text,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create table if not exists public.podcast_episode_reactions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  unique (episode_id, user_id, emoji)
);
create table if not exists public.podcast_episode_comments (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.saved_audio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('radio_session', 'podcast_episode')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);
create index if not exists radio_sessions_community_status_starts_idx on public.radio_sessions (community_id, status, starts_at desc);
create index if not exists radio_sessions_channel_idx on public.radio_sessions (channel_id) where channel_id is not null;
create index if not exists radio_sessions_host_idx on public.radio_sessions (host_user_id, starts_at desc);
create index if not exists radio_listeners_session_idx on public.radio_listeners (radio_session_id, joined_at desc);
create index if not exists radio_listeners_user_idx on public.radio_listeners (user_id, joined_at desc);
create unique index if not exists radio_listeners_one_active_session_user_idx on public.radio_listeners (radio_session_id, user_id) where left_at is null;
create index if not exists podcast_episodes_community_status_published_idx on public.podcast_episodes (community_id, status, published_at desc);
create index if not exists podcast_episodes_author_idx on public.podcast_episodes (author_user_id, published_at desc);
create index if not exists podcast_reactions_episode_idx on public.podcast_episode_reactions (episode_id, created_at);
create index if not exists podcast_comments_episode_idx on public.podcast_episode_comments (episode_id, created_at desc) where deleted_at is null;
create index if not exists saved_audio_user_created_idx on public.saved_audio_items (user_id, created_at desc);
create or replace function public.set_audio_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists radio_sessions_set_updated_at on public.radio_sessions;
create trigger radio_sessions_set_updated_at before update on public.radio_sessions for each row execute function public.set_audio_updated_at();
drop trigger if exists podcast_episodes_set_updated_at on public.podcast_episodes;
create trigger podcast_episodes_set_updated_at before update on public.podcast_episodes for each row execute function public.set_audio_updated_at();
drop trigger if exists podcast_comments_set_updated_at on public.podcast_episode_comments;
create trigger podcast_comments_set_updated_at before update on public.podcast_episode_comments for each row execute function public.set_audio_updated_at();
create or replace function public.can_view_community_audio(target_community_id uuid, target_channel_id uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.communities community
    where community.id = target_community_id
      and (
        public.is_community_member(community.id)
        or (community.visibility = 'public' and community.public_read_enabled = true)
      )
      and (
        target_channel_id is null
        or exists (
          select 1 from public.channels channel
          where channel.id = target_channel_id
            and channel.community_id = community.id
            and (
              (public.is_community_member(community.id) and public.can_view_channel(channel.id))
              or (
                community.visibility = 'public'
                and community.public_read_enabled = true
                and channel.is_private = false
                and channel.public_read_enabled = true
              )
            )
        )
      )
  );
$$;
create or replace function public.can_manage_community_audio(target_community_id uuid, capability text default 'manageCommunity')
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_community_owner(target_community_id)
    or exists (
      select 1
      from public.community_members member
      join public.roles role on role.id = member.role_id and role.community_id = member.community_id
      where member.community_id = target_community_id
        and member.user_id = auth.uid()
        and (
          lower(role.name) in ('owner', 'admin', 'moderator')
          or role.permissions ->> 'manageCommunity' = 'true'
          or role.permissions ->> capability = 'true'
        )
    );
$$;
create or replace function public.can_view_radio_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.radio_sessions session
    where session.id = target_session_id
      and public.can_view_community_audio(session.community_id, session.channel_id)
  );
$$;
create or replace function public.can_manage_radio_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.radio_sessions session
    where session.id = target_session_id
      and (session.host_user_id = auth.uid() or public.can_manage_community_audio(session.community_id, 'hostRadio'))
  );
$$;
create or replace function public.can_view_podcast_episode(target_episode_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.podcast_episodes episode
    where episode.id = target_episode_id
      and (
        (episode.status = 'published' and public.can_view_community_audio(episode.community_id, null))
        or episode.author_user_id = auth.uid()
        or public.can_manage_community_audio(episode.community_id, 'publishPodcasts')
      )
  );
$$;
create or replace function public.can_manage_podcast_episode(target_episode_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.podcast_episodes episode
    where episode.id = target_episode_id
      and (episode.author_user_id = auth.uid() or public.can_manage_community_audio(episode.community_id, 'publishPodcasts'))
  );
$$;
create or replace function public.can_save_audio_item(target_item_type text, target_item_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when target_item_type = 'radio_session' then public.can_view_radio_session(target_item_id)
    when target_item_type = 'podcast_episode' then public.can_view_podcast_episode(target_item_id)
    else false
  end;
$$;
alter table public.radio_sessions enable row level security;
alter table public.radio_listeners enable row level security;
alter table public.podcast_episodes enable row level security;
alter table public.podcast_episode_reactions enable row level security;
alter table public.podcast_episode_comments enable row level security;
alter table public.saved_audio_items enable row level security;
create policy "radio sessions visible to authorized community viewers" on public.radio_sessions for select to authenticated using (public.can_view_community_audio(community_id, channel_id));
create policy "radio sessions created by permitted hosts" on public.radio_sessions for insert to authenticated with check (host_user_id = auth.uid() and public.can_manage_community_audio(community_id, 'hostRadio'));
create policy "radio sessions managed by host or community audio managers" on public.radio_sessions for update to authenticated using (host_user_id = auth.uid() or public.can_manage_community_audio(community_id, 'hostRadio')) with check (host_user_id = auth.uid() or public.can_manage_community_audio(community_id, 'hostRadio'));
create policy "radio sessions deleted by host or community audio managers" on public.radio_sessions for delete to authenticated using (host_user_id = auth.uid() or public.can_manage_community_audio(community_id, 'hostRadio'));
create policy "radio listeners visible to community members" on public.radio_listeners for select to authenticated using (public.can_view_radio_session(radio_session_id) and exists (select 1 from public.radio_sessions session where session.id = radio_session_id and public.is_community_member(session.community_id)));
create policy "users join visible live radio as self" on public.radio_listeners for insert to authenticated with check (user_id = auth.uid() and public.can_view_radio_session(radio_session_id) and exists (select 1 from public.radio_sessions session where session.id = radio_session_id and session.status = 'live'));
create policy "users update own radio listener state" on public.radio_listeners for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users leave own radio listener row" on public.radio_listeners for delete to authenticated using (user_id = auth.uid());
create policy "podcast episodes visible according to publication and community access" on public.podcast_episodes for select to authenticated using (public.can_view_podcast_episode(id));
create policy "podcast episodes created by permitted publishers" on public.podcast_episodes for insert to authenticated with check (author_user_id = auth.uid() and public.can_manage_community_audio(community_id, 'publishPodcasts'));
create policy "podcast episodes managed by author or community audio managers" on public.podcast_episodes for update to authenticated using (author_user_id = auth.uid() or public.can_manage_community_audio(community_id, 'publishPodcasts')) with check (author_user_id = auth.uid() or public.can_manage_community_audio(community_id, 'publishPodcasts'));
create policy "podcast episodes deleted by author or community audio managers" on public.podcast_episodes for delete to authenticated using (author_user_id = auth.uid() or public.can_manage_community_audio(community_id, 'publishPodcasts'));
create policy "podcast reactions follow episode visibility" on public.podcast_episode_reactions for select to authenticated using (public.can_view_podcast_episode(episode_id));
create policy "community members add own podcast reactions" on public.podcast_episode_reactions for insert to authenticated with check (user_id = auth.uid() and public.can_view_podcast_episode(episode_id) and exists (select 1 from public.podcast_episodes episode where episode.id = episode_id and public.is_community_member(episode.community_id)));
create policy "users delete own podcast reactions" on public.podcast_episode_reactions for delete to authenticated using (user_id = auth.uid());
create policy "podcast comments follow episode visibility" on public.podcast_episode_comments for select to authenticated using (public.can_view_podcast_episode(episode_id));
create policy "community members add own podcast comments" on public.podcast_episode_comments for insert to authenticated with check (author_id = auth.uid() and public.can_view_podcast_episode(episode_id) and exists (select 1 from public.podcast_episodes episode where episode.id = episode_id and public.is_community_member(episode.community_id)));
create policy "comment authors update their comments" on public.podcast_episode_comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "comment authors or audio managers delete comments" on public.podcast_episode_comments for delete to authenticated using (author_id = auth.uid() or exists (select 1 from public.podcast_episodes episode where episode.id = episode_id and public.can_manage_community_audio(episode.community_id, 'moderateMessages')));
create policy "users read own saved audio" on public.saved_audio_items for select to authenticated using (user_id = auth.uid());
create policy "users save visible audio for themselves" on public.saved_audio_items for insert to authenticated with check (user_id = auth.uid() and public.can_save_audio_item(item_type, item_id));
create policy "users unsave own audio" on public.saved_audio_items for delete to authenticated using (user_id = auth.uid());
revoke all on public.radio_sessions, public.radio_listeners, public.podcast_episodes, public.podcast_episode_reactions, public.podcast_episode_comments, public.saved_audio_items from anon;
grant select, insert, update, delete on public.radio_sessions, public.radio_listeners, public.podcast_episodes, public.podcast_episode_reactions, public.podcast_episode_comments, public.saved_audio_items to authenticated;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('podcast-audio', 'podcast-audio', false, 104857600, array['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm']),
  ('audio-covers', 'audio-covers', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "podcast audio read follows episode visibility" on storage.objects for select to authenticated using (
  bucket_id = 'podcast-audio'
  and name ~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/audio/[0-9a-f-]{36}\.(mp3|m4a|ogg|wav|webm)$'
  and public.can_view_podcast_episode(((storage.foldername(name))[4])::uuid)
);
create policy "podcast audio writers manage authorized episode objects" on storage.objects for insert to authenticated with check (
  bucket_id = 'podcast-audio'
  and name ~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/audio/[0-9a-f-]{36}\.(mp3|m4a|ogg|wav|webm)$'
  and public.can_manage_podcast_episode(((storage.foldername(name))[4])::uuid)
);
create policy "podcast audio writers delete authorized episode objects" on storage.objects for delete to authenticated using (
  bucket_id = 'podcast-audio'
  and public.can_manage_podcast_episode(((storage.foldername(name))[4])::uuid)
);
create policy "audio covers read follows radio or podcast visibility" on storage.objects for select to authenticated using (
  bucket_id = 'audio-covers'
  and (
    (name ~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' and public.can_view_podcast_episode(((storage.foldername(name))[4])::uuid))
    or (name ~ '^communities/[0-9a-f-]{36}/radio/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' and public.can_view_radio_session(((storage.foldername(name))[4])::uuid))
  )
);
create policy "audio cover writers manage authorized audio objects" on storage.objects for insert to authenticated with check (
  bucket_id = 'audio-covers'
  and (
    (name ~ '^communities/[0-9a-f-]{36}/podcasts/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' and public.can_manage_podcast_episode(((storage.foldername(name))[4])::uuid))
    or (name ~ '^communities/[0-9a-f-]{36}/radio/[0-9a-f-]{36}/covers/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$' and public.can_manage_radio_session(((storage.foldername(name))[4])::uuid))
  )
);
create policy "audio cover writers delete authorized audio objects" on storage.objects for delete to authenticated using (
  bucket_id = 'audio-covers'
  and (
    (name like 'communities/%/podcasts/%' and public.can_manage_podcast_episode(((storage.foldername(name))[4])::uuid))
    or (name like 'communities/%/radio/%' and public.can_manage_radio_session(((storage.foldername(name))[4])::uuid))
  )
);
comment on table public.radio_sessions is 'Community-scoped radio metadata. Live media transport remains outside Postgres.';
comment on table public.podcast_episodes is 'Community podcast metadata; private object URLs must be resolved through authorized storage access.';
comment on table public.saved_audio_items is 'User-private polymorphic audio bookmarks validated by RLS visibility helpers.';
