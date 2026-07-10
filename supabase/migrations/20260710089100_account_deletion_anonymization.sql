alter table public.profiles
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.account_deletion_requests
  add column if not exists finalization_status text not null default 'pending'
    check (finalization_status in ('pending', 'profile_anonymized', 'auth_soft_delete_failed', 'completed'));

alter table public.account_security_events drop constraint if exists account_security_events_event_type_check;
alter table public.account_security_events add constraint account_security_events_event_type_check
  check (event_type in (
    'account_deletion_requested', 'account_deletion_canceled', 'account_sessions_revoked',
    'account_profile_anonymized', 'account_auth_soft_deleted'
  ));

create or replace function public.prepare_account_deletion_anonymization(target_request_id uuid)
returns table(target_user_id uuid, anonymized_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_request public.account_deletion_requests%rowtype;
  completed_time timestamptz := now();
begin
  select request.* into target_request
  from public.account_deletion_requests request
  where request.id = target_request_id
  for update;

  if target_request.id is null then raise exception 'DELETION_REQUEST_NOT_FOUND' using errcode = '22023'; end if;
  if target_request.status = 'reviewing' and target_request.finalization_status in ('profile_anonymized', 'auth_soft_delete_failed') then
    return query select target_request.user_id, coalesce(target_request.completed_at, completed_time);
    return;
  end if;
  if target_request.status <> 'requested' then raise exception 'DELETION_REQUEST_NOT_ACTIVE' using errcode = '23514'; end if;
  if target_request.anonymize_after is null or target_request.anonymize_after > completed_time then raise exception 'DELETION_GRACE_PERIOD_ACTIVE' using errcode = '23514'; end if;
  if target_request.session_revocation_status <> 'completed' then raise exception 'SESSION_REVOCATION_REQUIRED' using errcode = '23514'; end if;
  if exists (select 1 from public.communities community where community.owner_id = target_request.user_id) then raise exception 'OWNERSHIP_TRANSFER_REQUIRED' using errcode = '23514'; end if;

  delete from public.user_follows where follower_id = target_request.user_id or followed_id = target_request.user_id;
  delete from public.friend_requests where sender_id = target_request.user_id or recipient_id = target_request.user_id;
  delete from public.friendships where user_low_id = target_request.user_id or user_high_id = target_request.user_id;
  delete from public.saved_messages where user_id = target_request.user_id;
  delete from public.direct_conversation_members where user_id = target_request.user_id;
  delete from public.community_members where user_id = target_request.user_id;

  update public.profiles
  set username = 'deleted-' || substr(replace(target_request.user_id::text, '-', ''), 1, 12),
      display_name = 'Deleted User', avatar_url = null, status = 'offline', status_text = 'Account deleted',
      bio = null, accent_color = null, onboarding_completed = false, is_deleted = true,
      deleted_at = completed_time, updated_at = completed_time
  where id = target_request.user_id;

  update public.account_deletion_requests
  set status = 'reviewing', finalization_status = 'profile_anonymized', completed_at = completed_time
  where id = target_request.id;

  insert into public.account_security_events(user_id, event_type, request_id, metadata)
  values (target_request.user_id, 'account_profile_anonymized', target_request.id, jsonb_build_object('stage', 'profile_anonymized'));

  return query select target_request.user_id, completed_time;
end;
$$;

revoke all on function public.prepare_account_deletion_anonymization(uuid) from public, anon, authenticated;
grant execute on function public.prepare_account_deletion_anonymization(uuid) to service_role;

comment on function public.prepare_account_deletion_anonymization(uuid) is
  'Internal idempotent anonymization stage. Requires due grace period, completed session revocation, and no owned communities. Never hard-deletes messages or audit/security events.';
