begin;

alter table public.account_security_verifications drop constraint if exists account_security_verifications_provider_check;
update public.account_security_verifications set provider='legacy_twilio_verify' where provider='twilio_verify';
alter table public.account_security_verifications alter column provider set default 'picom_self_hosted_voice_v1';
alter table public.account_security_verifications add constraint account_security_verifications_provider_check
  check(provider in('picom_self_hosted_voice_v1','legacy_twilio_verify'));

create table if not exists public.secret_phone_voice_challenges(
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
create index if not exists secret_phone_voice_challenges_user_created_idx on public.secret_phone_voice_challenges(user_id,created_at desc);
create index if not exists secret_phone_voice_challenges_expiry_idx on public.secret_phone_voice_challenges(expires_at) where status='pending';
alter table public.secret_phone_voice_challenges enable row level security;
alter table public.secret_phone_voice_challenges force row level security;
revoke all on public.secret_phone_voice_challenges from public,anon,authenticated;

create or replace function public.create_secret_phone_voice_challenge(
  target_request_id uuid,target_user_id uuid,target_phone_hash text,target_phone_last4 text,
  target_country_calling_code text,target_code_hash text,target_expires_at timestamptz
) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_request_id is null or target_user_id is null or target_phone_hash!~'^[a-f0-9]{64}$'
    or target_phone_last4!~'^[0-9]{4}$' or target_country_calling_code!~'^\+[0-9]{1,4}$'
    or target_code_hash!~'^[a-f0-9]{64}$' or target_expires_at<=now()+interval '1 minute'
    or target_expires_at>now()+interval '10 minutes' then
    raise exception 'PHONE_CHALLENGE_PAYLOAD_INVALID' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles where id=target_user_id) then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;
  update public.secret_phone_voice_challenges set status=case when expires_at<=now() then 'expired' else 'superseded' end,updated_at=now()
    where user_id=target_user_id and status='pending';
  insert into public.secret_phone_voice_challenges(request_id,user_id,phone_hash,phone_last4,country_calling_code,code_hash,expires_at)
    values(target_request_id,target_user_id,target_phone_hash,target_phone_last4,target_country_calling_code,target_code_hash,target_expires_at);
  delete from public.secret_phone_voice_challenges where created_at<now()-interval '24 hours' and status<>'approved';
  return true;
end $$;

create or replace function public.cancel_secret_phone_voice_challenge(target_request_id uuid,target_user_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  update public.secret_phone_voice_challenges set status='cancelled',updated_at=now()
    where request_id=target_request_id and user_id=target_user_id and status='pending';
  return found;
end $$;

create or replace function public.verify_secret_phone_voice_challenge(target_user_id uuid,target_phone_hash text,target_code_hash text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare challenge public.secret_phone_voice_challenges%rowtype; next_attempts smallint;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_user_id is null or target_phone_hash!~'^[a-f0-9]{64}$' or target_code_hash!~'^[a-f0-9]{64}$' then
    raise exception 'PHONE_CHALLENGE_PAYLOAD_INVALID' using errcode='22023';
  end if;
  select c.* into challenge from public.secret_phone_voice_challenges c
    where c.user_id=target_user_id and c.phone_hash=target_phone_hash and c.status='pending'
    order by c.created_at desc limit 1 for update;
  if not found then return 'not_found'; end if;
  if challenge.expires_at<=now() then
    update public.secret_phone_voice_challenges set status='expired',updated_at=now() where request_id=challenge.request_id;
    return 'expired';
  end if;
  if challenge.attempts>=8 then
    update public.secret_phone_voice_challenges set status='locked',updated_at=now() where request_id=challenge.request_id;
    return 'locked';
  end if;
  next_attempts:=challenge.attempts+1;
  if challenge.code_hash<>target_code_hash then
    update public.secret_phone_voice_challenges set attempts=next_attempts,
      status=case when next_attempts>=8 then 'locked' else 'pending' end,updated_at=now()
      where request_id=challenge.request_id;
    return case when next_attempts>=8 then 'locked' else 'invalid' end;
  end if;
  if exists(select 1 from public.account_security_verifications v where v.phone_hash=target_phone_hash and v.user_id<>target_user_id) then
    raise exception 'PHONE_ALREADY_IN_USE' using errcode='23505';
  end if;
  update public.secret_phone_voice_challenges set attempts=next_attempts,status='approved',approved_at=now(),updated_at=now()
    where request_id=challenge.request_id;
  insert into public.account_security_verifications(user_id,phone_hash,phone_last4,country_calling_code,phone_verified_at,voice_call_verified_at,provider,updated_at)
    values(target_user_id,target_phone_hash,challenge.phone_last4,challenge.country_calling_code,now(),now(),'picom_self_hosted_voice_v1',now())
  on conflict(user_id) do update set phone_hash=excluded.phone_hash,phone_last4=excluded.phone_last4,
    country_calling_code=excluded.country_calling_code,phone_verified_at=excluded.phone_verified_at,
    voice_call_verified_at=excluded.voice_call_verified_at,provider='picom_self_hosted_voice_v1',updated_at=now();
  return 'approved';
end $$;

create or replace function public.record_secret_phone_voice_verification(target_user_id uuid,target_phone_hash text,target_phone_last4 text,target_country_calling_code text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if target_phone_hash!~'^[a-f0-9]{64}$' or target_phone_last4!~'^[0-9]{4}$' then raise exception 'PHONE_VERIFICATION_PAYLOAD_INVALID' using errcode='22023'; end if;
  if exists(select 1 from public.account_security_verifications v where v.phone_hash=target_phone_hash and v.user_id<>target_user_id) then raise exception 'PHONE_ALREADY_IN_USE' using errcode='23505'; end if;
  insert into public.account_security_verifications(user_id,phone_hash,phone_last4,country_calling_code,phone_verified_at,voice_call_verified_at,provider,updated_at)
    values(target_user_id,target_phone_hash,target_phone_last4,target_country_calling_code,now(),now(),'picom_self_hosted_voice_v1',now())
  on conflict(user_id) do update set phone_hash=excluded.phone_hash,phone_last4=excluded.phone_last4,
    country_calling_code=excluded.country_calling_code,phone_verified_at=excluded.phone_verified_at,
    voice_call_verified_at=excluded.voice_call_verified_at,provider='picom_self_hosted_voice_v1',updated_at=now();
  return true;
end $$;

revoke all on function public.create_secret_phone_voice_challenge(uuid,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.cancel_secret_phone_voice_challenge(uuid,uuid) from public,anon,authenticated;
revoke all on function public.verify_secret_phone_voice_challenge(uuid,text,text) from public,anon,authenticated;
revoke all on function public.record_secret_phone_voice_verification(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_secret_phone_voice_challenge(uuid,uuid,text,text,text,text,timestamptz) to service_role;
grant execute on function public.cancel_secret_phone_voice_challenge(uuid,uuid) to service_role;
grant execute on function public.verify_secret_phone_voice_challenge(uuid,text,text) to service_role;
grant execute on function public.record_secret_phone_voice_verification(uuid,text,text,text) to service_role;
comment on table public.secret_phone_voice_challenges is 'Hash-only, short-lived Picom self-hosted voice verification challenges. Raw phone numbers and codes are never persisted.';
notify pgrst,'reload schema';
commit;