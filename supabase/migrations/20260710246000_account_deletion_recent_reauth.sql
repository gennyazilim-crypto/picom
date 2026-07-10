-- Task 329: account deletion requires a freshly issued authenticated JWT.
create or replace function public.request_current_user_account_deletion(confirmation_username text)
returns table(request_id uuid, requested_at timestamptz, anonymize_after timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_user_id uuid:=auth.uid(); profile_username text; existing_request public.account_deletion_requests%rowtype; created_request public.account_deletion_requests%rowtype; jwt_issued_at timestamptz;
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  begin jwt_issued_at:=to_timestamp((auth.jwt()->>'iat')::double precision); exception when others then jwt_issued_at:=null; end;
  if jwt_issued_at is null or jwt_issued_at<now()-interval '5 minutes' then raise exception 'REAUTH_REQUIRED' using errcode='42501'; end if;
  select p.username into profile_username from public.profiles p where p.id=current_user_id for update;
  if profile_username is null or lower(trim(profile_username))<>lower(trim(confirmation_username)) then raise exception 'CONFIRMATION_MISMATCH' using errcode='22023'; end if;
  if exists(select 1 from public.communities c where c.owner_id=current_user_id) then raise exception 'OWNERSHIP_TRANSFER_REQUIRED' using errcode='23514'; end if;
  select r.* into existing_request from public.account_deletion_requests r where r.user_id=current_user_id and r.status in ('requested','reviewing') order by r.requested_at desc limit 1;
  if existing_request.id is not null then return query select existing_request.id,existing_request.requested_at,existing_request.anonymize_after; return; end if;
  insert into public.account_deletion_requests(user_id,status,anonymize_after,session_revocation_status) values(current_user_id,'requested',now()+interval '14 days','pending') returning * into created_request;
  update public.profiles set deletion_requested_at=created_request.requested_at,updated_at=now() where profiles.id=current_user_id;
  insert into public.account_security_events(user_id,event_type,request_id,metadata) values(current_user_id,'account_deletion_requested',created_request.id,jsonb_build_object('anonymize_after',created_request.anonymize_after,'reauth_window_minutes',5));
  return query select created_request.id,created_request.requested_at,created_request.anonymize_after;
end; $$;
revoke all on function public.request_current_user_account_deletion(text) from public,anon;
grant execute on function public.request_current_user_account_deletion(text) to authenticated;
comment on function public.request_current_user_account_deletion(text) is 'Requires username confirmation, a JWT issued within five minutes, no owned communities, a 14-day grace period, and append-only content-free security audit.';
