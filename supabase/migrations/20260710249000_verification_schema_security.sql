begin;
create table if not exists public.app_trust_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null default 'verification_reviewer' check (role in ('verification_reviewer', 'trust', 'safety')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create table if not exists public.profile_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('verified_user', 'picom_staff', 'verified_bot', 'creator_verified')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  reason text check (reason is null or char_length(reason) between 10 and 1000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.community_verifications (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'revoked')),
  type text not null default 'official_community' check (type = 'official_community'),
  reason text check (reason is null or char_length(reason) between 10 and 1000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.verification_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('profile', 'community')),
  target_id uuid not null,
  action text not null check (action in ('requested', 'approved', 'rejected', 'revoked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_profile_verifications_active
  on public.profile_verifications(user_id, type) where status in ('pending', 'approved');
create index if not exists idx_profile_verifications_review_queue
  on public.profile_verifications(status, requested_at desc);
create unique index if not exists idx_community_verifications_active
  on public.community_verifications(community_id, type) where status in ('pending', 'approved');
create index if not exists idx_community_verifications_review_queue
  on public.community_verifications(status, requested_at desc);
create index if not exists idx_verification_audit_target
  on public.verification_audit_logs(target_type, target_id, created_at desc);
alter table public.verification_badges drop constraint if exists verification_badges_badge_kind_check;
alter table public.verification_badges add constraint verification_badges_badge_kind_check
  check (badge_kind in ('profile_reviewed', 'community_official', 'role_managed', 'verified_user', 'official_community', 'picom_staff', 'verified_bot', 'creator_verified'));
create or replace function public.can_review_verifications()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.is_app_admin()
    or exists (
      select 1 from public.app_trust_roles trust_role
      where trust_role.user_id = auth.uid() and trust_role.revoked_at is null
    )
  );
$$;
create or replace function public.can_request_community_verification(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.communities community where community.id = target_community_id and community.owner_id = auth.uid())
    or exists (
      select 1
      from public.community_members membership
      join public.roles role on role.id = membership.role_id and role.community_id = membership.community_id
      where membership.community_id = target_community_id
        and membership.user_id = auth.uid()
        and (lower(role.name) = 'admin' or coalesce((role.permissions ->> 'manageCommunity')::boolean, false))
    )
  );
$$;
alter table public.app_trust_roles enable row level security;
alter table public.profile_verifications enable row level security;
alter table public.community_verifications enable row level security;
alter table public.verification_audit_logs enable row level security;
revoke all on public.app_trust_roles, public.profile_verifications, public.community_verifications, public.verification_audit_logs from public, anon, authenticated;
grant select (id, user_id, type, status, requested_at, reviewed_at, revoked_at, created_at)
  on public.profile_verifications to authenticated;
grant insert (user_id, type, reason) on public.profile_verifications to authenticated;
grant select (id, community_id, type, status, requested_at, reviewed_at, revoked_at, created_at)
  on public.community_verifications to authenticated;
grant insert (community_id, type, reason) on public.community_verifications to authenticated;
grant select on public.verification_audit_logs to authenticated;
create policy "profile_verifications_safe_select" on public.profile_verifications
for select to authenticated
using (
  (status = 'approved' and revoked_at is null)
  or user_id = auth.uid()
  or public.can_review_verifications()
);
create policy "profile_verifications_self_request" on public.profile_verifications
for insert to authenticated
with check (
  user_id = auth.uid()
  and type in ('verified_user', 'creator_verified')
  and status = 'pending'
  and reviewed_by is null and reviewed_at is null and revoked_at is null
);
create policy "community_verifications_safe_select" on public.community_verifications
for select to authenticated
using (
  (status = 'approved' and revoked_at is null)
  or public.can_request_community_verification(community_id)
  or public.can_review_verifications()
);
create policy "community_verifications_owner_admin_request" on public.community_verifications
for insert to authenticated
with check (
  public.can_request_community_verification(community_id)
  and type = 'official_community'
  and status = 'pending'
  and reviewed_by is null and reviewed_at is null and revoked_at is null
);
create policy "verification_audit_reviewer_select" on public.verification_audit_logs
for select to authenticated using (public.can_review_verifications());
create or replace function public.record_verification_request_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.verification_audit_logs(actor_id, target_type, target_id, action, metadata)
  values (
    auth.uid(),
    case when tg_table_name = 'profile_verifications' then 'profile' else 'community' end,
    coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(new) ->> 'community_id')::uuid),
    'requested',
    jsonb_build_object('request_id', new.id, 'type', new.type)
  );
  return new;
end;
$$;
drop trigger if exists profile_verification_request_audit on public.profile_verifications;
create trigger profile_verification_request_audit after insert on public.profile_verifications
for each row execute function public.record_verification_request_audit();
drop trigger if exists community_verification_request_audit on public.community_verifications;
create trigger community_verification_request_audit after insert on public.community_verifications
for each row execute function public.record_verification_request_audit();
create or replace function public.verification_badge_label(verification_type text)
returns text language sql immutable set search_path = public
as $$
  select case verification_type
    when 'verified_user' then 'Verified user'
    when 'official_community' then 'Official community'
    when 'picom_staff' then 'Picom staff'
    when 'verified_bot' then 'Verified bot'
    when 'creator_verified' then 'Verified creator'
    else 'Picom verification'
  end;
$$;
create or replace function public.review_profile_verification(target_request_id uuid, next_status text, review_reason text)
returns setof public.profile_verifications
language plpgsql
security definer
set search_path = public
as $$
declare request_record public.profile_verifications%rowtype;
begin
  if not public.can_review_verifications() then raise exception 'VERIFICATION_REVIEWER_REQUIRED' using errcode = '42501'; end if;
  if next_status not in ('approved', 'rejected', 'revoked') then raise exception 'VERIFICATION_STATUS_INVALID' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(review_reason, ''))) < 10 then raise exception 'VERIFICATION_REASON_REQUIRED' using errcode = '22023'; end if;
  select * into request_record from public.profile_verifications where id = target_request_id for update;
  if request_record.id is null then raise exception 'VERIFICATION_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if next_status in ('approved', 'rejected') and request_record.status <> 'pending' then raise exception 'VERIFICATION_REQUEST_NOT_PENDING' using errcode = '22023'; end if;
  if next_status = 'revoked' and request_record.status <> 'approved' then raise exception 'VERIFICATION_REQUEST_NOT_APPROVED' using errcode = '22023'; end if;

  update public.profile_verifications set status = next_status, reviewed_by = auth.uid(), reviewed_at = now(), revoked_at = case when next_status = 'revoked' then now() else null end where id = target_request_id returning * into request_record;
  if next_status = 'approved' and not exists (select 1 from public.verification_badges badge where badge.subject_type = 'user' and badge.subject_id = request_record.user_id and badge.badge_kind = request_record.type and badge.revoked_at is null) then
    insert into public.verification_badges(subject_type, subject_id, badge_kind, label, scope_note, granted_by)
    values ('user', request_record.user_id, request_record.type, public.verification_badge_label(request_record.type), 'Approved through Picom review. This is not an identity or endorsement guarantee.', auth.uid());
  elsif next_status = 'revoked' then
    update public.verification_badges set revoked_at = now(), revoked_by = auth.uid() where subject_type = 'user' and subject_id = request_record.user_id and badge_kind = request_record.type and revoked_at is null;
  end if;
  insert into public.verification_audit_logs(actor_id, target_type, target_id, action, metadata)
  values (auth.uid(), 'profile', request_record.user_id, next_status, jsonb_build_object('request_id', request_record.id, 'reason', public.redact_audit_reason(review_reason)));
  return next request_record;
end;
$$;
create or replace function public.review_community_verification(target_request_id uuid, next_status text, review_reason text)
returns setof public.community_verifications
language plpgsql
security definer
set search_path = public
as $$
declare request_record public.community_verifications%rowtype;
begin
  if not public.can_review_verifications() then raise exception 'VERIFICATION_REVIEWER_REQUIRED' using errcode = '42501'; end if;
  if next_status not in ('approved', 'rejected', 'revoked') then raise exception 'VERIFICATION_STATUS_INVALID' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(review_reason, ''))) < 10 then raise exception 'VERIFICATION_REASON_REQUIRED' using errcode = '22023'; end if;
  select * into request_record from public.community_verifications where id = target_request_id for update;
  if request_record.id is null then raise exception 'VERIFICATION_REQUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  if next_status in ('approved', 'rejected') and request_record.status <> 'pending' then raise exception 'VERIFICATION_REQUEST_NOT_PENDING' using errcode = '22023'; end if;
  if next_status = 'revoked' and request_record.status <> 'approved' then raise exception 'VERIFICATION_REQUEST_NOT_APPROVED' using errcode = '22023'; end if;

  update public.community_verifications set status = next_status, reviewed_by = auth.uid(), reviewed_at = now(), revoked_at = case when next_status = 'revoked' then now() else null end where id = target_request_id returning * into request_record;
  if next_status = 'approved' and not exists (select 1 from public.verification_badges badge where badge.subject_type = 'community' and badge.subject_id = request_record.community_id and badge.badge_kind = request_record.type and badge.revoked_at is null) then
    insert into public.verification_badges(subject_type, subject_id, badge_kind, label, scope_note, granted_by)
    values ('community', request_record.community_id, request_record.type, public.verification_badge_label(request_record.type), 'Approved through Picom review. This is not an identity or endorsement guarantee.', auth.uid());
  elsif next_status = 'revoked' then
    update public.verification_badges set revoked_at = now(), revoked_by = auth.uid() where subject_type = 'community' and subject_id = request_record.community_id and badge_kind = request_record.type and revoked_at is null;
  end if;
  insert into public.verification_audit_logs(actor_id, target_type, target_id, action, metadata)
  values (auth.uid(), 'community', request_record.community_id, next_status, jsonb_build_object('request_id', request_record.id, 'reason', public.redact_audit_reason(review_reason)));
  return next request_record;
end;
$$;
revoke all on function public.can_review_verifications(), public.can_request_community_verification(uuid), public.record_verification_request_audit(), public.verification_badge_label(text), public.review_profile_verification(uuid, text, text), public.review_community_verification(uuid, text, text) from public, anon;
grant execute on function public.can_review_verifications(), public.can_request_community_verification(uuid), public.review_profile_verification(uuid, text, text), public.review_community_verification(uuid, text, text) to authenticated;
comment on table public.profile_verifications is 'Verification workflow metadata only. Never store identity documents, secrets, or payment data in this table.';
comment on table public.community_verifications is 'Community verification workflow. Approval is controlled by Picom app-admin or trust reviewers.';
comment on table public.verification_audit_logs is 'Append-only verification decision trail; renderer clients have no insert, update, or delete grants.';
comment on table public.app_trust_roles is 'Operator-managed trust role assignments. Renderer clients cannot grant or revoke reviewer access.';
commit;
