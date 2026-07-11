begin;

create table if not exists public.profile_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cover_url text check (cover_url is null or cover_url ~* '^https://'),
  preferred_language text check (preferred_language is null or char_length(preferred_language)<=48),
  tags text[] not null default '{}' check (cardinality(tags)<=12),
  updated_at timestamptz not null default now()
);
insert into public.profile_details(user_id) select id from public.profiles on conflict(user_id) do nothing;
alter table public.profile_details enable row level security;
revoke all on public.profile_details from public,anon,authenticated;
grant select,insert,update on public.profile_details to authenticated;
create policy "profile_details_owner_select" on public.profile_details for select to authenticated using(user_id=auth.uid());
create policy "profile_details_owner_insert" on public.profile_details for insert to authenticated with check(user_id=auth.uid());
create policy "profile_details_owner_update" on public.profile_details for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

alter table public.profile_privacy_settings
  add column if not exists show_communities boolean not null default true,
  add column if not exists show_friends boolean not null default true,
  add column if not exists show_follows boolean not null default true,
  add column if not exists show_audio boolean not null default true;

create or replace function public.get_own_profile_privacy_v3()
returns table(profile_visibility text,show_online_status boolean,show_location boolean,show_timezone boolean,show_activity boolean,show_media boolean,show_communities boolean,show_friends boolean,show_follows boolean,show_audio boolean)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  insert into public.profile_privacy_settings(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  return query select settings.profile_visibility,settings.show_online_status,settings.show_location,settings.show_timezone,settings.show_activity,settings.show_media,settings.show_communities,settings.show_friends,settings.show_follows,settings.show_audio from public.profile_privacy_settings settings where settings.user_id=auth.uid();
end;
$$;

create or replace function public.update_profile_privacy_v3(next_visibility text,next_show_online_status boolean,next_show_location boolean,next_show_timezone boolean,next_show_activity boolean,next_show_media boolean,next_show_communities boolean,next_show_friends boolean,next_show_follows boolean,next_show_audio boolean)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if next_visibility not in ('everyone','shared_communities','friends') then raise exception 'PROFILE_PRIVACY_INVALID' using errcode='22023'; end if;
  insert into public.profile_privacy_settings(user_id,profile_visibility,show_online_status,show_location,show_timezone,show_activity,show_media,show_communities,show_friends,show_follows,show_audio,updated_at)
  values(auth.uid(),next_visibility,next_show_online_status,next_show_location,next_show_timezone,next_show_activity,next_show_media,next_show_communities,next_show_friends,next_show_follows,next_show_audio,now())
  on conflict(user_id) do update set profile_visibility=excluded.profile_visibility,show_online_status=excluded.show_online_status,show_location=excluded.show_location,show_timezone=excluded.show_timezone,show_activity=excluded.show_activity,show_media=excluded.show_media,show_communities=excluded.show_communities,show_friends=excluded.show_friends,show_follows=excluded.show_follows,show_audio=excluded.show_audio,updated_at=now();
  return true;
end;
$$;

create or replace function public.get_profile_privacy_projection_v3(target_user_id uuid)
returns table(profile_visibility text,can_view_profile boolean,show_online_status boolean,show_location boolean,show_timezone boolean,show_activity boolean,show_media boolean,show_communities boolean,show_friends boolean,show_follows boolean,show_audio boolean,location text,timezone text)
language plpgsql stable security definer set search_path=public as $$
declare base record; settings public.profile_privacy_settings%rowtype; owner_view boolean:=auth.uid()=target_user_id; shared_access boolean; friend_access boolean; trusted boolean;
begin
  if auth.uid() is null then return query select 'friends'::text,false,false,false,false,false,false,false,false,false,false,null::text,null::text; return; end if;
  select * into base from public.get_profile_privacy_projection_v2(target_user_id);
  select * into settings from public.profile_privacy_settings where user_id=target_user_id;
  if settings.user_id is null then settings.profile_visibility:='everyone';settings.show_online_status:=true;settings.show_location:=true;settings.show_timezone:=true;settings.show_activity:=true;settings.show_media:=true;settings.show_communities:=true;settings.show_friends:=true;settings.show_follows:=true;settings.show_audio:=true;end if;
  shared_access:=exists(select 1 from public.community_members viewer join public.community_members target on target.community_id=viewer.community_id where viewer.user_id=auth.uid() and target.user_id=target_user_id);
  friend_access:=public.are_friends(auth.uid(),target_user_id);
  trusted:=owner_view or shared_access or friend_access;
  return query select settings.profile_visibility,base.can_view_profile,base.show_online_status,base.show_location,base.show_timezone,base.show_activity,base.show_media,base.can_view_profile and settings.show_communities and trusted,base.can_view_profile and settings.show_friends and trusted,base.can_view_profile and settings.show_follows and trusted,base.can_view_profile and settings.show_audio,base.location,base.timezone;
end;
$$;

create or replace function public.get_profile_domain_v1(target_user_id uuid,result_limit integer default 30)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare projection record; payload jsonb; details public.profile_details%rowtype; profile_row public.profiles%rowtype; profile_json jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into projection from public.get_profile_privacy_projection_v3(target_user_id);
  payload:=public.get_profile_activity_v3(target_user_id,result_limit);
  payload:=payload||jsonb_build_object('privacy',jsonb_build_object('visibility',projection.profile_visibility,'can_view_profile',projection.can_view_profile,'show_online_status',projection.show_online_status,'show_location',projection.show_location,'show_timezone',projection.show_timezone,'show_activity',projection.show_activity,'show_media',projection.show_media,'show_communities',projection.show_communities,'show_friends',projection.show_friends,'show_follows',projection.show_follows,'show_audio',projection.show_audio));
  if projection.can_view_profile is not true then return payload; end if;
  select * into profile_row from public.profiles where id=target_user_id;
  select * into details from public.profile_details where user_id=target_user_id;
  profile_json:=coalesce(payload->'profile','{}'::jsonb)||jsonb_build_object('cover_url',details.cover_url,'preferred_language',details.preferred_language,'tags',coalesce(to_jsonb(details.tags),'[]'::jsonb),'accent_color',profile_row.accent_color,'updated_at',profile_row.updated_at,'onboarding_completed',case when target_user_id=auth.uid() then profile_row.onboarding_completed else null end);
  payload:=jsonb_set(payload,'{profile}',profile_json,true);
  if not projection.show_communities then payload:=jsonb_set(payload,'{roles}','[]'::jsonb,true);payload:=jsonb_set(payload,'{stats,communities}','0'::jsonb,true);payload:=jsonb_set(payload,'{stats,roles}','0'::jsonb,true);end if;
  if not projection.show_follows then payload:=jsonb_set(payload,'{stats,followers}','0'::jsonb,true);payload:=jsonb_set(payload,'{stats,following}','0'::jsonb,true);end if;
  return payload;
end;
$$;

create or replace function public.update_own_profile_domain(profile_patch jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare normalized_tags text[];
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if profile_patch is null or jsonb_typeof(profile_patch)<>'object' then raise exception 'PROFILE_PATCH_INVALID' using errcode='22023'; end if;
  if profile_patch-array['username','displayName','status','statusText','bio','avatarUrl','coverUrl','preferredLanguage','tags','location','timezone','accentColor']::text[]<>'{}'::jsonb then raise exception 'PROFILE_PATCH_FIELD_INVALID' using errcode='22023'; end if;
  if profile_patch?'tags' then
    if jsonb_typeof(profile_patch->'tags')<>'array' or jsonb_array_length(profile_patch->'tags')>12 then raise exception 'PROFILE_TAGS_INVALID' using errcode='22023'; end if;
    select coalesce(array_agg(btrim(value)),'{}'::text[]) into normalized_tags from jsonb_array_elements_text(profile_patch->'tags') value;
    if exists(select 1 from unnest(normalized_tags) tag where char_length(tag) not between 1 and 32) then raise exception 'PROFILE_TAGS_INVALID' using errcode='22023'; end if;
  end if;
  if profile_patch?'status' and profile_patch->>'status' not in ('online','idle','dnd','offline') then raise exception 'PROFILE_STATUS_INVALID' using errcode='22023'; end if;
  update public.profiles set
    username=case when profile_patch?'username' then lower(btrim(profile_patch->>'username')) else username end,
    display_name=case when profile_patch?'displayName' then btrim(profile_patch->>'displayName') else display_name end,
    status=case when profile_patch?'status' then profile_patch->>'status' else status end,
    status_text=case when profile_patch?'statusText' then coalesce(profile_patch->>'statusText','') else status_text end,
    bio=case when profile_patch?'bio' then nullif(btrim(profile_patch->>'bio'),'') else bio end,
    avatar_url=case when profile_patch?'avatarUrl' then nullif(btrim(profile_patch->>'avatarUrl'),'') else avatar_url end,
    accent_color=case when profile_patch?'accentColor' then nullif(btrim(profile_patch->>'accentColor'),'') else accent_color end,
    updated_at=now()
  where id=auth.uid();
  insert into public.profile_details(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  update public.profile_details set
    cover_url=case when profile_patch?'coverUrl' then nullif(btrim(profile_patch->>'coverUrl'),'') else cover_url end,
    preferred_language=case when profile_patch?'preferredLanguage' then nullif(btrim(profile_patch->>'preferredLanguage'),'') else preferred_language end,
    tags=case when profile_patch?'tags' then normalized_tags else tags end,
    updated_at=now()
  where user_id=auth.uid();
  insert into public.profile_privacy_settings(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  update public.profile_privacy_settings set location=case when profile_patch?'location' then nullif(btrim(profile_patch->>'location'),'') else location end,timezone=case when profile_patch?'timezone' then nullif(btrim(profile_patch->>'timezone'),'') else timezone end,updated_at=now() where user_id=auth.uid();
  return public.get_profile_domain_v1(auth.uid(),30);
end;
$$;

revoke all on function public.get_own_profile_privacy_v3(),public.update_profile_privacy_v3(text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean),public.get_profile_privacy_projection_v3(uuid),public.get_profile_domain_v1(uuid,integer),public.update_own_profile_domain(jsonb) from public,anon;
grant execute on function public.get_own_profile_privacy_v3(),public.update_profile_privacy_v3(text,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean),public.get_profile_privacy_projection_v3(uuid),public.get_profile_domain_v1(uuid,integer),public.update_own_profile_domain(jsonb) to authenticated;

comment on table public.profile_details is 'Owner-private extended profile fields. Public projection is available only through get_profile_domain_v1.';
comment on function public.get_profile_domain_v1(uuid,integer) is 'Canonical privacy-projected profile domain. Activity and media remain filtered by can_view_message and attachment safety state.';

commit;
