begin;
-- No identity-document upload, public evidence bucket, or paid verification is part of this MVP.

alter table public.profile_verifications
  add column if not exists category text not null default 'individual',
  add column if not exists official_links text[] not null default '{}',
  add column if not exists supporting_text text,
  add column if not exists decision_reason text;
alter table public.community_verifications
  add column if not exists category text not null default 'community',
  add column if not exists official_links text[] not null default '{}',
  add column if not exists supporting_text text,
  add column if not exists decision_reason text;
alter table public.profile_verifications drop constraint if exists profile_verifications_category_check;
alter table public.profile_verifications add constraint profile_verifications_category_check check (category in ('individual', 'creator', 'organization', 'bot', 'staff', 'other'));
alter table public.community_verifications drop constraint if exists community_verifications_category_check;
alter table public.community_verifications add constraint community_verifications_category_check check (category in ('community', 'organization', 'creator', 'other'));
alter table public.profile_verifications drop constraint if exists profile_verifications_supporting_text_check;
alter table public.profile_verifications add constraint profile_verifications_supporting_text_check check (supporting_text is null or char_length(supporting_text) <= 2000);
alter table public.community_verifications drop constraint if exists community_verifications_supporting_text_check;
alter table public.community_verifications add constraint community_verifications_supporting_text_check check (supporting_text is null or char_length(supporting_text) <= 2000);
alter table public.profile_verifications drop constraint if exists profile_verifications_decision_reason_check;
alter table public.profile_verifications add constraint profile_verifications_decision_reason_check check (decision_reason is null or char_length(decision_reason) <= 1000);
alter table public.community_verifications drop constraint if exists community_verifications_decision_reason_check;
alter table public.community_verifications add constraint community_verifications_decision_reason_check check (decision_reason is null or char_length(decision_reason) <= 1000);
create or replace function public.validate_verification_links(links text[])
returns boolean language sql immutable set search_path = public
as $$
  select cardinality(coalesce(links, '{}')) <= 5
    and not exists (select 1 from unnest(coalesce(links, '{}')) link where link !~ '^https://[^[:space:]]+$' or char_length(link) > 2048);
$$;
create or replace function public.request_profile_verification(request_type text, request_category text, request_reason text, request_links text[] default '{}', request_supporting_text text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare created public.profile_verifications%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if request_type not in ('verified_user', 'creator_verified') then raise exception 'VERIFICATION_TYPE_NOT_REQUESTABLE' using errcode = '22023'; end if;
  if request_category not in ('individual', 'creator', 'organization', 'other') then raise exception 'VERIFICATION_CATEGORY_INVALID' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(request_reason, ''))) < 20 then raise exception 'VERIFICATION_REASON_REQUIRED' using errcode = '22023'; end if;
  if not public.validate_verification_links(request_links) then raise exception 'VERIFICATION_LINKS_INVALID' using errcode = '22023'; end if;
  if char_length(coalesce(request_supporting_text, '')) > 2000 then raise exception 'VERIFICATION_SUPPORTING_TEXT_TOO_LONG' using errcode = '22023'; end if;
  insert into public.profile_verifications(user_id, type, category, reason, official_links, supporting_text)
  values (auth.uid(), request_type, request_category, btrim(request_reason), coalesce(request_links, '{}'), nullif(btrim(coalesce(request_supporting_text, '')), '')) returning * into created;
  return jsonb_build_object('id', created.id, 'targetType', 'profile', 'targetId', created.user_id, 'targetName', 'Your profile', 'type', created.type, 'status', created.status, 'category', created.category, 'reason', created.reason, 'officialLinks', created.official_links, 'supportingText', created.supporting_text, 'requestedAt', created.requested_at, 'reviewedAt', created.reviewed_at, 'decisionReason', created.decision_reason);
end;
$$;
create or replace function public.request_community_verification(target_community_id uuid, request_category text, request_reason text, request_links text[] default '{}', request_supporting_text text default null)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare created public.community_verifications%rowtype; community_name text;
begin
  if not public.can_request_community_verification(target_community_id) then raise exception 'COMMUNITY_MANAGER_REQUIRED' using errcode = '42501'; end if;
  if request_category not in ('community', 'organization', 'creator', 'other') then raise exception 'VERIFICATION_CATEGORY_INVALID' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(request_reason, ''))) < 20 then raise exception 'VERIFICATION_REASON_REQUIRED' using errcode = '22023'; end if;
  if not public.validate_verification_links(request_links) then raise exception 'VERIFICATION_LINKS_INVALID' using errcode = '22023'; end if;
  if char_length(coalesce(request_supporting_text, '')) > 2000 then raise exception 'VERIFICATION_SUPPORTING_TEXT_TOO_LONG' using errcode = '22023'; end if;
  select name into community_name from public.communities where id = target_community_id;
  insert into public.community_verifications(community_id, type, category, reason, official_links, supporting_text)
  values (target_community_id, 'official_community', request_category, btrim(request_reason), coalesce(request_links, '{}'), nullif(btrim(coalesce(request_supporting_text, '')), '')) returning * into created;
  return jsonb_build_object('id', created.id, 'targetType', 'community', 'targetId', created.community_id, 'targetName', community_name, 'type', created.type, 'status', created.status, 'category', created.category, 'reason', created.reason, 'officialLinks', created.official_links, 'supportingText', created.supporting_text, 'requestedAt', created.requested_at, 'reviewedAt', created.reviewed_at, 'decisionReason', created.decision_reason);
end;
$$;
create or replace function public.get_own_profile_verification_requests()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', request.id, 'targetType', 'profile', 'targetId', request.user_id, 'targetName', 'Your profile', 'type', request.type, 'status', request.status, 'category', request.category, 'requestedAt', request.requested_at, 'reviewedAt', request.reviewed_at, 'decisionReason', request.decision_reason) order by request.requested_at desc), '[]'::jsonb)
  from public.profile_verifications request where request.user_id = auth.uid();
$$;
create or replace function public.get_community_verification_requests(target_community_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.can_request_community_verification(target_community_id) and not public.can_review_verifications() then raise exception 'COMMUNITY_MANAGER_REQUIRED' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', request.id, 'targetType', 'community', 'targetId', request.community_id, 'targetName', community.name, 'type', request.type, 'status', request.status, 'category', request.category, 'requestedAt', request.requested_at, 'reviewedAt', request.reviewed_at, 'decisionReason', request.decision_reason) order by request.requested_at desc), '[]'::jsonb)
  into result from public.community_verifications request join public.communities community on community.id = request.community_id where request.community_id = target_community_id;
  return result;
end;
$$;
create or replace function public.list_verification_review_requests(request_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.can_review_verifications() then raise exception 'VERIFICATION_REVIEWER_REQUIRED' using errcode = '42501'; end if;
  if request_status is not null and request_status not in ('pending', 'approved', 'rejected', 'revoked') then raise exception 'VERIFICATION_STATUS_INVALID' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(item order by (item ->> 'requestedAt') desc), '[]'::jsonb) into result from (
    select jsonb_build_object('id', request.id, 'targetType', 'profile', 'targetId', request.user_id, 'targetName', profile.display_name, 'type', request.type, 'status', request.status, 'category', request.category, 'reason', request.reason, 'officialLinks', request.official_links, 'supportingText', request.supporting_text, 'requestedAt', request.requested_at, 'reviewedAt', request.reviewed_at, 'decisionReason', request.decision_reason) item from public.profile_verifications request join public.profiles profile on profile.id = request.user_id where request_status is null or request.status = request_status
    union all
    select jsonb_build_object('id', request.id, 'targetType', 'community', 'targetId', request.community_id, 'targetName', community.name, 'type', request.type, 'status', request.status, 'category', request.category, 'reason', request.reason, 'officialLinks', request.official_links, 'supportingText', request.supporting_text, 'requestedAt', request.requested_at, 'reviewedAt', request.reviewed_at, 'decisionReason', request.decision_reason) item from public.community_verifications request join public.communities community on community.id = request.community_id where request_status is null or request.status = request_status
  ) queue;
  return result;
end;
$$;
create or replace function public.review_verification_request(target_type text, target_request_id uuid, next_status text, review_reason text)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare result jsonb;
begin
  if not public.can_review_verifications() then raise exception 'VERIFICATION_REVIEWER_REQUIRED' using errcode = '42501'; end if;
  if target_type = 'profile' then
    perform public.review_profile_verification(target_request_id, next_status, review_reason);
    update public.profile_verifications set decision_reason = public.redact_audit_reason(review_reason) where id = target_request_id;
    select jsonb_build_object('id', request.id, 'targetType', 'profile', 'targetId', request.user_id, 'targetName', profile.display_name, 'type', request.type, 'status', request.status, 'category', request.category, 'reason', request.reason, 'officialLinks', request.official_links, 'supportingText', request.supporting_text, 'requestedAt', request.requested_at, 'reviewedAt', request.reviewed_at, 'decisionReason', request.decision_reason) into result from public.profile_verifications request join public.profiles profile on profile.id = request.user_id where request.id = target_request_id;
  elsif target_type = 'community' then
    perform public.review_community_verification(target_request_id, next_status, review_reason);
    update public.community_verifications set decision_reason = public.redact_audit_reason(review_reason) where id = target_request_id;
    select jsonb_build_object('id', request.id, 'targetType', 'community', 'targetId', request.community_id, 'targetName', community.name, 'type', request.type, 'status', request.status, 'category', request.category, 'reason', request.reason, 'officialLinks', request.official_links, 'supportingText', request.supporting_text, 'requestedAt', request.requested_at, 'reviewedAt', request.reviewed_at, 'decisionReason', request.decision_reason) into result from public.community_verifications request join public.communities community on community.id = request.community_id where request.id = target_request_id;
  else raise exception 'VERIFICATION_TARGET_INVALID' using errcode = '22023';
  end if;
  return result;
end;
$$;
revoke all on function public.validate_verification_links(text[]), public.request_profile_verification(text, text, text, text[], text), public.request_community_verification(uuid, text, text, text[], text), public.get_own_profile_verification_requests(), public.get_community_verification_requests(uuid), public.list_verification_review_requests(text), public.review_verification_request(text, uuid, text, text) from public, anon;
grant execute on function public.request_profile_verification(text, text, text, text[], text), public.request_community_verification(uuid, text, text, text[], text), public.get_own_profile_verification_requests(), public.get_community_verification_requests(uuid), public.list_verification_review_requests(text), public.review_verification_request(text, uuid, text, text) to authenticated;
comment on function public.request_profile_verification(text, text, text, text[], text) is 'MVP request metadata only. Identity-document upload and paid verification are intentionally unsupported.';
comment on function public.list_verification_review_requests(text) is 'Private reviewer queue. Request reasons and supporting text are never returned by public badge reads.';
commit;
