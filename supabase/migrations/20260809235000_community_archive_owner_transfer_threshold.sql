-- Owners may recoverably archive communities with up to 1,000 members.
-- Larger communities require a deliberate ownership handoff so members retain a steward.
begin;

create or replace function public.get_community_archive_eligibility(target_community_id uuid)
returns table(member_count bigint, ownership_transfer_required boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_community public.communities%rowtype;
  current_member_count bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;

  select * into target_community
  from public.communities community
  where community.id = target_community_id;

  if target_community.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if target_community.owner_id <> auth.uid() then raise exception 'COMMUNITY_ARCHIVE_OWNER_REQUIRED' using errcode = '42501'; end if;
  if target_community.archived_at is not null then raise exception 'COMMUNITY_ALREADY_ARCHIVED' using errcode = '55000'; end if;

  select count(*) into current_member_count
  from public.community_members membership
  where membership.community_id = target_community_id;

  return query select current_member_count, current_member_count > 1000;
end;
$$;

create or replace function public.archive_community(
  target_community_id uuid,
  confirmation_community_name text,
  archive_reason text default null
)
returns table(community_id uuid, archived_at timestamptz, archived_by uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_community public.communities%rowtype;
  archive_time timestamptz := now();
  clean_reason text := public.redact_audit_reason(archive_reason);
  current_member_count bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if clean_reason is null or char_length(clean_reason) < 10 then raise exception 'COMMUNITY_ARCHIVE_REASON_REQUIRED' using errcode = '22023'; end if;

  select * into target_community
  from public.communities community
  where community.id = target_community_id
  for update;

  if target_community.id is null then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if target_community.owner_id <> auth.uid() then raise exception 'COMMUNITY_ARCHIVE_OWNER_REQUIRED' using errcode = '42501'; end if;
  if target_community.archived_at is not null then raise exception 'COMMUNITY_ALREADY_ARCHIVED' using errcode = '55000'; end if;
  if btrim(coalesce(confirmation_community_name, '')) <> target_community.name then raise exception 'COMMUNITY_ARCHIVE_CONFIRMATION_MISMATCH' using errcode = '22023'; end if;

  select count(*) into current_member_count
  from public.community_members membership
  where membership.community_id = target_community_id;

  if current_member_count > 1000 then
    raise exception 'COMMUNITY_OWNERSHIP_TRANSFER_REQUIRED' using errcode = '55000';
  end if;

  update public.communities
  set archived_at = archive_time,
      archived_by = auth.uid(),
      archive_reason = clean_reason,
      visibility = 'private',
      public_read_enabled = false,
      discovery_listed = false,
      updated_at = archive_time
  where communities.id = target_community_id;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(target_community_id, auth.uid(), 'community_update', 'community_archive', target_community_id, clean_reason);

  return query select target_community_id, archive_time, auth.uid();
end;
$$;

revoke all on function public.get_community_archive_eligibility(uuid) from public, anon;
grant execute on function public.get_community_archive_eligibility(uuid) to authenticated;

comment on function public.get_community_archive_eligibility(uuid) is
  'Owner-only read of the exact member count used by archive_community. More than 1,000 members require ownership transfer.';
comment on function public.archive_community(uuid, text, text) is
  'Owner-only recoverable archive with typed confirmation and audit evidence. More than 1,000 current members require ownership transfer.';

commit;
