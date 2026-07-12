-- Task 499: atomic branding, rules, notification, and kind-specific community settings.
begin;
alter table public.communities add column if not exists banner_url text;
alter table public.communities add column if not exists default_notification_level text not null default 'mentions';
alter table public.communities add column if not exists type_settings jsonb not null default '{"kind":"text","maxMessageLength":4000,"attachmentsEnabled":true,"reactionsEnabled":true}'::jsonb;
alter table public.communities drop constraint if exists communities_banner_url_check;
alter table public.communities add constraint communities_banner_url_check check(banner_url is null or (char_length(banner_url)<=2048 and banner_url ~* '^https://'));
alter table public.communities drop constraint if exists communities_default_notification_level_check;
alter table public.communities add constraint communities_default_notification_level_check check(default_notification_level in ('all','mentions','none'));
alter table public.communities drop constraint if exists communities_type_settings_object_check;
alter table public.communities add constraint communities_type_settings_object_check check(jsonb_typeof(type_settings)='object');

alter table public.radio_community_settings add column if not exists default_host_role text not null default 'host' check(default_host_role in ('owner','host'));
alter table public.radio_community_settings add column if not exists schedule_visibility text not null default 'public' check(schedule_visibility in ('public','members'));
alter table public.radio_community_settings add column if not exists listener_rules text not null default 'Keep live discussion relevant and respectful.' check(char_length(listener_rules)<=500);
alter table public.podcast_community_settings add column if not exists default_publisher_role text not null default 'publisher' check(default_publisher_role in ('owner','publisher'));
alter table public.podcast_community_settings add column if not exists comments_enabled boolean not null default true;
alter table public.podcast_community_settings add column if not exists explicit_content_default boolean not null default false;
alter table public.podcast_community_settings add column if not exists comment_rules text not null default 'Discuss the episode respectfully.' check(char_length(comment_rules)<=500);

create or replace function public.valid_community_type_settings(target_kind public.community_kind, settings jsonb) returns boolean language sql immutable set search_path=public as $$
  select jsonb_typeof(settings)='object' and settings->>'kind'=target_kind::text and case target_kind
    when 'text' then coalesce((settings->>'maxMessageLength') ~ '^[0-9]+$',false) and (settings->>'maxMessageLength')::integer between 250 and 4000 and jsonb_typeof(settings->'attachmentsEnabled')='boolean' and jsonb_typeof(settings->'reactionsEnabled')='boolean'
    when 'radio' then settings->>'defaultHostRole' in ('owner','host') and char_length(coalesce(settings->>'scheduleTimezone','')) between 1 and 64 and settings->>'scheduleVisibility' in ('public','members') and jsonb_typeof(settings->'listenerChatEnabled')='boolean' and char_length(coalesce(settings->>'listenerRules',''))<=500
    when 'podcast' then settings->>'defaultPublisherRole' in ('owner','publisher') and jsonb_typeof(settings->'commentsEnabled')='boolean' and jsonb_typeof(settings->'explicitContentDefault')='boolean' and char_length(coalesce(settings->>'commentRules',''))<=500
  end;
$$;

drop function if exists public.update_community_settings(uuid,text,text,text,text,boolean);
create function public.update_community_settings(target_community_id uuid,next_name text,next_description text,next_icon_url text,next_banner_url text,next_visibility text,next_public_read_enabled boolean,next_default_notification_level text,next_rules_enabled boolean,next_rules_version text,next_type_settings jsonb,next_rules jsonb)
returns setof public.communities language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.communities%rowtype; updated public.communities%rowtype; clean_name text:=nullif(regexp_replace(btrim(next_name),'\s+',' ','g'),''); clean_description text:=nullif(btrim(next_description),''); clean_icon text:=nullif(btrim(next_icon_url),''); clean_banner text:=nullif(btrim(next_banner_url),''); rule_count integer;
begin
  if auth.uid() is null or not public.effective_community_permission(target_community_id,'manageCommunity') then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  select * into target from public.communities where id=target_community_id and archived_at is null for update;
  if target.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode='22023'; end if;
  if clean_name is null or char_length(clean_name)>80 then raise exception 'COMMUNITY_NAME_INVALID' using errcode='22023'; end if;
  if clean_description is not null and char_length(clean_description)>500 then raise exception 'COMMUNITY_DESCRIPTION_INVALID' using errcode='22023'; end if;
  if clean_icon is not null and (char_length(clean_icon)>2048 or clean_icon !~* '^https://') then raise exception 'COMMUNITY_ICON_INVALID' using errcode='22023'; end if;
  if clean_banner is not null and (char_length(clean_banner)>2048 or clean_banner !~* '^https://') then raise exception 'COMMUNITY_BANNER_INVALID' using errcode='22023'; end if;
  if next_visibility not in ('public','private') or next_default_notification_level not in ('all','mentions','none') then raise exception 'COMMUNITY_POLICY_INVALID' using errcode='22023'; end if;
  if next_rules_version !~ '^[a-zA-Z0-9._-]{1,32}$' or not public.valid_community_type_settings(target.kind,next_type_settings) then raise exception 'COMMUNITY_TYPE_SETTINGS_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(next_rules)<>'array' or jsonb_array_length(next_rules)>10 then raise exception 'COMMUNITY_RULES_INVALID' using errcode='22023'; end if;
  select count(*) into rule_count from jsonb_array_elements(next_rules) rule where char_length(btrim(rule->>'title')) between 1 and 120 and char_length(btrim(rule->>'body')) between 1 and 2000 and jsonb_typeof(rule->'required')='boolean';
  if rule_count<>jsonb_array_length(next_rules) or (coalesce(next_rules_enabled,false) and rule_count=0) then raise exception 'COMMUNITY_RULES_INVALID' using errcode='22023'; end if;
  update public.communities set name=clean_name,description=clean_description,icon_url=clean_icon,banner_url=clean_banner,visibility=next_visibility,public_read_enabled=case when next_visibility='private' then false else coalesce(next_public_read_enabled,false) end,default_notification_level=next_default_notification_level,rules_enabled=coalesce(next_rules_enabled,false),rules_version=next_rules_version,type_settings=next_type_settings,updated_at=now() where id=target_community_id returning * into updated;
  delete from public.community_rules where community_id=target_community_id;
  insert into public.community_rules(community_id,title,body,position,required,published)
  select target_community_id,btrim(rule->>'title'),btrim(rule->>'body'),ordinality-1,(rule->>'required')::boolean,true from jsonb_array_elements(next_rules) with ordinality as entry(rule,ordinality);
  if target.kind='radio' then insert into public.radio_community_settings(community_id,schedule_timezone,listener_chat_enabled,default_host_role,schedule_visibility,listener_rules) values(target.id,next_type_settings->>'scheduleTimezone',(next_type_settings->>'listenerChatEnabled')::boolean,next_type_settings->>'defaultHostRole',next_type_settings->>'scheduleVisibility',next_type_settings->>'listenerRules') on conflict(community_id) do update set schedule_timezone=excluded.schedule_timezone,listener_chat_enabled=excluded.listener_chat_enabled,default_host_role=excluded.default_host_role,schedule_visibility=excluded.schedule_visibility,listener_rules=excluded.listener_rules,updated_at=now(); end if;
  if target.kind='podcast' then insert into public.podcast_community_settings(community_id,default_publisher_role,comments_enabled,explicit_content_default,comment_rules) values(target.id,next_type_settings->>'defaultPublisherRole',(next_type_settings->>'commentsEnabled')::boolean,(next_type_settings->>'explicitContentDefault')::boolean,next_type_settings->>'commentRules') on conflict(community_id) do update set default_publisher_role=excluded.default_publisher_role,comments_enabled=excluded.comments_enabled,explicit_content_default=excluded.explicit_content_default,comment_rules=excluded.comment_rules,updated_at=now(); end if;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(updated.id,auth.uid(),'community_update','community_settings',updated.id,public.redact_audit_reason('Community identity, rules, notification defaults, and kind settings updated'));
  return next updated;
end; $$;
revoke all on function public.update_community_settings(uuid,text,text,text,text,text,boolean,text,boolean,text,jsonb,jsonb) from public,anon;
grant execute on function public.update_community_settings(uuid,text,text,text,text,text,boolean,text,boolean,text,jsonb,jsonb) to authenticated;

create or replace function public.text_message_setting_allows(target_channel_id uuid,target_body text,target_capability text default 'message') returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select case when community.kind<>'text' then true when target_capability='attachment' then coalesce((community.type_settings->>'attachmentsEnabled')::boolean,true) when target_capability='reaction' then coalesce((community.type_settings->>'reactionsEnabled')::boolean,true) else char_length(coalesce(target_body,''))<=coalesce((community.type_settings->>'maxMessageLength')::integer,4000) end from public.channels channel join public.communities community on community.id=channel.community_id where channel.id=target_channel_id),false);
$$;
create policy "text message settings insert guard" on public.messages as restrictive for insert to authenticated with check(public.text_message_setting_allows(channel_id,body,'message'));
create policy "text attachment settings insert guard" on public.attachments as restrictive for insert to authenticated with check(exists(select 1 from public.messages message where message.id=message_id and public.text_message_setting_allows(message.channel_id,null,'attachment')));
create policy "text reaction settings insert guard" on public.message_reactions as restrictive for insert to authenticated with check(exists(select 1 from public.messages message where message.id=message_id and public.text_message_setting_allows(message.channel_id,null,'reaction')));
create policy "radio schedule visibility settings guard" on public.radio_program_schedules as restrictive for select to authenticated using(exists(select 1 from public.radio_community_settings settings where settings.community_id=community_id and (settings.schedule_visibility='public' or public.is_community_member(community_id))));
create policy "podcast comments settings guard" on public.podcast_episode_comments as restrictive for insert to authenticated with check(exists(select 1 from public.podcast_episodes episode join public.podcast_community_settings settings on settings.community_id=episode.community_id where episode.id=episode_id and settings.comments_enabled));
create or replace function public.apply_podcast_explicit_default() returns trigger language plpgsql security definer set search_path=public as $$ begin if not new.is_explicit and exists(select 1 from public.podcast_community_settings where community_id=new.community_id and explicit_content_default) then new.is_explicit:=true; end if; return new; end $$;
drop trigger if exists podcast_episode_explicit_default on public.podcast_episodes;
create trigger podcast_episode_explicit_default before insert on public.podcast_episodes for each row execute function public.apply_podcast_explicit_default();

commit;
