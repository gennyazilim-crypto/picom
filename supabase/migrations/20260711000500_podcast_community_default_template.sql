-- Task 440: dedicated Podcast-community bootstrap, publishing structure, and RLS.

alter table public.communities drop constraint if exists communities_creation_template_check;
alter table public.communities add constraint communities_creation_template_check
  check (creation_template_id is null or creation_template_id in ('custom', 'gaming', 'study-group', 'developer-team', 'music-community', 'design-studio', 'work-space', 'radio-default', 'podcast-default'));

create table if not exists public.podcast_community_settings (
  community_id uuid primary key references public.communities(id) on delete cascade,
  about text not null default '' check (char_length(about) <= 4000),
  listener_discussion_enabled boolean not null default false,
  listener_discussion_channel_id uuid references public.channels(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (listener_discussion_enabled = false or listener_discussion_channel_id is not null)
);

create table if not exists public.podcast_series (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '' check (char_length(description) <= 4000),
  cover_url text check (cover_url is null or cover_url ~* '^https://'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, title)
);

alter table public.podcast_episodes add column if not exists series_id uuid references public.podcast_series(id) on delete set null;
create index if not exists podcast_series_community_active_idx on public.podcast_series(community_id, is_active, created_at);
create index if not exists podcast_episodes_series_published_idx on public.podcast_episodes(series_id, published_at desc) where series_id is not null;
drop trigger if exists podcast_community_settings_set_updated_at on public.podcast_community_settings;
create trigger podcast_community_settings_set_updated_at before update on public.podcast_community_settings for each row execute function public.set_audio_updated_at();
drop trigger if exists podcast_series_set_updated_at on public.podcast_series;
create trigger podcast_series_set_updated_at before update on public.podcast_series for each row execute function public.set_audio_updated_at();

alter table public.podcast_community_settings enable row level security;
alter table public.podcast_series enable row level security;
create policy "podcast settings visible with library" on public.podcast_community_settings for select to authenticated using (public.can_view_community_audio(community_id, listener_discussion_channel_id));
create policy "podcast settings managed by publishers" on public.podcast_community_settings for update to authenticated using (public.can_manage_community_audio(community_id, 'managePodcastSeries')) with check (public.can_manage_community_audio(community_id, 'managePodcastSeries'));
create policy "podcast series visible with library" on public.podcast_series for select to authenticated using (public.can_view_community_audio(community_id, null));
create policy "podcast series created by publishers" on public.podcast_series for insert to authenticated with check (created_by=auth.uid() and public.can_manage_community_audio(community_id, 'managePodcastSeries'));
create policy "podcast series managed by publishers" on public.podcast_series for update to authenticated using (public.can_manage_community_audio(community_id, 'managePodcastSeries')) with check (public.can_manage_community_audio(community_id, 'managePodcastSeries'));
create policy "podcast series deleted by publishers" on public.podcast_series for delete to authenticated using (public.can_manage_community_audio(community_id, 'managePodcastSeries'));

drop policy if exists "podcast episodes managed by author or community audio managers" on public.podcast_episodes;
create policy "podcast episodes managed by author publisher or editor" on public.podcast_episodes for update to authenticated
using (author_user_id=auth.uid() or public.can_manage_community_audio(community_id,'publishPodcasts') or public.can_manage_community_audio(community_id,'editPodcastMetadata'))
with check (author_user_id=auth.uid() or public.can_manage_community_audio(community_id,'publishPodcasts') or public.can_manage_community_audio(community_id,'editPodcastMetadata'));
drop policy if exists "comment authors or audio managers delete comments" on public.podcast_episode_comments;
create policy "comment authors or podcast moderators delete comments" on public.podcast_episode_comments for delete to authenticated using (
  author_id=auth.uid() or exists(select 1 from public.podcast_episodes episode where episode.id=episode_id and (public.can_manage_community_audio(episode.community_id,'moderateMessages') or public.can_manage_community_audio(episode.community_id,'moderatePodcastComments')))
);

revoke all on public.podcast_community_settings, public.podcast_series from anon;
grant select, update on public.podcast_community_settings to authenticated;
grant select, insert, update, delete on public.podcast_series to authenticated;

create or replace function public.ensure_podcast_community_default_template(target_community_id uuid, target_owner_id uuid, target_about text default '')
returns void language plpgsql security definer set search_path=public,extensions as $$
declare target_kind public.community_kind; owner_role_id uuid;
begin
  select community.kind into target_kind from public.communities community where community.id=target_community_id and community.owner_id=target_owner_id;
  if target_kind is distinct from 'podcast'::public.community_kind then raise exception 'PODCAST_TEMPLATE_COMMUNITY_INVALID' using errcode='23514'; end if;
  insert into public.roles(community_id,name,color,level,permissions) values
    (target_community_id,'Owner','#007571',100,'{"manageCommunity":true,"manageRoles":true,"manageMembers":true,"publishPodcasts":true,"managePodcastSeries":true,"editAnyPodcast":true,"editPodcastMetadata":true,"moderatePodcastComments":true,"createInvites":true,"viewAuditLog":true}'::jsonb),
    (target_community_id,'Podcast Publisher','#10C2BB',50,'{"publishPodcasts":true,"managePodcastSeries":true}'::jsonb),
    (target_community_id,'Podcast Editor','#FF772E',40,'{"editPodcastMetadata":true,"moderatePodcastComments":true}'::jsonb),
    (target_community_id,'Member','#6B7F8C',10,'{"listenPodcasts":true}'::jsonb)
  on conflict do nothing;
  select role.id into owner_role_id from public.roles role where role.community_id=target_community_id and lower(role.name)='owner' order by role.level desc limit 1;
  if owner_role_id is null then raise exception 'PODCAST_TEMPLATE_OWNER_ROLE_MISSING' using errcode='23514'; end if;
  insert into public.community_members(community_id,user_id,role_id) values(target_community_id,target_owner_id,owner_role_id) on conflict(community_id,user_id) do update set role_id=excluded.role_id;
  insert into public.podcast_community_settings(community_id,about,listener_discussion_enabled,listener_discussion_channel_id) values(target_community_id,left(coalesce(target_about,''),4000),false,null) on conflict(community_id) do nothing;
end
$$;
revoke all on function public.ensure_podcast_community_default_template(uuid,uuid,text) from public,anon,authenticated;

create or replace function public.create_podcast_community_with_defaults(
  target_creation_request_id uuid,
  community_name text,
  community_description text default null,
  community_icon_url text default null,
  community_accent_color text default '#007571',
  community_visibility text default 'public',
  community_public_read_enabled boolean default true
)
returns setof public.communities language plpgsql security definer set search_path=public,extensions as $$
declare
  requester_id uuid:=auth.uid();
  normalized_name text:=regexp_replace(btrim(coalesce(community_name,'')),'\s+',' ','g');
  normalized_description text:=nullif(btrim(community_description),'');
  normalized_icon_url text:=nullif(btrim(community_icon_url),'');
  created_community public.communities%rowtype;
begin
  if requester_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if target_creation_request_id is null then raise exception 'CREATION_REQUEST_ID_REQUIRED' using errcode='22023'; end if;
  if normalized_name='' or char_length(normalized_name)>80 then raise exception 'COMMUNITY_NAME_INVALID' using errcode='22023'; end if;
  if normalized_description is not null and char_length(normalized_description)>500 then raise exception 'COMMUNITY_DESCRIPTION_INVALID' using errcode='22023'; end if;
  if normalized_icon_url is not null and (char_length(normalized_icon_url)>2048 or normalized_icon_url !~* '^https://') then raise exception 'COMMUNITY_ICON_URL_INVALID' using errcode='22023'; end if;
  if community_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'COMMUNITY_ACCENT_INVALID' using errcode='22023'; end if;
  if community_visibility not in ('public','private') then raise exception 'COMMUNITY_VISIBILITY_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(requester_id::text||':'||target_creation_request_id::text,0));
  select community.* into created_community from public.communities community where community.owner_id=requester_id and community.creation_request_id=target_creation_request_id;
  if found then
    if created_community.kind is distinct from 'podcast'::public.community_kind or created_community.name is distinct from normalized_name or created_community.creation_template_id is distinct from 'podcast-default' then raise exception 'COMMUNITY_CREATION_KEY_CONFLICT' using errcode='23505'; end if;
    perform public.ensure_podcast_community_default_template(created_community.id,requester_id,normalized_description);
    return next created_community; return;
  end if;
  insert into public.communities(owner_id,kind,name,description,icon_url,accent_color,visibility,public_read_enabled,creation_request_id,creation_template_id)
  values(requester_id,'podcast'::public.community_kind,normalized_name,normalized_description,normalized_icon_url,community_accent_color,community_visibility,case when community_visibility='public' then community_public_read_enabled else false end,target_creation_request_id,'podcast-default') returning * into created_community;
  perform public.ensure_podcast_community_default_template(created_community.id,requester_id,normalized_description);
  return next created_community;
end
$$;
revoke all on function public.create_podcast_community_with_defaults(uuid,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.create_podcast_community_with_defaults(uuid,text,text,text,text,text,boolean) to authenticated;
comment on function public.create_podcast_community_with_defaults(uuid,text,text,text,text,text,boolean) is 'Atomically creates an idempotent Podcast community, publishing roles, private-library settings, and no primary text channels.';
