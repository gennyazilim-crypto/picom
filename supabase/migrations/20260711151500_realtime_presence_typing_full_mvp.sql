create or replace function public.subject_effective_community_permission(target_user_id uuid,target_community_id uuid,target_permission text,target_scope_type text default null,target_scope_id uuid default null)
returns boolean language plpgsql stable security definer set search_path=public,pg_temp as $$
declare community_kind text; community_owner uuid; target_member_id uuid; primary_role_id uuid; member_role_ids uuid[]; result boolean:=false; category_scope uuid; explicit_effect text;
begin
  select kind::text,owner_id into community_kind,community_owner from public.communities where id=target_community_id;
  if community_kind is null or target_user_id is null then return false; end if;
  if not exists(select 1 from public.community_permission_definitions where permission_key=target_permission and community_kind=any(allowed_kinds)) then return false; end if;
  if target_scope_type is not null and(target_scope_id is null or not public.permission_scope_belongs_to_community(target_community_id,target_scope_type,target_scope_id)) then return false; end if;
  if community_owner=target_user_id then return true; end if;
  select id,role_id into target_member_id,primary_role_id from public.community_members where community_id=target_community_id and user_id=target_user_id;
  if target_member_id is null then return false; end if;
  select array_agg(role_id) into member_role_ids from public.community_member_roles where member_id=target_member_id;
  if coalesce(cardinality(member_role_ids),0)=0 and primary_role_id is not null then member_role_ids:=array[primary_role_id]; end if;
  select coalesce(bool_or(coalesce(permission.allowed,case when jsonb_typeof(role.permissions->target_permission)='boolean' then(role.permissions->>target_permission)::boolean else false end)),false) into result from public.roles role left join public.community_role_permissions permission on permission.role_id=role.id and permission.permission_key=target_permission where role.id=any(member_role_ids);
  if target_scope_type='channel' then select category_id into category_scope from public.channels where id=target_scope_id and community_id=target_community_id; if category_scope is not null then select case when bool_or(effect='deny') then 'deny' when bool_or(effect='allow') then 'allow' end into explicit_effect from public.community_permission_overrides where role_id=any(member_role_ids) and scope_type='category' and scope_id=category_scope and permission_key=target_permission; if explicit_effect is not null then result:=explicit_effect='allow'; end if; end if; end if;
  if target_scope_type is not null then select case when bool_or(effect='deny') then 'deny' when bool_or(effect='allow') then 'allow' end into explicit_effect from public.community_permission_overrides where role_id=any(member_role_ids) and scope_type=target_scope_type and scope_id=target_scope_id and permission_key=target_permission; if explicit_effect is not null then result:=explicit_effect='allow'; end if; end if;
  return coalesce(result,false);
end; $$;

create or replace function public.can_access_picom_realtime_topic_for_subject(target_subject text,target_topic text,target_extension text)
returns boolean language plpgsql stable security definer set search_path=public,realtime,pg_temp as $$
declare target_user_id uuid; target_community_id uuid; target_channel_id uuid; target_conversation_id uuid; uuid_pattern constant text:='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
begin
  if target_subject is null or target_topic is null or target_extension is null then return false; end if;
  target_user_id:=target_subject::uuid;
  if target_extension='presence' and target_topic~('^presence:community:'||uuid_pattern||'$') then
    target_community_id:=split_part(target_topic,':',3)::uuid;
    return exists(select 1 from public.community_members member where member.community_id=target_community_id and member.user_id=target_user_id);
  end if;
  if target_extension='broadcast' and target_topic~('^dm:conversation:'||uuid_pattern||'$') then
    target_conversation_id:=split_part(target_topic,':',3)::uuid;
    return exists(select 1 from public.direct_conversation_participants participant where participant.conversation_id=target_conversation_id and participant.user_id=target_user_id and participant.blocked_at is null);
  end if;
  if target_extension in('broadcast','presence','postgres_changes') and target_topic~('^room:community:'||uuid_pattern||':all-visible-channels$') then
    target_community_id:=split_part(target_topic,':',3)::uuid;
    return exists(select 1 from public.community_members member where member.community_id=target_community_id and member.user_id=target_user_id);
  end if;
  if target_extension='broadcast' and target_topic~('^typing:community:'||uuid_pattern||':channel:'||uuid_pattern||'$') then
    target_community_id:=split_part(target_topic,':',3)::uuid; target_channel_id:=split_part(target_topic,':',5)::uuid;
  elsif target_extension in('broadcast','presence','postgres_changes') and target_topic~('^room:community:'||uuid_pattern||':channel:'||uuid_pattern||'$') then
    target_community_id:=split_part(target_topic,':',3)::uuid; target_channel_id:=split_part(target_topic,':',5)::uuid;
  else return false; end if;
  return exists(select 1 from public.channels channel join public.community_members member on member.community_id=channel.community_id and member.user_id=target_user_id where channel.id=target_channel_id and channel.community_id=target_community_id and(not channel.is_private or public.subject_effective_community_permission(target_user_id,target_community_id,'viewPrivateChannels','channel',target_channel_id)));
exception when invalid_text_representation then return false;
end; $$;

create or replace function public.can_access_picom_realtime_topic(target_topic text,target_extension text)
returns boolean language sql stable security definer set search_path=public,realtime,pg_temp as $$
  select public.can_access_picom_realtime_topic_for_subject(auth.uid()::text,target_topic,target_extension);
$$;

revoke all on function public.subject_effective_community_permission(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.can_access_picom_realtime_topic_for_subject(text,text,text),public.can_access_picom_realtime_topic(text,text) from public,anon;
grant execute on function public.can_access_picom_realtime_topic_for_subject(text,text,text),public.can_access_picom_realtime_topic(text,text) to authenticated;

drop policy if exists "picom members receive private realtime topics" on realtime.messages;
create policy "picom members receive private realtime topics" on realtime.messages for select to authenticated using(public.can_access_picom_realtime_topic_for_subject(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub',(select realtime.topic()),extension::text));
drop policy if exists "picom members send private realtime topics" on realtime.messages;
create policy "picom members send private realtime topics" on realtime.messages for insert to authenticated with check(public.can_access_picom_realtime_topic_for_subject(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub',(select realtime.topic()),extension::text));

comment on function public.can_access_picom_realtime_topic_for_subject(text,text,text) is 'Deny-by-default authorization for Picom community presence/typing/messages and participant-only DM typing topics.';;
