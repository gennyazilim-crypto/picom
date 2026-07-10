alter table public.community_invites add column if not exists campaign_label text,add column if not exists last_used_at timestamptz;
alter table public.community_invites drop constraint if exists community_invites_campaign_label_check;
alter table public.community_invites add constraint community_invites_campaign_label_check check(campaign_label is null or char_length(campaign_label) between 1 and 80);
alter table public.audit_log drop constraint if exists audit_log_action_type_check;
alter table public.audit_log add constraint audit_log_action_type_check check(action_type in('community_update','channel_create','channel_update','channel_delete','role_change','member_change','moderation_action','invite_create','invite_revoke','invite_accept','webhook_create','webhook_revoke','webhook_message','discovery_review'));

create or replace function public.create_community_invite(target_community_id uuid,target_max_uses integer default null,target_expires_at timestamptz default null,target_campaign_label text default null) returns setof public.community_invites language plpgsql security definer set search_path=public as $$
declare created public.community_invites%rowtype; begin
  if auth.uid() is null or not public.can_create_community_invite(target_community_id) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  if target_max_uses is not null and (target_max_uses<1 or target_max_uses>1000) then raise exception 'INVITE_MAX_USES_INVALID' using errcode='22023'; end if;
  if target_expires_at is not null and (target_expires_at<=now() or target_expires_at>now()+interval '90 days') then raise exception 'INVITE_EXPIRY_INVALID' using errcode='22023'; end if;
  insert into public.community_invites(community_id,code,created_by,max_uses,expires_at,campaign_label) values(target_community_id,encode(gen_random_bytes(18),'hex'),auth.uid(),target_max_uses,target_expires_at,left(nullif(btrim(target_campaign_label),''),80)) returning * into created;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'invite_create','invite',created.id,public.redact_audit_reason('Invite campaign created: '||coalesce(created.campaign_label,'unlabeled')));
  return next created;
end $$;

create or replace function public.revoke_community_invite(target_invite_id uuid) returns setof public.community_invites language plpgsql security definer set search_path=public as $$
declare invite public.community_invites%rowtype; begin
  select * into invite from public.community_invites where id=target_invite_id for update;
  if invite.id is null or not public.can_create_community_invite(invite.community_id) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  update public.community_invites set revoked_at=coalesce(revoked_at,now()) where id=target_invite_id returning * into invite;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(invite.community_id,auth.uid(),'invite_revoke','invite',invite.id,'Invite campaign revoked');
  return next invite;
end $$;

create or replace function public.accept_community_invite(invite_code text) returns table(id uuid,community_id uuid,user_id uuid,role_id uuid,joined_at timestamptz) language plpgsql security definer set search_path=public as $$
declare target_invite public.community_invites%rowtype;default_role_id uuid; begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into target_invite from public.community_invites where code=invite_code for update;
  if not found then raise exception 'invalid invite'; end if;
  if target_invite.revoked_at is not null then raise exception 'revoked invite'; end if;
  if target_invite.expires_at is not null and target_invite.expires_at<=now() then raise exception 'expired invite'; end if;
  if exists(select 1 from public.community_bans ban where ban.community_id=target_invite.community_id and ban.user_id=auth.uid() and ban.revoked_at is null) then raise exception 'banned user'; end if;
  if exists(select 1 from public.community_members membership where membership.community_id=target_invite.community_id and membership.user_id=auth.uid()) then return query select membership.id,membership.community_id,membership.user_id,membership.role_id,membership.joined_at from public.community_members membership where membership.community_id=target_invite.community_id and membership.user_id=auth.uid();return;end if;
  if target_invite.max_uses is not null and target_invite.uses>=target_invite.max_uses then raise exception 'exhausted invite'; end if;
  select role.id into default_role_id from public.roles role where role.community_id=target_invite.community_id and (role.is_default=true or role.name='Member') order by role.is_default desc,role.level asc limit 1;
  if default_role_id is null then raise exception 'DEFAULT_ROLE_MISSING'; end if;
  insert into public.community_members(community_id,user_id,role_id) values(target_invite.community_id,auth.uid(),default_role_id);
  update public.community_invites set uses=uses+1,last_used_at=now() where community_invites.id=target_invite.id;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_invite.community_id,auth.uid(),'invite_accept','invite',target_invite.id,'Invite accepted');
  return query select membership.id,membership.community_id,membership.user_id,membership.role_id,membership.joined_at from public.community_members membership where membership.community_id=target_invite.community_id and membership.user_id=auth.uid();
end $$;

create or replace function public.list_community_invite_campaigns(target_community_id uuid) returns table(id uuid,community_id uuid,created_by uuid,creator_name text,campaign_label text,max_uses integer,uses integer,expires_at timestamptz,revoked_at timestamptz,last_used_at timestamptz,created_at timestamptz) language plpgsql stable security definer set search_path=public as $$
begin
  if not public.can_create_community_invite(target_community_id) then raise exception 'PERMISSION_DENIED' using errcode='42501'; end if;
  return query select invite.id,invite.community_id,invite.created_by,profile.display_name,invite.campaign_label,invite.max_uses,invite.uses,invite.expires_at,invite.revoked_at,invite.last_used_at,invite.created_at from public.community_invites invite join public.profiles profile on profile.id=invite.created_by where invite.community_id=target_community_id order by invite.created_at desc limit 100;
end $$;
revoke insert,update,delete on public.community_invites from authenticated;
revoke all on function public.create_community_invite(uuid,integer,timestamptz,text),public.revoke_community_invite(uuid),public.list_community_invite_campaigns(uuid) from public,anon;
grant execute on function public.create_community_invite(uuid,integer,timestamptz,text),public.revoke_community_invite(uuid),public.list_community_invite_campaigns(uuid) to authenticated;
comment on function public.list_community_invite_campaigns(uuid) is 'Aggregate invite campaign state without invite codes, redemption identities, IP addresses, devices, referrers, fingerprints, or secrets.';
