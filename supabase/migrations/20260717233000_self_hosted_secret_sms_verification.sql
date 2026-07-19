begin;

alter table public.account_security_verifications add column if not exists sms_verified_at timestamptz;
alter table public.account_security_verifications drop constraint if exists account_security_verifications_provider_check;
alter table public.account_security_verifications add constraint account_security_verifications_provider_check
  check(provider in('legacy_twilio_verify','picom_self_hosted_voice_v1','picom_self_hosted_sms_v1'));
grant select(sms_verified_at) on public.account_security_verifications to authenticated;

alter table public.secret_verification_rate_limits drop constraint if exists secret_verification_rate_limits_action_check;
alter table public.secret_verification_rate_limits add constraint secret_verification_rate_limits_action_check
  check(action in('start_call','start_sms','check_code'));

create or replace function public.consume_secret_verification_rate_limit(
  target_user_id uuid,target_bucket_hash text,target_action text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare
  current_window timestamptz:=date_trunc('minute',now())-((extract(minute from now())::integer%10)||' minutes')::interval;
  attempt_limit integer;
  next_attempts integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_action not in('start_call','start_sms','check_code') or target_bucket_hash!~'^[a-f0-9]{64}$' then
    raise exception 'VERIFICATION_RATE_LIMIT_INPUT_INVALID' using errcode='22023';
  end if;
  attempt_limit:=case target_action when 'check_code' then 8 else 5 end;
  insert into public.secret_verification_rate_limits(user_id,bucket_hash,action,window_started_at)
  values(target_user_id,target_bucket_hash,target_action,current_window)
  on conflict(user_id,bucket_hash,action,window_started_at) do update set attempts=public.secret_verification_rate_limits.attempts+1,updated_at=now()
  returning attempts into next_attempts;
  delete from public.secret_verification_rate_limits where updated_at<now()-interval '24 hours';
  return next_attempts<=attempt_limit;
end $$;
revoke all on function public.consume_secret_verification_rate_limit(uuid,text,text) from public,anon,authenticated;
grant execute on function public.consume_secret_verification_rate_limit(uuid,text,text) to service_role;

create table if not exists public.secret_phone_sms_challenges(
  request_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  phone_hash text not null check(phone_hash~'^[a-f0-9]{64}$'),
  phone_last4 text not null check(phone_last4~'^[0-9]{4}$'),
  country_calling_code text not null check(country_calling_code~'^\+[0-9]{1,4}$'),
  code_hash text not null check(code_hash~'^[a-f0-9]{64}$'),
  status text not null default 'pending' check(status in('pending','approved','expired','locked','cancelled','superseded')),
  attempts smallint not null default 0 check(attempts between 0 and 8),
  expires_at timestamptz not null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists secret_phone_sms_challenges_user_created_idx on public.secret_phone_sms_challenges(user_id,created_at desc);
create index if not exists secret_phone_sms_challenges_expiry_idx on public.secret_phone_sms_challenges(expires_at) where status='pending';
alter table public.secret_phone_sms_challenges enable row level security;
alter table public.secret_phone_sms_challenges force row level security;
revoke all on public.secret_phone_sms_challenges from public,anon,authenticated;

create or replace function public.create_secret_phone_sms_challenge(
  target_request_id uuid,target_user_id uuid,target_phone_hash text,target_phone_last4 text,
  target_country_calling_code text,target_code_hash text,target_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_request_id is null or target_user_id is null or target_phone_hash!~'^[a-f0-9]{64}$'
    or target_phone_last4!~'^[0-9]{4}$' or target_country_calling_code!~'^\+[0-9]{1,4}$'
    or target_code_hash!~'^[a-f0-9]{64}$' or target_expires_at<=now()+interval '1 minute'
    or target_expires_at>now()+interval '10 minutes' then
    raise exception 'PHONE_SMS_CHALLENGE_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;
  update public.secret_phone_sms_challenges set status=case when expires_at<=now() then 'expired' else 'superseded' end,updated_at=now()
    where user_id=target_user_id and status='pending';
  insert into public.secret_phone_sms_challenges(request_id,user_id,phone_hash,phone_last4,country_calling_code,code_hash,expires_at)
    values(target_request_id,target_user_id,target_phone_hash,target_phone_last4,target_country_calling_code,target_code_hash,target_expires_at);
  delete from public.secret_phone_sms_challenges where created_at<now()-interval '24 hours' and status<>'approved';
  return true;
end $$;

create or replace function public.cancel_secret_phone_sms_challenge(target_request_id uuid,target_user_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  update public.secret_phone_sms_challenges set status='cancelled',updated_at=now()
    where request_id=target_request_id and user_id=target_user_id and status='pending';
  return found;
end $$;

create or replace function public.verify_secret_phone_sms_challenge(target_user_id uuid,target_phone_hash text,target_code_hash text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare challenge public.secret_phone_sms_challenges%rowtype; next_attempts smallint;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_user_id is null or target_phone_hash!~'^[a-f0-9]{64}$' or target_code_hash!~'^[a-f0-9]{64}$' then
    raise exception 'PHONE_SMS_CHALLENGE_PAYLOAD_INVALID' using errcode='22023';
  end if;
  select c.* into challenge from public.secret_phone_sms_challenges c
    where c.user_id=target_user_id and c.phone_hash=target_phone_hash and c.status='pending'
    order by c.created_at desc limit 1 for update;
  if not found then return 'not_found'; end if;
  if challenge.expires_at<=now() then
    update public.secret_phone_sms_challenges set status='expired',updated_at=now() where request_id=challenge.request_id;
    return 'expired';
  end if;
  if challenge.attempts>=8 then
    update public.secret_phone_sms_challenges set status='locked',updated_at=now() where request_id=challenge.request_id;
    return 'locked';
  end if;
  next_attempts:=challenge.attempts+1;
  if challenge.code_hash<>target_code_hash then
    update public.secret_phone_sms_challenges set attempts=next_attempts,status=case when next_attempts>=8 then 'locked' else 'pending' end,updated_at=now()
      where request_id=challenge.request_id;
    return case when next_attempts>=8 then 'locked' else 'invalid' end;
  end if;
  if exists(select 1 from public.account_security_verifications v where v.phone_hash=target_phone_hash and v.user_id<>target_user_id) then
    raise exception 'PHONE_ALREADY_IN_USE' using errcode='23505';
  end if;
  update public.secret_phone_sms_challenges set attempts=next_attempts,status='approved',approved_at=now(),updated_at=now()
    where request_id=challenge.request_id;
  insert into public.account_security_verifications(user_id,phone_hash,phone_last4,country_calling_code,phone_verified_at,sms_verified_at,provider,updated_at)
    values(target_user_id,target_phone_hash,challenge.phone_last4,challenge.country_calling_code,now(),now(),'picom_self_hosted_sms_v1',now())
  on conflict(user_id) do update set phone_hash=excluded.phone_hash,phone_last4=excluded.phone_last4,
    country_calling_code=excluded.country_calling_code,phone_verified_at=excluded.phone_verified_at,
    sms_verified_at=excluded.sms_verified_at,provider='picom_self_hosted_sms_v1',updated_at=now();
  return 'approved';
end $$;

create or replace function public.get_secret_community_creation_eligibility()
returns table(
  eligible boolean,phone_verified boolean,voice_call_verified boolean,account_suspended boolean,
  creation_restricted boolean,phone_last4 text,reason text
) language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and v.phone_verified_at is not null and v.sms_verified_at is not null
      and coalesce(v.suspended_until<=now(),true) and coalesce(v.community_creation_restricted_until<=now(),true),
    v.phone_verified_at is not null,v.sms_verified_at is not null,
    coalesce(v.suspended_until>now(),false),coalesce(v.community_creation_restricted_until>now(),false),v.phone_last4,
    case when auth.uid() is null then 'AUTH_REQUIRED'
      when v.user_id is null or v.phone_verified_at is null then 'PHONE_VERIFICATION_REQUIRED'
      when v.sms_verified_at is null then 'SMS_VERIFICATION_REQUIRED'
      when v.suspended_until>now() then 'ACCOUNT_SUSPENDED'
      when v.community_creation_restricted_until>now() then 'COMMUNITY_CREATION_RESTRICTED'
      else null end
  from (select auth.uid() user_id) caller
  left join public.account_security_verifications v on v.user_id=caller.user_id
$$;

create or replace function public.create_secret_community(
  target_creation_request_id uuid,target_kind text,community_name text,community_description text default null,
  community_icon_url text default null,community_accent_color text default '#169c91',community_template_id text default 'custom'
) returns setof public.communities language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare eligibility record; created public.communities%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  select * into eligibility from public.get_secret_community_creation_eligibility();
  if not coalesce(eligibility.eligible,false) then raise exception '%',coalesce(eligibility.reason,'SECRET_COMMUNITY_CREATION_NOT_ALLOWED') using errcode='42501'; end if;
  if target_kind not in('text','radio','podcast') then raise exception 'COMMUNITY_KIND_INVALID' using errcode='22023'; end if;
  if target_kind='text' then
    select * into created from public.create_text_community_with_defaults(
      target_creation_request_id=>target_creation_request_id,community_name=>community_name,
      community_description=>community_description,community_icon_url=>community_icon_url,
      community_accent_color=>community_accent_color,community_visibility=>'private',
      community_public_read_enabled=>false,community_template_id=>community_template_id);
  elsif target_kind='radio' then
    select * into created from public.create_radio_community_with_defaults(
      target_creation_request_id=>target_creation_request_id,community_name=>community_name,
      community_description=>community_description,community_icon_url=>community_icon_url,
      community_accent_color=>community_accent_color,community_visibility=>'private',community_public_read_enabled=>false);
  else
    select * into created from public.create_podcast_community_with_defaults(
      target_creation_request_id=>target_creation_request_id,community_name=>community_name,
      community_description=>community_description,community_icon_url=>community_icon_url,
      community_accent_color=>community_accent_color,community_visibility=>'private',community_public_read_enabled=>false);
  end if;
  update public.communities set visibility='secret',public_read_enabled=false,discovery_listed=false,
    discovery_join_policy='request',rules_enabled=true,rules_version='secret-v1',updated_at=now()
  where id=created.id returning * into created;
  insert into public.secret_community_metadata(community_id,created_by) values(created.id,auth.uid()) on conflict do nothing;
  insert into public.secret_community_trust_profiles(community_id) values(created.id) on conflict do nothing;
  if not exists(select 1 from public.community_rules r where r.community_id=created.id and r.published) then
    insert into public.community_rules(community_id,title,body,position,required,published) values
      (created.id,'Confidentiality','Do not disclose membership, content, or invitation details outside this community.',0,true,true),
      (created.id,'Accountability','Access is personal. Never share invitation links, screenshots, or account credentials.',1,true,true),
      (created.id,'Safety','Report suspicious access attempts to the community team immediately.',2,true,true);
  end if;
  perform public.record_secret_community_security_event(created.id,'community_created','info','Secret community created after phone and SMS verification.',auth.uid(),auth.uid(),jsonb_build_object('kind',target_kind));
  return next created;
end $$;

create or replace function public.preview_secret_community_invite(raw_credential text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  invite public.secret_community_invites%rowtype; community public.communities%rowtype;
  metadata public.secret_community_metadata%rowtype; security public.account_security_verifications%rowtype;
  rules jsonb; member_count bigint;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  if raw_credential~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select * into invite from public.secret_community_invites where id=raw_credential::uuid;
  elsif raw_credential~'^[a-fA-F0-9]{64}$' then
    select * into invite from public.secret_community_invites
    where credential_hash=encode(extensions.digest(lower(raw_credential),'sha256'),'hex');
  else return jsonb_build_object('ok',false,'code','SECRET_INVITE_INVALID'); end if;
  if not found then return jsonb_build_object('ok',false,'code','SECRET_INVITE_INVALID'); end if;
  if invite.recipient_user_id<>auth.uid() then
    perform public.record_secret_community_security_event(invite.community_id,'invite_wrong_recipient','high','A recipient-bound invite was presented by another account.',auth.uid(),invite.recipient_user_id,jsonb_build_object('inviteId',invite.id));
    return jsonb_build_object('ok',false,'code','SECRET_INVITE_INVALID');
  end if;
  if invite.revoked_at is not null or invite.expires_at<=now() or invite.uses>=invite.max_uses then
    return jsonb_build_object('ok',false,'code',case when invite.expires_at<=now() then 'SECRET_INVITE_EXPIRED' else 'SECRET_INVITE_INVALID' end);
  end if;
  select * into community from public.communities where id=invite.community_id and visibility='secret';
  select * into metadata from public.secret_community_metadata where community_id=invite.community_id;
  select * into security from public.account_security_verifications where user_id=auth.uid();
  select count(*) into member_count from public.community_members where community_id=invite.community_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'body',r.body,'required',r.required,'position',r.position) order by r.position),'[]'::jsonb)
  into rules from public.community_rules r where r.community_id=invite.community_id and r.published;
  return jsonb_build_object(
    'ok',true,'communityId',community.id,'communityName',community.name,'communityKind',community.kind,
    'description',community.description,'visibility','secret','memberCount',member_count,'expiresAt',invite.expires_at,
    'warningVersion',metadata.warning_version,'rulesVersion',community.rules_version,'rulesEnabled',true,'rules',rules,
    'warnings',jsonb_build_array(
      'Membership, content, and invitation details are confidential.',
      'This invitation is personal, expires after one hour, and cannot be transferred.',
      'Leaving immediately removes access and invalidates this invitation.'),
    'verification',jsonb_build_object(
      'phoneVerified',security.phone_verified_at is not null,'smsVerified',security.sms_verified_at is not null,
      'voiceCallVerified',security.sms_verified_at is not null,
      'accountSuspended',coalesce(security.suspended_until>now(),false),
      'accountRestricted',coalesce(security.community_creation_restricted_until>now(),false)));
end $$;

create or replace function public.accept_secret_community_invite(
  raw_credential text,accepted_warning_version text,accepted_rules_version text,
  accepted_warnings boolean,accepted_rules boolean
) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  invite public.secret_community_invites%rowtype; community public.communities%rowtype;
  metadata public.secret_community_metadata%rowtype; security public.account_security_verifications%rowtype;
  member_role_id uuid; membership public.community_members%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'code','AUTH_REQUIRED'); end if;
  if raw_credential~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    select * into invite from public.secret_community_invites where id=raw_credential::uuid for update;
  elsif raw_credential~'^[a-fA-F0-9]{64}$' then
    select * into invite from public.secret_community_invites
    where credential_hash=encode(extensions.digest(lower(raw_credential),'sha256'),'hex') for update;
  else return jsonb_build_object('ok',false,'code','SECRET_INVITE_INVALID'); end if;
  if not found then return jsonb_build_object('ok',false,'code','SECRET_INVITE_INVALID'); end if;
  if invite.recipient_user_id<>auth.uid() then
    insert into public.secret_community_invite_usage(invite_id,community_id,user_id,event_type,reason)
    values(invite.id,invite.community_id,auth.uid(),'rejected','Recipient mismatch.');
    perform public.record_secret_community_security_event(invite.community_id,'invite_accept_wrong_recipient','critical','Another account attempted to accept a recipient-bound invite.',auth.uid(),invite.recipient_user_id,jsonb_build_object('inviteId',invite.id));
    return jsonb_build_object('ok',false,'code','SECRET_INVITE_INVALID');
  end if;
  if invite.revoked_at is not null or invite.expires_at<=now() or invite.uses>=invite.max_uses then
    return jsonb_build_object('ok',false,'code',case when invite.expires_at<=now() then 'SECRET_INVITE_EXPIRED' else 'SECRET_INVITE_INVALID' end);
  end if;
  select * into community from public.communities where id=invite.community_id and visibility='secret';
  select * into metadata from public.secret_community_metadata where community_id=invite.community_id;
  select * into security from public.account_security_verifications where user_id=auth.uid();
  if security.phone_verified_at is null then return jsonb_build_object('ok',false,'code','PHONE_VERIFICATION_REQUIRED'); end if;
  if security.sms_verified_at is null then return jsonb_build_object('ok',false,'code','SMS_VERIFICATION_REQUIRED'); end if;
  if security.suspended_until>now() then return jsonb_build_object('ok',false,'code','ACCOUNT_SUSPENDED'); end if;
  if security.community_creation_restricted_until>now() then return jsonb_build_object('ok',false,'code','ACCOUNT_RESTRICTED'); end if;
  if not accepted_warnings or accepted_warning_version is distinct from metadata.warning_version then
    return jsonb_build_object('ok',false,'code','SECRET_WARNING_ACCEPTANCE_REQUIRED');
  end if;
  if not accepted_rules or accepted_rules_version is distinct from community.rules_version then
    return jsonb_build_object('ok',false,'code','COMMUNITY_RULES_ACCEPTANCE_REQUIRED');
  end if;
  if exists(select 1 from public.community_members m where m.community_id=community.id and m.user_id=auth.uid()) then
    return jsonb_build_object('ok',true,'status','already_member','communityId',community.id);
  end if;
  select r.id into member_role_id from public.roles r where r.community_id=community.id and lower(r.name)='member'
  order by r.position asc limit 1;
  if member_role_id is null then raise exception 'DEFAULT_MEMBER_ROLE_MISSING'; end if;
  perform set_config('picom.secret_join_authorization',community.id::text||':'||auth.uid()::text,true);
  insert into public.community_members(community_id,user_id,role_id)
  values(community.id,auth.uid(),member_role_id) returning * into membership;
  update public.secret_community_invites set uses=uses+1,accepted_at=now(),revoked_at=now() where id=invite.id;
  insert into public.secret_community_acceptances(
    invite_id,community_id,user_id,warning_version,rules_version,accepted_warnings_at,accepted_rules_at
  ) values(invite.id,community.id,auth.uid(),accepted_warning_version,accepted_rules_version,now(),now());
  insert into public.secret_community_invite_usage(invite_id,community_id,user_id,event_type,reason)
  values(invite.id,community.id,auth.uid(),'accepted','Recipient completed SMS verification, warnings, and rules acceptance.');
  perform public.record_secret_community_security_event(community.id,'invite_accepted','info','Recipient-bound invitation accepted after SMS verification.',auth.uid(),auth.uid(),jsonb_build_object('inviteId',invite.id));
  return jsonb_build_object('ok',true,'status','joined','communityId',community.id,
    'member',jsonb_build_object('id',membership.id,'communityId',membership.community_id,'userId',membership.user_id,'roleId',membership.role_id,'joinedAt',membership.joined_at));
end $$;

update public.secret_phone_voice_challenges set status='cancelled',updated_at=now() where status='pending';
revoke execute on function public.create_secret_phone_voice_challenge(uuid,uuid,text,text,text,text,timestamptz) from service_role;
revoke execute on function public.cancel_secret_phone_voice_challenge(uuid,uuid) from service_role;
revoke execute on function public.verify_secret_phone_voice_challenge(uuid,text,text) from service_role;
revoke execute on function public.record_secret_phone_voice_verification(uuid,text,text,text) from service_role;

revoke all on function public.create_secret_phone_sms_challenge(uuid,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.cancel_secret_phone_sms_challenge(uuid,uuid) from public,anon,authenticated;
revoke all on function public.verify_secret_phone_sms_challenge(uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_secret_phone_sms_challenge(uuid,uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.cancel_secret_phone_sms_challenge(uuid,uuid) to service_role;
grant execute on function public.verify_secret_phone_sms_challenge(uuid,text,text) to service_role;
revoke all on function public.get_secret_community_creation_eligibility() from public,anon;
grant execute on function public.get_secret_community_creation_eligibility() to authenticated;
revoke all on function public.create_secret_community(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.create_secret_community(uuid,text,text,text,text,text,text) to authenticated;
revoke all on function public.preview_secret_community_invite(text) from public,anon;
grant execute on function public.preview_secret_community_invite(text) to authenticated;
revoke all on function public.accept_secret_community_invite(text,text,text,boolean,boolean) from public,anon;
grant execute on function public.accept_secret_community_invite(text,text,text,boolean,boolean) to authenticated;

comment on table public.secret_phone_sms_challenges is 'Hash-only, short-lived Picom self-hosted SMS verification challenges. Raw phone numbers and codes are never persisted.';
comment on column public.account_security_verifications.sms_verified_at is 'Timestamp of successful Picom self-hosted SMS OTP verification.';
comment on function public.get_secret_community_creation_eligibility() is 'The legacy voice_call_verified output column carries SMS verification readiness for wire compatibility.';
notify pgrst,'reload schema';
commit;