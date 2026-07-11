-- Task 442: community-kind capability and RLS enforcement.
-- Source rows are rejected when their community kind or scoped relation is incompatible.

create or replace function public.community_has_kind(target_community_id uuid, expected_kind public.community_kind)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.communities community
    where community.id = target_community_id and community.kind = expected_kind
  );
$$;

revoke all on function public.community_has_kind(uuid, public.community_kind) from public, anon, authenticated;

create or replace function public.can_view_community_kind_content(
  target_community_id uuid,
  expected_kind public.community_kind,
  target_channel_id uuid default null
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.communities community
    where community.id = target_community_id
      and community.kind = expected_kind
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

create or replace function public.can_manage_community_kind(
  target_community_id uuid,
  expected_kind public.community_kind,
  capability text
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.communities community
    where community.id = target_community_id
      and community.kind = expected_kind
      and (
        community.owner_id = auth.uid()
        or exists (
          select 1
          from public.community_members member
          join public.roles role on role.id = member.role_id and role.community_id = member.community_id
          where member.community_id = community.id
            and member.user_id = auth.uid()
            and (
              lower(role.name) = 'owner'
              or role.level >= 80
              or role.permissions ->> 'manageCommunity' = 'true'
              or role.permissions ->> capability = 'true'
            )
        )
      )
  );
$$;

revoke all on function public.can_view_community_kind_content(uuid, public.community_kind, uuid) from public;
revoke all on function public.can_manage_community_kind(uuid, public.community_kind, text) from public;
grant execute on function public.can_view_community_kind_content(uuid, public.community_kind, uuid) to anon, authenticated;
grant execute on function public.can_manage_community_kind(uuid, public.community_kind, text) to authenticated;

create or replace function public.can_view_community_audio(target_community_id uuid, target_channel_id uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.communities community
    where community.id = target_community_id
      and community.kind in ('radio'::public.community_kind, 'podcast'::public.community_kind)
      and public.can_view_community_kind_content(community.id, community.kind, target_channel_id)
  );
$$;

create or replace function public.can_manage_community_audio(target_community_id uuid, capability text default 'manageCommunity')
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when capability = any(array['hostRadio','manageRadioCommunity','manageRadioSchedule','manageRadioPrograms','publishRadioAnnouncements','moderateRadioComments','listenRadio'])
      then public.can_manage_community_kind(target_community_id, 'radio'::public.community_kind, capability)
    when capability = any(array['createPodcastDrafts','publishPodcasts','editPodcastMetadata','archivePodcastEpisodes','managePodcastSeries','commentOnPodcasts','reactToPodcasts','moderatePodcastComments','managePodcastCommunity','listenPodcasts'])
      then public.can_manage_community_kind(target_community_id, 'podcast'::public.community_kind, capability)
    else false
  end;
$$;

create or replace function public.can_view_radio_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.radio_sessions session
    where session.id = target_session_id
      and session.status <> 'cancelled'
      and public.can_view_community_kind_content(session.community_id, 'radio'::public.community_kind, session.channel_id)
  );
$$;

create or replace function public.can_manage_radio_session(target_session_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.radio_sessions session
    where session.id = target_session_id
      and public.community_has_kind(session.community_id, 'radio'::public.community_kind)
      and (session.host_user_id = auth.uid() or public.can_manage_community_kind(session.community_id, 'radio'::public.community_kind, 'hostRadio'))
  );
$$;

create or replace function public.can_view_podcast_episode(target_episode_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.podcast_episodes episode
    where episode.id = target_episode_id
      and public.community_has_kind(episode.community_id, 'podcast'::public.community_kind)
      and (
        (episode.status = 'published' and public.can_view_community_kind_content(episode.community_id, 'podcast'::public.community_kind, null))
        or public.can_manage_community_kind(episode.community_id, 'podcast'::public.community_kind, 'editPodcastMetadata')
        or public.can_manage_community_kind(episode.community_id, 'podcast'::public.community_kind, 'publishPodcasts')
      )
  );
$$;

create or replace function public.can_manage_podcast_episode(target_episode_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.podcast_episodes episode
    where episode.id = target_episode_id
      and public.community_has_kind(episode.community_id, 'podcast'::public.community_kind)
      and (
        public.can_manage_community_kind(episode.community_id, 'podcast'::public.community_kind, 'editPodcastMetadata')
        or public.can_manage_community_kind(episode.community_id, 'podcast'::public.community_kind, 'publishPodcasts')
        or public.can_manage_community_kind(episode.community_id, 'podcast'::public.community_kind, 'archivePodcastEpisodes')
      )
  );
$$;

create or replace function public.enforce_community_kind_reference()
returns trigger language plpgsql security definer set search_path = public as $$
declare expected_kind public.community_kind := tg_argv[0]::public.community_kind;
begin
  if not public.community_has_kind(new.community_id, expected_kind) then
    raise exception 'COMMUNITY_KIND_MISMATCH: % requires % community', tg_table_name, expected_kind using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_radio_channel_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.channel_id is not null and not exists (select 1 from public.channels channel where channel.id = new.channel_id and channel.community_id = new.community_id) then
    raise exception 'RADIO_CHANNEL_COMMUNITY_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_audio_settings_channel_scope()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_channel_id uuid;
begin
  if tg_table_name = 'radio_community_settings' then target_channel_id := new.listener_chat_channel_id;
  else target_channel_id := new.listener_discussion_channel_id;
  end if;
  if target_channel_id is not null and not exists (select 1 from public.channels channel where channel.id = target_channel_id and channel.community_id = new.community_id) then
    raise exception 'AUDIO_LISTENER_CHANNEL_COMMUNITY_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_podcast_series_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.series_id is not null and not exists (select 1 from public.podcast_series series where series.id = new.series_id and series.community_id = new.community_id) then
    raise exception 'PODCAST_SERIES_COMMUNITY_MISMATCH' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_podcast_episode_status_permission()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.status = 'draft' and not public.can_manage_community_kind(new.community_id, 'podcast'::public.community_kind, 'createPodcastDrafts') then raise exception 'PODCAST_DRAFT_PERMISSION_DENIED' using errcode = '42501'; end if;
    if new.status = 'published' and not public.can_manage_community_kind(new.community_id, 'podcast'::public.community_kind, 'publishPodcasts') then raise exception 'PODCAST_PUBLISH_PERMISSION_DENIED' using errcode = '42501'; end if;
    if new.status = 'archived' then raise exception 'PODCAST_ARCHIVED_INSERT_DENIED' using errcode = '42501'; end if;
  elsif new.status is distinct from old.status then
    if new.status = 'published' and not public.can_manage_community_kind(new.community_id, 'podcast'::public.community_kind, 'publishPodcasts') then raise exception 'PODCAST_PUBLISH_PERMISSION_DENIED' using errcode = '42501'; end if;
    if new.status = 'archived' and not public.can_manage_community_kind(new.community_id, 'podcast'::public.community_kind, 'archivePodcastEpisodes') then raise exception 'PODCAST_ARCHIVE_PERMISSION_DENIED' using errcode = '42501'; end if;
    if new.status = 'draft' and not public.can_manage_community_kind(new.community_id, 'podcast'::public.community_kind, 'createPodcastDrafts') then raise exception 'PODCAST_DRAFT_PERMISSION_DENIED' using errcode = '42501'; end if;
  end if;
  return new;
end;
$$;

do $$
declare table_name text; expected_kind text;
begin
  for table_name, expected_kind in
    select * from (values
      ('radio_sessions','radio'), ('radio_community_settings','radio'), ('radio_programs','radio'), ('radio_announcements','radio'),
      ('podcast_episodes','podcast'), ('podcast_community_settings','podcast'), ('podcast_series','podcast')
    ) as source(table_name, expected_kind)
  loop
    execute format('drop trigger if exists enforce_%I_kind on public.%I', table_name, table_name);
    execute format('create trigger enforce_%I_kind before insert or update of community_id on public.%I for each row execute function public.enforce_community_kind_reference(%L)', table_name, table_name, expected_kind);
  end loop;
end
$$;

drop trigger if exists radio_sessions_channel_scope on public.radio_sessions;
create trigger radio_sessions_channel_scope before insert or update of community_id, channel_id on public.radio_sessions for each row execute function public.enforce_radio_channel_scope();
drop trigger if exists radio_settings_channel_scope on public.radio_community_settings;
create trigger radio_settings_channel_scope before insert or update of community_id, listener_chat_channel_id on public.radio_community_settings for each row execute function public.enforce_audio_settings_channel_scope();
drop trigger if exists podcast_settings_channel_scope on public.podcast_community_settings;
create trigger podcast_settings_channel_scope before insert or update of community_id, listener_discussion_channel_id on public.podcast_community_settings for each row execute function public.enforce_audio_settings_channel_scope();
drop trigger if exists podcast_episode_series_scope on public.podcast_episodes;
create trigger podcast_episode_series_scope before insert or update of community_id, series_id on public.podcast_episodes for each row execute function public.enforce_podcast_series_scope();
drop trigger if exists podcast_episode_status_permission on public.podcast_episodes;
create trigger podcast_episode_status_permission before insert or update of status on public.podcast_episodes for each row execute function public.enforce_podcast_episode_status_permission();

update public.roles role set permissions = coalesce(role.permissions, '{}'::jsonb) || case
  when community.kind = 'text' and lower(role.name) in ('owner','admin') then '{"manageTextCommunity":true}'::jsonb
  when community.kind = 'radio' and lower(role.name) in ('owner','admin') then '{"viewRadioContent":true,"listenRadio":true,"hostRadio":true,"manageRadioCommunity":true,"manageRadioSchedule":true,"manageRadioPrograms":true,"publishRadioAnnouncements":true,"moderateRadioComments":true}'::jsonb
  when community.kind = 'radio' and lower(role.name) = 'radio host' then '{"viewRadioContent":true,"listenRadio":true,"hostRadio":true,"manageRadioSchedule":true,"manageRadioPrograms":true}'::jsonb
  when community.kind = 'radio' and lower(role.name) = 'moderator' then '{"viewRadioContent":true,"listenRadio":true,"moderateRadioComments":true}'::jsonb
  when community.kind = 'radio' then '{"viewRadioContent":true,"listenRadio":true}'::jsonb
  when community.kind = 'podcast' and lower(role.name) in ('owner','admin') then '{"viewPodcastContent":true,"listenPodcasts":true,"createPodcastDrafts":true,"publishPodcasts":true,"editPodcastMetadata":true,"archivePodcastEpisodes":true,"managePodcastSeries":true,"commentOnPodcasts":true,"reactToPodcasts":true,"moderatePodcastComments":true,"managePodcastCommunity":true}'::jsonb
  when community.kind = 'podcast' and lower(role.name) = 'podcast publisher' then '{"viewPodcastContent":true,"listenPodcasts":true,"createPodcastDrafts":true,"publishPodcasts":true,"editPodcastMetadata":true,"archivePodcastEpisodes":true,"managePodcastSeries":true,"commentOnPodcasts":true,"reactToPodcasts":true}'::jsonb
  when community.kind = 'podcast' and lower(role.name) in ('podcast editor','moderator') then '{"viewPodcastContent":true,"listenPodcasts":true,"editPodcastMetadata":true,"commentOnPodcasts":true,"reactToPodcasts":true,"moderatePodcastComments":true}'::jsonb
  when community.kind = 'podcast' then '{"viewPodcastContent":true,"listenPodcasts":true,"commentOnPodcasts":true,"reactToPodcasts":true}'::jsonb
  else '{}'::jsonb
end
from public.communities community
where community.id = role.community_id;

drop policy if exists "radio sessions visible to authorized community viewers" on public.radio_sessions;
create policy "radio sessions visible to authorized community viewers" on public.radio_sessions for select to authenticated using (public.can_view_radio_session(id));
drop policy if exists "radio sessions created by permitted hosts" on public.radio_sessions;
create policy "radio sessions created by permitted hosts" on public.radio_sessions for insert to authenticated with check (host_user_id = auth.uid() and public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'hostRadio'));
drop policy if exists "radio sessions managed by host or community audio managers" on public.radio_sessions;
create policy "radio sessions managed by host or community audio managers" on public.radio_sessions for update to authenticated using (public.can_manage_radio_session(id)) with check (host_user_id = auth.uid() or public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'hostRadio'));
drop policy if exists "radio sessions deleted by host or community audio managers" on public.radio_sessions;
create policy "radio sessions deleted by host or community audio managers" on public.radio_sessions for delete to authenticated using (public.can_manage_radio_session(id));
drop policy if exists "users join visible live radio as self" on public.radio_listeners;
create policy "users join visible live radio as self" on public.radio_listeners for insert to authenticated with check (user_id = auth.uid() and public.can_view_radio_session(radio_session_id) and exists (select 1 from public.radio_sessions session where session.id = radio_session_id and session.status = 'live' and public.can_manage_community_kind(session.community_id, 'radio'::public.community_kind, 'listenRadio')));

drop policy if exists "radio settings visible with station" on public.radio_community_settings;
create policy "radio settings visible with station" on public.radio_community_settings for select to authenticated using (public.can_view_community_kind_content(community_id, 'radio'::public.community_kind, listener_chat_channel_id));
drop policy if exists "radio settings managed by station managers" on public.radio_community_settings;
create policy "radio settings managed by station managers" on public.radio_community_settings for update to authenticated using (public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'manageRadioSchedule')) with check (public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'manageRadioSchedule'));
drop policy if exists "radio programs visible with station" on public.radio_programs;
create policy "radio programs visible with station" on public.radio_programs for select to authenticated using (public.can_view_community_kind_content(community_id, 'radio'::public.community_kind, null));
drop policy if exists "radio programs created by hosts" on public.radio_programs;
create policy "radio programs created by hosts" on public.radio_programs for insert to authenticated with check (created_by = auth.uid() and public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'manageRadioPrograms'));
drop policy if exists "radio programs managed by hosts" on public.radio_programs;
create policy "radio programs managed by hosts" on public.radio_programs for update to authenticated using (public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'manageRadioPrograms')) with check (public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'manageRadioPrograms'));
drop policy if exists "radio programs deleted by hosts" on public.radio_programs;
create policy "radio programs deleted by hosts" on public.radio_programs for delete to authenticated using (public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'manageRadioPrograms'));
drop policy if exists "radio announcements visible with station" on public.radio_announcements;
create policy "radio announcements visible with station" on public.radio_announcements for select to authenticated using (public.can_view_community_kind_content(community_id, 'radio'::public.community_kind, null));
drop policy if exists "radio announcements published by managers" on public.radio_announcements;
create policy "radio announcements published by managers" on public.radio_announcements for insert to authenticated with check (author_id = auth.uid() and public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'publishRadioAnnouncements'));
drop policy if exists "radio announcements managed by managers" on public.radio_announcements;
create policy "radio announcements managed by managers" on public.radio_announcements for update to authenticated using (author_id = auth.uid() or public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'publishRadioAnnouncements')) with check (author_id = auth.uid() or public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'publishRadioAnnouncements'));
drop policy if exists "radio announcements deleted by managers" on public.radio_announcements;
create policy "radio announcements deleted by managers" on public.radio_announcements for delete to authenticated using (author_id = auth.uid() or public.can_manage_community_kind(community_id, 'radio'::public.community_kind, 'publishRadioAnnouncements'));

drop policy if exists "podcast episodes visible according to publication and community access" on public.podcast_episodes;
create policy "podcast episodes visible according to publication and community access" on public.podcast_episodes for select to authenticated using (public.can_view_podcast_episode(id));
drop policy if exists "podcast episodes created by permitted publishers" on public.podcast_episodes;
create policy "podcast episodes created by permitted publishers" on public.podcast_episodes for insert to authenticated with check (
  author_user_id = auth.uid() and (
    (status = 'draft' and (public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'createPodcastDrafts') or public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'publishPodcasts')))
    or (status = 'published' and public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'publishPodcasts'))
  )
);
drop policy if exists "podcast episodes managed by author publisher or editor" on public.podcast_episodes;
drop policy if exists "podcast episodes managed by author or community audio managers" on public.podcast_episodes;
create policy "podcast episodes managed by permitted publishers and editors" on public.podcast_episodes for update to authenticated using (public.can_manage_podcast_episode(id)) with check (public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'editPodcastMetadata') or public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'publishPodcasts') or public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'archivePodcastEpisodes'));
drop policy if exists "podcast episodes deleted by author or community audio managers" on public.podcast_episodes;
create policy "podcast episodes deleted by publishers" on public.podcast_episodes for delete to authenticated using (public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'archivePodcastEpisodes') or public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'publishPodcasts'));

drop policy if exists "podcast settings visible with library" on public.podcast_community_settings;
create policy "podcast settings visible with library" on public.podcast_community_settings for select to authenticated using (public.can_view_community_kind_content(community_id, 'podcast'::public.community_kind, listener_discussion_channel_id));
drop policy if exists "podcast settings managed by publishers" on public.podcast_community_settings;
create policy "podcast settings managed by publishers" on public.podcast_community_settings for update to authenticated using (public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'managePodcastCommunity')) with check (public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'managePodcastCommunity'));
drop policy if exists "podcast series visible with library" on public.podcast_series;
create policy "podcast series visible with library" on public.podcast_series for select to authenticated using (public.can_view_community_kind_content(community_id, 'podcast'::public.community_kind, null));
drop policy if exists "podcast series created by publishers" on public.podcast_series;
create policy "podcast series created by publishers" on public.podcast_series for insert to authenticated with check (created_by = auth.uid() and public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'managePodcastSeries'));
drop policy if exists "podcast series managed by publishers" on public.podcast_series;
create policy "podcast series managed by publishers" on public.podcast_series for update to authenticated using (public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'managePodcastSeries')) with check (public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'managePodcastSeries'));
drop policy if exists "podcast series deleted by publishers" on public.podcast_series;
create policy "podcast series deleted by publishers" on public.podcast_series for delete to authenticated using (public.can_manage_community_kind(community_id, 'podcast'::public.community_kind, 'managePodcastSeries'));

drop policy if exists "community members add own podcast reactions" on public.podcast_episode_reactions;
create policy "community members add own podcast reactions" on public.podcast_episode_reactions for insert to authenticated with check (user_id = auth.uid() and public.can_view_podcast_episode(episode_id) and exists (select 1 from public.podcast_episodes episode where episode.id = episode_id and public.can_manage_community_kind(episode.community_id, 'podcast'::public.community_kind, 'reactToPodcasts')));
drop policy if exists "community members add own podcast comments" on public.podcast_episode_comments;
create policy "community members add own podcast comments" on public.podcast_episode_comments for insert to authenticated with check (author_id = auth.uid() and public.can_view_podcast_episode(episode_id) and exists (select 1 from public.podcast_episodes episode where episode.id = episode_id and public.can_manage_community_kind(episode.community_id, 'podcast'::public.community_kind, 'commentOnPodcasts')));
drop policy if exists "comment authors or podcast moderators delete comments" on public.podcast_episode_comments;
drop policy if exists "comment authors or audio managers delete comments" on public.podcast_episode_comments;
create policy "comment authors or podcast moderators delete comments" on public.podcast_episode_comments for delete to authenticated using (author_id = auth.uid() or exists (select 1 from public.podcast_episodes episode where episode.id = episode_id and public.can_manage_community_kind(episode.community_id, 'podcast'::public.community_kind, 'moderatePodcastComments')));

comment on function public.can_manage_community_kind(uuid, public.community_kind, text) is 'Canonical role and capability check that rejects cross-kind authorization.';
comment on function public.enforce_community_kind_reference() is 'Rejects Radio or Podcast source rows attached to a different community kind.';
