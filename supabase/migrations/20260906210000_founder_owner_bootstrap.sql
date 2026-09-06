-- Explicit operator request: grant founder root and a scoped profile badge.
-- Exact Auth subject only. No simulated JWT/session or email-only authorization.
begin;
do $$
declare
  owner_id constant uuid := '009bafb4-3a66-44ef-bf3b-db5cdf70f5cb';
  badge_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('picom-founder-owner-bootstrap'));
  if not exists(select 1 from auth.users where id=owner_id and lower(email)='f.tayboga@gmail.com' and email_confirmed_at is not null)
    then raise exception 'OWNER_IDENTITY_MISMATCH'; end if;
  if not exists(select 1 from auth.mfa_factors where user_id=owner_id and status='verified')
    or not exists(select 1 from auth.sessions where user_id=owner_id and aal='aal2')
    then raise exception 'REAL_MFA_REQUIRED'; end if;
  if position('MFA_REQUIRED' in pg_get_functiondef('public.confirm_privileged_step_up(uuid)'::regprocedure))=0
    or position('MFA_REQUIRED' in pg_get_functiondef('public.require_or_consume_step_up(text,uuid)'::regprocedure))=0
    then raise exception 'ROOT_HARDENING_REQUIRED'; end if;
  if exists(select 1 from public.root_owners where user_id<>owner_id and revoked_at is null)
    then raise exception 'EXISTING_ROOT_REVIEW_REQUIRED'; end if;
  if exists(select 1 from public.root_owners where user_id=owner_id)
    or exists(select 1 from public.app_admins where user_id=owner_id)
    or exists(select 1 from public.platform_role_assignments where user_id=owner_id and role_key='root_owner')
    then raise exception 'EXISTING_ASSIGNMENT_REVIEW_REQUIRED'; end if;

  insert into public.root_owners(user_id,activated_by) values(owner_id,owner_id);
  insert into public.app_admins(user_id,granted_by) values(owner_id,owner_id);
  insert into public.platform_role_assignments(user_id,role_key,granted_by) values(owner_id,'root_owner',owner_id);
  insert into public.verification_badges(subject_type,subject_id,badge_kind,label,scope_note,granted_by)
    values('user',owner_id,'profile_reviewed','PICOM Kurucusu',
      'PICOM kurucu hesabı. Hesap sahipliği ve MFA doğrulandı; hukuki kimlik veya güvenlik garantisi değildir.',owner_id)
    returning id into badge_id;
  insert into public.verification_badge_audit(badge_id,actor_id,action,subject_type,subject_id,badge_kind,reason)
    values(badge_id,owner_id,'grant','user',owner_id,'profile_reviewed','Explicit founder operator request; exact Auth subject, confirmed email and verified MFA checked. Operational bootstrap, not a third-party identity review.');
  insert into public.root_dashboard_audit(actor_id,action_type,target_type,target_id,reason,case_id,before_json,after_json,result)
    values(owner_id,'founder_owner_bootstrap','user',owner_id::text,
      'Explicit operator approval in current task; executed by deployment administrator, not by impersonating a user session.',
      'PICOM-FOUNDER-20260906','{"root_owner":false}'::jsonb,
      jsonb_build_object('root_owner',true,'badge_id',badge_id,'verified_mfa',true),'ok');
end;
$$;
commit;
