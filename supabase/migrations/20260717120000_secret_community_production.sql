-- Picom production Secret Community security boundary.
-- Forward-only. Raw phone numbers and raw invite credentials are never stored.

create extension if not exists pgcrypto with schema extensions;

alter table public.communities drop constraint if exists communities_visibility_check;
alter table public.communities add constraint communities_visibility_check
  check (visibility in ('public','private','secret'));

create or replace function public.enforce_secret_community_visibility()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.visibility='secret' then
    new.public_read_enabled:=false;
    new.discovery_listed:=false;
    new.discovery_join_policy:='request';
  end if;
  return new;
end $$;
drop trigger if exists enforce_secret_community_visibility on public.communities;
create trigger enforce_secret_community_visibility
before insert or update of visibility,public_read_enabled,discovery_listed,discovery_join_policy
on public.communities for each row execute function public.enforce_secret_community_visibility();
revoke all on function public.enforce_secret_community_visibility() from public,anon,authenticated;

create table if not exists public.account_security_verifications(
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone_hash text unique check(phone_hash is null or phone_hash~'^[a-f0-9]{64}$'),
  phone_last4 text check(phone_last4 is null or phone_last4~'^[0-9]{4}$'),
  country_calling_code text check(country_calling_code is null or country_calling_code~'^\\+[0-9]{1,4}$'),
  phone_verified_at timestamptz,
  voice_call_verified_at timestamptz,
  provider text not null default 'twilio_verify' check(provider='twilio_verify'),
  suspended_until timestamptz,
  community_creation_restricted_until timestamptz,
  restriction_reason text check(restriction_reason is null or char_length(restriction_reason)<=500),
  updated_at timestamptz not null default now()
);
create unique index if not exists account_security_phone_hash_unique
  on public.account_security_verifications(phone_hash) where phone_hash is not null;
alter table public.account_security_verifications enable row level security;
alter table public.account_security_verifications force row level security;
revoke all on public.account_security_verifications from public,anon,authenticated;
grant select(user_id,phone_last4,country_calling_code,phone_verified_at,voice_call_verified_at,suspended_until,community_creation_restricted_until,restriction_reason,updated_at)
  on public.account_security_verifications to authenticated;
drop policy if exists account_security_owner_select on public.account_security_verifications;
create policy account_security_owner_select on public.account_security_verifications
for select to authenticated using(user_id=auth.uid());

create table if not exists public.secret_verification_rate_limits(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bucket_hash text not null check(bucket_hash~'^[a-f0-9]{64}$'),
  action text not null check(action in('start_call','check_code')),
  window_started_at timestamptz not null,
  attempts integer not null default 1 check(attempts>0),
  updated_at timestamptz not null default now(),
  unique(user_id,bucket_hash,action,window_started_at)
);
alter table public.secret_verification_rate_limits enable row level security;
alter table public.secret_verification_rate_limits force row level security;
revoke all on public.secret_verification_rate_limits from public,anon,authenticated;

create or replace function public.consume_secret_verification_rate_limit(
  target_user_id uuid,target_bucket_hash text,target_action text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare
  current_window timestamptz:=date_trunc('minute',now())-((extract(minute from now())::integer%10)||' minutes')::interval;
  attempt_limit integer;
  next_attempts integer;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_action not in('start_call','check_code') or target_bucket_hash!~'^[a-f0-9]{64}$' then
    raise exception 'VERIFICATION_RATE_LIMIT_INPUT_INVALID' using errcode='22023';
  end if;
  attempt_limit:=case target_action when 'start_call' then 5 else 8 end;
  insert into public.secret_verification_rate_limits(user_id,bucket_hash,action,window_started_at)
  values(target_user_id,target_bucket_hash,target_action,current_window)
  on conflict(user_id,bucket_hash,action,window_started_at)
  do update set attempts=public.secret_verification_rate_limits.attempts+1,updated_at=now()
  returning attempts into next_attempts;
  delete from public.secret_verification_rate_limits where updated_at<now()-interval '24 hours';
  return next_attempts<=attempt_limit;
end $$;
revoke all on function public.consume_secret_verification_rate_limit(uuid,text,text) from public,anon,authenticated;
grant execute on function public.consume_secret_verification_rate_limit(uuid,text,text) to service_role;

create or replace function public.record_secret_phone_voice_verification(
  target_user_id uuid,target_phone_hash text,target_phone_last4 text,target_country_calling_code text
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_phone_hash!~'^[a-f0-9]{64}$' or target_phone_last4!~'^[0-9]{4}$' then
    raise exception 'PHONE_VERIFICATION_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if exists(select 1 from public.account_security_verifications v where v.phone_hash=target_phone_hash and v.user_id<>target_user_id) then
    raise exception 'PHONE_ALREADY_IN_USE' using errcode='23505';
  end if;
  insert into public.account_security_verifications(
    user_id,phone_hash,phone_last4,country_calling_code,phone_verified_at,voice_call_verified_at,provider,updated_at
  ) values(target_user_id,target_phone_hash,target_phone_last4,target_country_calling_code,now(),now(),'twilio_verify',now())
  on conflict(user_id) do update set phone_hash=excluded.phone_hash,phone_last4=excluded.phone_last4,
    country_calling_code=excluded.country_calling_code,phone_verified_at=excluded.phone_verified_at,
    voice_call_verified_at=excluded.voice_call_verified_at,provider='twilio_verify',updated_at=now();
  return true;
end $$;
revoke all on function public.record_secret_phone_voice_verification(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_secret_phone_voice_verification(uuid,text,text,text) to service_role;

create or replace function public.get_secret_community_creation_eligibility()
returns table(
  eligible boolean,phone_verified boolean,voice_call_verified boolean,account_suspended boolean,
  creation_restricted boolean,phone_last4 text,reason text
) language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and v.phone_verified_at is not null and v.voice_call_verified_at is not null
      and coalesce(v.suspended_until<=now(),true) and coalesce(v.community_creation_restricted_until<=now(),true),
    v.phone_verified_at is not null,v.voice_call_verified_at is not null,
    coalesce(v.suspended_until>now(),false),coalesce(v.community_creation_restricted_until>now(),false),v.phone_last4,
    case when auth.uid() is null then 'AUTH_REQUIRED'
      when v.user_id is null or v.phone_verified_at is null then 'PHONE_VERIFICATION_REQUIRED'
      when v.voice_call_verified_at is null then 'VOICE_CALL_VERIFICATION_REQUIRED'
      when v.suspended_until>now() then 'ACCOUNT_SUSPENDED'
      when v.community_creation_restricted_until>now() then 'COMMUNITY_CREATION_RESTRICTED'
      else null end
  from (select auth.uid() user_id) caller
  left join public.account_security_verifications v on v.user_id=caller.user_id
$$;
revoke all on function public.get_secret_community_creation_eligibility() from public,anon;
grant execute on function public.get_secret_community_creation_eligibility() to authenticated;

create table if not exists public.secret_community_metadata(
  community_id uuid primary key references public.communities(id) on delete cascade,
  warning_version text not null default 'secret-v1' check(char_length(warning_version) between 1 and 40),
  invite_policy_version text not null default 'recipient-v1' check(char_length(invite_policy_version) between 1 and 40),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.secret_community_trust_profiles(
  community_id uuid primary key references public.communities(id) on delete cascade,
  score smallint not null default 80 check(score between 0 and 100),
  risk_level text not null default 'low' check(risk_level in('low','guarded','elevated','critical')),
  recommendation text not null default 'Continue normal monitoring.' check(char_length(recommendation)<=500),
  incident_count integer not null default 0 check(incident_count>=0),
  last_evaluated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.secret_community_trust_history(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  previous_score smallint not null check(previous_score between 0 and 100),
  next_score smallint not null check(next_score between 0 and 100),
  reason text not null check(char_length(reason) between 1 and 500),
  actor_id uuid references public.profiles(id) on delete set null,
  source text not null check(source in('system','root_adjustment','security_event')),
  created_at timestamptz not null default now()
);
create table if not exists public.secret_community_security_events(
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  affected_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null check(severity in('info','low','medium','high','critical')),
  reason text not null check(char_length(reason) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create index if not exists secret_security_events_community_created_idx
  on public.secret_community_security_events(community_id,created_at desc);

create table if not exists public.secret_community_invites(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  credential_hash text not null unique check(credential_hash~'^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  max_uses smallint not null default 5 check(max_uses=5),
  uses smallint not null default 0 check(uses between 0 and 5),
  accepted_at timestamptz,
  revoked_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  check(expires_at=created_at+interval '1 hour'),
  check(uses<=max_uses)
);
create index if not exists secret_invites_recipient_active_idx
  on public.secret_community_invites(recipient_user_id,expires_at desc) where revoked_at is null;
create index if not exists secret_invites_community_created_idx
  on public.secret_community_invites(community_id,created_at desc);

create table if not exists public.secret_community_invite_usage(
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.secret_community_invites(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check(event_type in('accepted','revoked','left','rejected')),
  reason text not null check(char_length(reason) between 1 and 300),
  created_at timestamptz not null default now()
);
create table if not exists public.secret_community_acceptances(
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.secret_community_invites(id) on delete restrict,
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  warning_version text not null,
  rules_version text not null,
  accepted_warnings_at timestamptz not null,
  accepted_rules_at timestamptz not null,
  joined_at timestamptz not null default now(),
  unique(invite_id,user_id)
);

create or replace function public.reject_immutable_secret_audit_change()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin raise exception 'IMMUTABLE_SECRET_AUDIT_LOG' using errcode='42501'; end $$;
revoke all on function public.reject_immutable_secret_audit_change() from public,anon,authenticated;

do $$ declare table_name text; begin
  foreach table_name in array array[
    'secret_community_metadata','secret_community_trust_profiles','secret_community_trust_history',
    'secret_community_security_events','secret_community_invites','secret_community_invite_usage','secret_community_acceptances'
  ] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('alter table public.%I force row level security',table_name);
    execute format('revoke all on public.%I from public,anon,authenticated',table_name);
    execute format('grant select on public.%I to authenticated',table_name);
  end loop;
  foreach table_name in array array[
    'secret_community_trust_history','secret_community_security_events','secret_community_invite_usage','secret_community_acceptances'
  ] loop
    execute format('drop trigger if exists immutable_secret_audit_change on public.%I',table_name);
    execute format('create trigger immutable_secret_audit_change before update or delete on public.%I for each row execute function public.reject_immutable_secret_audit_change()',table_name);
  end loop;
end $$;

drop policy if exists secret_metadata_member_select on public.secret_community_metadata;
create policy secret_metadata_member_select on public.secret_community_metadata for select to authenticated using(
  public.is_root_owner() or exists(select 1 from public.community_members m where m.community_id=secret_community_metadata.community_id and m.user_id=auth.uid())
);
drop policy if exists secret_trust_root_select on public.secret_community_trust_profiles;
create policy secret_trust_root_select on public.secret_community_trust_profiles for select to authenticated using(public.is_root_owner());
drop policy if exists secret_trust_history_root_select on public.secret_community_trust_history;
create policy secret_trust_history_root_select on public.secret_community_trust_history for select to authenticated using(public.is_root_owner());
drop policy if exists secret_security_events_root_select on public.secret_community_security_events;
create policy secret_security_events_root_select on public.secret_community_security_events for select to authenticated using(public.is_root_owner());
drop policy if exists secret_invites_root_select on public.secret_community_invites;
create policy secret_invites_root_select on public.secret_community_invites for select to authenticated using(public.is_root_owner());
drop policy if exists secret_invite_usage_root_select on public.secret_community_invite_usage;
create policy secret_invite_usage_root_select on public.secret_community_invite_usage for select to authenticated using(public.is_root_owner());
drop policy if exists secret_acceptances_root_select on public.secret_community_acceptances;
create policy secret_acceptances_root_select on public.secret_community_acceptances for select to authenticated using(public.is_root_owner());

create or replace function public.can_manage_secret_community(target_community_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists(
    select 1 from public.communities c where c.id=target_community_id and c.visibility='secret' and (
      c.owner_id=auth.uid() or exists(
        select 1 from public.community_members m join public.roles r on r.id=m.role_id
        where m.community_id=c.id and m.user_id=auth.uid()
          and (lower(r.name) in('owner','admin') or to_jsonb(r.permissions)?'manageCommunity' or to_jsonb(r.permissions)?'manage_community')
      )
    )
  )
$$;
create or replace function public.can_create_secret_community_invite(target_community_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists(
    select 1 from public.communities c where c.id=target_community_id and c.visibility='secret' and (
      c.owner_id=auth.uid() or exists(
        select 1 from public.community_members m join public.roles r on r.id=m.role_id
        where m.community_id=c.id and m.user_id=auth.uid()
          and (lower(r.name) in('owner','admin','moderator') or to_jsonb(r.permissions)?'createInvites' or to_jsonb(r.permissions)?'create_invites')
      ) or exists(
        select 1 from public.community_member_roles a join public.roles r on r.id=a.role_id
        join public.community_members m on m.id=a.member_id
        where a.community_id=c.id and m.user_id=auth.uid()
          and (to_jsonb(r.permissions)?'createInvites' or to_jsonb(r.permissions)?'create_invites')
      )
    )
  )
$$;
revoke all on function public.can_manage_secret_community(uuid),public.can_create_secret_community_invite(uuid) from public,anon;
grant execute on function public.can_manage_secret_community(uuid),public.can_create_secret_community_invite(uuid) to authenticated;

create or replace function public.record_secret_community_security_event(
  target_community_id uuid,target_event_type text,target_severity text,target_reason text,
  target_actor_id uuid default null,target_affected_user_id uuid default null,target_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare event_id uuid; prior_score smallint; next_score smallint; score_delta integer; next_risk text; next_recommendation text;
begin
  if target_severity not in('info','low','medium','high','critical') then raise exception 'SECRET_EVENT_SEVERITY_INVALID'; end if;
  insert into public.secret_community_security_events(community_id,actor_id,affected_user_id,event_type,severity,reason,metadata)
  values(target_community_id,target_actor_id,target_affected_user_id,left(target_event_type,120),target_severity,left(target_reason,500),coalesce(target_metadata,'{}'::jsonb))
  returning id into event_id;
  if target_community_id is null then return event_id; end if;
  insert into public.secret_community_trust_profiles(community_id) values(target_community_id) on conflict do nothing;
  select score into prior_score from public.secret_community_trust_profiles where community_id=target_community_id for update;
  score_delta:=case target_severity when 'critical' then -14 when 'high' then -8 when 'medium' then -4 when 'low' then -1 else 0 end;
  if target_event_type='invite_accepted' then score_delta:=greatest(score_delta,1); end if;
  next_score:=least(100,greatest(0,prior_score+score_delta));
  next_risk:=case when next_score<30 then 'critical' when next_score<55 then 'elevated' when next_score<75 then 'guarded' else 'low' end;
  next_recommendation:=case next_risk when 'critical' then 'Freeze new invitations and perform an immediate Root review.'
    when 'elevated' then 'Review recent invite, leave, and access-rejection activity.'
    when 'guarded' then 'Increase monitoring and verify administrator activity.' else 'Continue normal monitoring.' end;
  update public.secret_community_trust_profiles set score=next_score,risk_level=next_risk,recommendation=next_recommendation,
    incident_count=incident_count+case when target_severity in('high','critical') then 1 else 0 end,
    last_evaluated_at=now(),updated_at=now() where community_id=target_community_id;
  if next_score<>prior_score then
    insert into public.secret_community_trust_history(community_id,previous_score,next_score,reason,actor_id,source)
    values(target_community_id,prior_score,next_score,left(target_reason,500),target_actor_id,'security_event');
  end if;
  return event_id;
end $$;
revoke all on function public.record_secret_community_security_event(uuid,text,text,text,uuid,uuid,jsonb) from public,anon,authenticated;

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
  perform public.record_secret_community_security_event(created.id,'community_created','info','Secret community created after phone and voice-call verification.',auth.uid(),auth.uid(),jsonb_build_object('kind',target_kind));
  return next created;
end $$;
revoke all on function public.create_secret_community(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.create_secret_community(uuid,text,text,text,text,text,text) to authenticated;

create or replace function public.update_secret_community_settings(
  target_community_id uuid,next_name text,next_description text,next_icon_url text,next_banner_url text,
  next_visibility text,next_public_read_enabled boolean,next_default_notification_level text,
  next_rules_enabled boolean,next_rules_version text,next_type_settings jsonb,next_rules jsonb
) returns setof public.communities language plpgsql security definer set search_path=public,pg_temp as $$
declare updated public.communities%rowtype;
begin
  if not public.can_manage_secret_community(target_community_id) then raise exception 'COMMUNITY_SETTINGS_FORBIDDEN' using errcode='42501'; end if;
  if next_visibility is distinct from 'secret' then raise exception 'SECRET_VISIBILITY_IMMUTABLE' using errcode='22023'; end if;
  if char_length(btrim(coalesce(next_name,''))) not between 2 and 80 then raise exception 'COMMUNITY_NAME_INVALID' using errcode='22023'; end if;
  if next_default_notification_level not in('all','mentions','none') then raise exception 'COMMUNITY_NOTIFICATION_LEVEL_INVALID'; end if;
  update public.communities set name=btrim(next_name),description=nullif(btrim(coalesce(next_description,'')),''),
    icon_url=nullif(btrim(coalesce(next_icon_url,'')),''),banner_url=nullif(btrim(coalesce(next_banner_url,'')),''),
    visibility='secret',public_read_enabled=false,discovery_listed=false,discovery_join_policy='request',
    default_notification_level=next_default_notification_level,rules_enabled=true,
    rules_version=coalesce(nullif(btrim(next_rules_version),''),rules_version),
    type_settings=coalesce(next_type_settings,type_settings),updated_at=now()
  where id=target_community_id and visibility='secret' returning * into updated;
  if not found then raise exception 'SECRET_COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  if next_rules is not null then
    delete from public.community_rules where community_id=target_community_id;
    insert into public.community_rules(community_id,title,body,position,required,published)
    select target_community_id,left(btrim(r.title),120),left(btrim(r.body),2000),coalesce(r.position,0),coalesce(r.required,true),true
    from jsonb_to_recordset(next_rules) as r(title text,body text,position integer,required boolean)
    where btrim(coalesce(r.title,''))<>'' and btrim(coalesce(r.body,''))<>'';
  end if;
  return next updated;
end $$;
revoke all on function public.update_secret_community_settings(uuid,text,text,text,text,text,boolean,text,boolean,text,jsonb,jsonb) from public,anon;
grant execute on function public.update_secret_community_settings(uuid,text,text,text,text,text,boolean,text,boolean,text,jsonb,jsonb) to authenticated;

create or replace function public.block_standard_invites_for_secret_communities()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.communities c where c.id=new.community_id and c.visibility='secret') then
    raise exception 'SECRET_INVITE_FLOW_REQUIRED' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists block_standard_invites_for_secret_communities on public.community_invites;
create trigger block_standard_invites_for_secret_communities before insert on public.community_invites
for each row execute function public.block_standard_invites_for_secret_communities();
revoke all on function public.block_standard_invites_for_secret_communities() from public,anon,authenticated;

create or replace function public.enforce_secret_membership_invite()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare target public.communities%rowtype;
begin
  select * into target from public.communities where id=new.community_id;
  if target.visibility='secret' and new.user_id<>target.owner_id
    and coalesce(current_setting('picom.secret_join_authorization',true),'')<>(new.community_id::text||':'||new.user_id::text) then
    raise exception 'SECRET_INVITE_REQUIRED' using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists enforce_secret_membership_invite on public.community_members;
create trigger enforce_secret_membership_invite before insert on public.community_members
for each row execute function public.enforce_secret_membership_invite();
revoke all on function public.enforce_secret_membership_invite() from public,anon,authenticated;

create or replace function public.create_secret_community_invite(target_community_id uuid,recipient_username text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  target public.communities%rowtype; recipient public.profiles%rowtype; invite public.secret_community_invites%rowtype;
  raw_credential text; created_time timestamptz:=now(); conversation_id uuid; invitation_link text;
begin
  if not public.can_create_secret_community_invite(target_community_id) then raise exception 'SECRET_INVITE_FORBIDDEN' using errcode='42501'; end if;
  select * into target from public.communities where id=target_community_id and visibility='secret';
  if not found then raise exception 'SECRET_COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  select * into recipient from public.profiles where lower(username)=lower(btrim(recipient_username));
  if not found then raise exception 'SECRET_INVITE_RECIPIENT_NOT_FOUND' using errcode='P0002'; end if;
  if exists(select 1 from public.community_members m where m.community_id=target_community_id and m.user_id=recipient.id) then
    raise exception 'SECRET_INVITE_RECIPIENT_ALREADY_MEMBER' using errcode='23505';
  end if;
  update public.secret_community_invites set revoked_at=coalesce(revoked_at,now())
  where community_id=target_community_id and recipient_user_id=recipient.id and revoked_at is null;
  raw_credential:=encode(extensions.gen_random_bytes(32),'hex');
  insert into public.secret_community_invites(
    community_id,recipient_user_id,created_by,credential_hash,created_at,expires_at,max_uses
  ) values(target_community_id,recipient.id,auth.uid(),encode(extensions.digest(raw_credential,'sha256'),'hex'),
    created_time,created_time+interval '1 hour',5) returning * into invite;
  -- Automatic delivery persists only the recipient-bound invite UUID. The raw
  -- credential is returned once to the creator and is never written to a table.
  invitation_link:='picom://invite/'||invite.id::text;
  insert into public.notifications(recipient_id,actor_id,category,title,preview,context_kind,context_label,community_id,user_id,source_event_id)
  values(recipient.id,auth.uid(),'system','Private community invitation',
    left('You have a one-hour invitation to '||target.name||'. Open the private link delivered to you.',500),
    'community',target.name,target.id,auth.uid(),'secret-community-invite:'||invite.id::text)
  on conflict(recipient_id,source_event_id) where source_event_id is not null do nothing;
  begin
    conversation_id:=public.create_direct_conversation(recipient.id);
    insert into public.direct_messages(conversation_id,author_id,body,client_message_id)
    values(conversation_id,auth.uid(),'Private invitation to '||target.name||E'\n'||invitation_link||E'\nExpires in 1 hour and is bound to your account.','secret-invite-'||invite.id::text);
  exception when others then
    perform public.record_secret_community_security_event(target.id,'invite_dm_delivery_deferred','low','Direct-message delivery was unavailable; notification and email remain active.',auth.uid(),recipient.id,jsonb_build_object('inviteId',invite.id));
  end;
  begin
    perform public.enqueue_email_for_user_event(
      recipient.id,'community_invitation','community_updates',
      jsonb_build_object('community_name',target.name,'inviter_name',(select display_name from public.profiles where id=auth.uid()),'invite_url',invitation_link,'expires_in','1 hour'),
      'secret-community-invite:'||invite.id::text,invite.id::text,40,'secret_community_invite',invite.id::text);
  exception when others then
    perform public.record_secret_community_security_event(target.id,'invite_email_delivery_deferred','low','Email delivery could not be queued; in-app delivery remains active.',auth.uid(),recipient.id,jsonb_build_object('inviteId',invite.id));
  end;
  perform public.record_secret_community_security_event(target.id,'invite_created','info','Recipient-bound secret invitation created.',auth.uid(),recipient.id,jsonb_build_object('inviteId',invite.id,'expiresAt',invite.expires_at));
  return jsonb_build_object('id',invite.id,'communityId',invite.community_id,'recipientUserId',recipient.id,
    'recipientUsername',recipient.username,'code',raw_credential,'expiresAt',invite.expires_at,
    'maxUses',invite.max_uses,'uses',invite.uses,'createdAt',invite.created_at);
end $$;
revoke all on function public.create_secret_community_invite(uuid,text) from public,anon;
grant execute on function public.create_secret_community_invite(uuid,text) to authenticated;

create or replace function public.list_secret_community_invites(target_community_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  select case when public.can_create_secret_community_invite(target_community_id) then coalesce(jsonb_agg(jsonb_build_object(
    'id',i.id,'recipientUserId',i.recipient_user_id,'recipientUsername',p.username,'recipientName',p.display_name,
    'expiresAt',i.expires_at,'maxUses',i.max_uses,'uses',i.uses,'acceptedAt',i.accepted_at,'revokedAt',i.revoked_at,
    'leftAt',i.left_at,'createdAt',i.created_at) order by i.created_at desc),'[]'::jsonb) else '[]'::jsonb end
  from public.secret_community_invites i join public.profiles p on p.id=i.recipient_user_id
  where i.community_id=target_community_id
$$;
revoke all on function public.list_secret_community_invites(uuid) from public,anon;
grant execute on function public.list_secret_community_invites(uuid) to authenticated;

create or replace function public.revoke_secret_community_invite(target_invite_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare invite public.secret_community_invites%rowtype;
begin
  select * into invite from public.secret_community_invites where id=target_invite_id for update;
  if not found or not public.can_create_secret_community_invite(invite.community_id) then raise exception 'SECRET_INVITE_FORBIDDEN' using errcode='42501'; end if;
  update public.secret_community_invites set revoked_at=coalesce(revoked_at,now()) where id=invite.id;
  insert into public.secret_community_invite_usage(invite_id,community_id,user_id,event_type,reason)
  values(invite.id,invite.community_id,invite.recipient_user_id,'revoked','Invitation revoked by an authorized manager.');
  perform public.record_secret_community_security_event(invite.community_id,'invite_revoked','info','Secret invitation revoked by an authorized manager.',auth.uid(),invite.recipient_user_id,jsonb_build_object('inviteId',invite.id));
  return true;
end $$;
revoke all on function public.revoke_secret_community_invite(uuid) from public,anon;
grant execute on function public.revoke_secret_community_invite(uuid) to authenticated;

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
  else
    return jsonb_build_object('ok',false,'code','SECRET_INVITE_INVALID');
  end if;
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
      'phoneVerified',security.phone_verified_at is not null,'voiceCallVerified',security.voice_call_verified_at is not null,
      'accountSuspended',coalesce(security.suspended_until>now(),false),
      'accountRestricted',coalesce(security.community_creation_restricted_until>now(),false)));
end $$;
revoke all on function public.preview_secret_community_invite(text) from public,anon;
grant execute on function public.preview_secret_community_invite(text) to authenticated;

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
  else
    return jsonb_build_object('ok',false,'code','SECRET_INVITE_INVALID');
  end if;
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
  if security.voice_call_verified_at is null then return jsonb_build_object('ok',false,'code','VOICE_CALL_VERIFICATION_REQUIRED'); end if;
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
  values(invite.id,community.id,auth.uid(),'accepted','Recipient completed verification, warnings, and rules acceptance.');
  perform public.record_secret_community_security_event(community.id,'invite_accepted','info','Recipient-bound invitation accepted successfully.',auth.uid(),auth.uid(),jsonb_build_object('inviteId',invite.id));
  return jsonb_build_object('ok',true,'status','joined','communityId',community.id,
    'member',jsonb_build_object('id',membership.id,'communityId',membership.community_id,'userId',membership.user_id,'roleId',membership.role_id,'joinedAt',membership.joined_at));
end $$;
revoke all on function public.accept_secret_community_invite(text,text,text,boolean,boolean) from public,anon;
grant execute on function public.accept_secret_community_invite(text,text,text,boolean,boolean) to authenticated;

create or replace function public.revoke_secret_invites_after_leave()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare invite record;
begin
  if exists(select 1 from public.communities c where c.id=old.community_id and c.visibility='secret') then
    for invite in update public.secret_community_invites set revoked_at=coalesce(revoked_at,now()),left_at=now()
      where community_id=old.community_id and recipient_user_id=old.user_id and left_at is null returning id
    loop
      insert into public.secret_community_invite_usage(invite_id,community_id,user_id,event_type,reason)
      values(invite.id,old.community_id,old.user_id,'left','Membership ended; all prior invitations were invalidated.');
    end loop;
    perform public.record_secret_community_security_event(old.community_id,'member_left','low','A member left; access and prior invitations were revoked immediately.',old.user_id,old.user_id,'{}'::jsonb);
  end if;
  return old;
end $$;
drop trigger if exists revoke_secret_invites_after_leave on public.community_members;
create trigger revoke_secret_invites_after_leave after delete on public.community_members
for each row execute function public.revoke_secret_invites_after_leave();
revoke all on function public.revoke_secret_invites_after_leave() from public,anon,authenticated;

create or replace function public.is_secret_community(target_community_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.communities c where c.id=target_community_id and c.visibility='secret')
$$;
revoke all on function public.is_secret_community(uuid) from public,anon;
grant execute on function public.is_secret_community(uuid) to authenticated;

create or replace function public.can_view_content_mention(target public.content_mentions)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and not public.is_secret_community(target.community_id)
    and not public.users_are_blocked(auth.uid(),target.author_id)
    and case target.source_type
      when 'text_message' then public.can_view_message(target.source_id)
      when 'radio_chat' then public.can_view_message(target.source_id)
      when 'radio_session' then public.can_view_radio_session(target.source_id)
      when 'podcast_episode' then public.can_view_podcast_episode(target.source_id)
      when 'podcast_comment' then exists(
        select 1 from public.podcast_episode_comments c where c.id=target.source_id and c.deleted_at is null and public.can_view_podcast_episode(c.episode_id))
      else false end
$$;

do $$
begin
  if to_regprocedure('public.search_accessible_entities_pre_secret(text,text,integer)') is null
    and to_regprocedure('public.search_accessible_entities(text,text,integer)') is not null then
    alter function public.search_accessible_entities(text,text,integer) rename to search_accessible_entities_pre_secret;
  end if;
  if to_regprocedure('public.list_mention_feed_pre_secret(timestamptz,uuid,integer)') is null
    and to_regprocedure('public.list_mention_feed(timestamptz,uuid,integer)') is not null then
    alter function public.list_mention_feed(timestamptz,uuid,integer) rename to list_mention_feed_pre_secret;
  end if;
  if to_regprocedure('public.list_visible_profile_activity_pre_secret(uuid,integer)') is null
    and to_regprocedure('public.list_visible_profile_activity(uuid,integer)') is not null then
    alter function public.list_visible_profile_activity(uuid,integer) rename to list_visible_profile_activity_pre_secret;
  end if;
end $$;

revoke all on function public.search_accessible_entities_pre_secret(text,text,integer),
  public.list_mention_feed_pre_secret(timestamptz,uuid,integer),
  public.list_visible_profile_activity_pre_secret(uuid,integer) from public,anon,authenticated;

create or replace function public.search_accessible_entities(query_text text,category_filter text default null,result_limit integer default 40)
returns table(result_type text,entity_id uuid,label text,detail text,community_id uuid,channel_id uuid,message_id uuid,user_id uuid,created_at timestamptz,rank real)
language sql stable security definer set search_path=public,pg_temp as $$
  select r.result_type,r.entity_id,r.label,r.detail,r.community_id,r.channel_id,r.message_id,r.user_id,r.created_at,r.rank
  from public.search_accessible_entities_pre_secret(query_text,category_filter,result_limit) r
  where r.community_id is null or not public.is_secret_community(r.community_id)
$$;
revoke all on function public.search_accessible_entities(text,text,integer) from public,anon;
grant execute on function public.search_accessible_entities(text,text,integer) to authenticated;

create or replace function public.list_mention_feed(
  cursor_created_at timestamptz default null,cursor_message_id uuid default null,result_limit integer default 40
) returns table(
  message_id uuid,community_id uuid,channel_id uuid,author_id uuid,mentioned_user_ids uuid[],
  body text,title text,created_at timestamptz,source text,attachments jsonb,reactions jsonb,
  view_count bigint,comment_count bigint,commenter_ids uuid[],popularity_score numeric,is_saved boolean,
  comment_preview jsonb,is_unread boolean
) language sql stable security definer set search_path=public,pg_temp as $$
  select r.* from public.list_mention_feed_pre_secret(cursor_created_at,cursor_message_id,result_limit) r
  where not public.is_secret_community(r.community_id)
$$;
revoke all on public.mention_feed_view from public,anon,authenticated;
revoke all on function public.list_mention_feed(timestamptz,uuid,integer) from public,anon;
grant execute on function public.list_mention_feed(timestamptz,uuid,integer) to authenticated;

create or replace function public.list_visible_profile_activity(target_user_id uuid,result_limit integer default 30)
returns table(message_id uuid,community_id uuid,channel_id uuid,preview text,created_at timestamptz)
language sql stable security definer set search_path=public,pg_temp as $$
  select r.* from public.list_visible_profile_activity_pre_secret(target_user_id,result_limit) r
  where not public.is_secret_community(r.community_id)
$$;
revoke all on function public.list_visible_profile_activity(uuid,integer) from public,anon;
grant execute on function public.list_visible_profile_activity(uuid,integer) to authenticated;

create or replace function public.list_root_secret_communities(result_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare payload jsonb;
begin
  if not public.is_root_owner() then raise exception 'ROOT_OWNER_REQUIRED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(item order by item->>'createdAt' desc),'[]'::jsonb) into payload from(
    select jsonb_build_object('id',c.id,'name',c.name,'kind',c.kind,'ownerId',c.owner_id,'ownerName',p.display_name,
      'memberCount',(select count(*) from public.community_members m where m.community_id=c.id),
      'activeInviteCount',(select count(*) from public.secret_community_invites i where i.community_id=c.id and i.revoked_at is null and i.expires_at>now()),
      'trustScore',t.score,'riskLevel',t.risk_level,'incidentCount',t.incident_count,
      'recommendation',t.recommendation,'createdAt',c.created_at) item
    from public.communities c join public.profiles p on p.id=c.owner_id
    left join public.secret_community_trust_profiles t on t.community_id=c.id
    where c.visibility='secret' order by c.created_at desc limit least(greatest(result_limit,1),250)
  ) rows;
  return payload;
end $$;

create or replace function public.get_root_secret_community_detail(target_community_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare payload jsonb;
begin
  if not public.is_root_owner() then raise exception 'ROOT_OWNER_REQUIRED' using errcode='42501'; end if;
  select jsonb_build_object(
    'community',jsonb_build_object('id',c.id,'name',c.name,'kind',c.kind,'ownerId',c.owner_id,'createdAt',c.created_at),
    'trust',to_jsonb(t),
    'history',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from public.secret_community_trust_history h where h.community_id=c.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.secret_community_security_events e where e.community_id=c.id),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'recipientUserId',i.recipient_user_id,'createdBy',i.created_by,
      'expiresAt',i.expires_at,'uses',i.uses,'maxUses',i.max_uses,'acceptedAt',i.accepted_at,'revokedAt',i.revoked_at,
      'leftAt',i.left_at,'createdAt',i.created_at) order by i.created_at desc)
      from public.secret_community_invites i where i.community_id=c.id),'[]'::jsonb)
  ) into payload from public.communities c
  left join public.secret_community_trust_profiles t on t.community_id=c.id
  where c.id=target_community_id and c.visibility='secret';
  if payload is null then raise exception 'SECRET_COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  return payload;
end $$;

create or replace function public.adjust_root_secret_community_trust_score(
  target_community_id uuid,score_delta integer,adjustment_reason text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare prior smallint; next smallint; profile public.secret_community_trust_profiles%rowtype;
begin
  if not public.is_root_owner() then raise exception 'ROOT_OWNER_REQUIRED' using errcode='42501'; end if;
  if score_delta not between -25 and 25 or char_length(btrim(coalesce(adjustment_reason,''))) not between 8 and 500 then
    raise exception 'TRUST_ADJUSTMENT_INVALID' using errcode='22023';
  end if;
  select score into prior from public.secret_community_trust_profiles where community_id=target_community_id for update;
  if prior is null then raise exception 'SECRET_COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  next:=least(100,greatest(0,prior+score_delta));
  update public.secret_community_trust_profiles set score=next,
    risk_level=case when next<30 then 'critical' when next<55 then 'elevated' when next<75 then 'guarded' else 'low' end,
    recommendation=case when next<30 then 'Freeze new invitations and perform an immediate Root review.'
      when next<55 then 'Review recent invite and access activity.' when next<75 then 'Increase monitoring.' else 'Continue normal monitoring.' end,
    last_evaluated_at=now(),updated_at=now() where community_id=target_community_id returning * into profile;
  insert into public.secret_community_trust_history(community_id,previous_score,next_score,reason,actor_id,source)
  values(target_community_id,prior,next,left(btrim(adjustment_reason),500),auth.uid(),'root_adjustment');
  return to_jsonb(profile);
end $$;

revoke all on function public.list_root_secret_communities(integer),public.get_root_secret_community_detail(uuid),
  public.adjust_root_secret_community_trust_score(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.list_root_secret_communities(integer),public.get_root_secret_community_detail(uuid),
  public.adjust_root_secret_community_trust_score(uuid,integer,text) to authenticated;

do $$ declare source_table text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach source_table in array array['secret_community_invites','secret_community_security_events','secret_community_trust_profiles'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=source_table) then
        execute format('alter publication supabase_realtime add table public.%I',source_table);
      end if;
    end loop;
  end if;
end $$;

comment on table public.secret_community_invites is
  'Recipient-bound invitations. Only SHA-256 credential hashes are stored; raw credentials are returned once.';
comment on table public.account_security_verifications is
  'Server-owned phone and voice-call verification state. Raw phone numbers are never stored.';
comment on table public.secret_community_trust_profiles is
  'Root-only operational trust score. Never rendered to community members.';
