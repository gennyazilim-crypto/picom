alter table public.community_discovery_reviews
  drop constraint if exists community_discovery_reviews_status_check;
alter table public.community_discovery_reviews
  add constraint community_discovery_reviews_status_check
  check (status in ('pending', 'approved', 'rejected', 'hidden', 'suspended'));
alter table public.audit_log drop constraint if exists audit_log_action_type_check;
alter table public.audit_log add constraint audit_log_action_type_check check (
  action_type in (
    'community_update','channel_create','channel_update','channel_delete','role_change','member_change',
    'moderation_action','invite_create','invite_revoke','webhook_create','webhook_revoke','webhook_message',
    'discovery_review'
  )
);
create or replace function public.list_discovery_review_queue(
  status_filter text default null,
  result_limit integer default 100
)
returns table(
  community_id uuid,
  community_name text,
  description text,
  icon_url text,
  category text,
  review_status text,
  report_count bigint,
  submitted_at timestamptz,
  reviewed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED'; end if;
  if status_filter is not null and status_filter not in ('pending','approved','rejected','hidden','suspended') then
    raise exception 'DISCOVERY_REVIEW_STATUS_INVALID';
  end if;

  return query
  select
    community.id,
    community.name,
    community.description,
    community.icon_url,
    community.category,
    coalesce(review.status, 'pending') as review_status,
    count(report.id) filter (where report.target_type = 'community') as report_count,
    coalesce(review.created_at, community.updated_at) as submitted_at,
    review.reviewed_at
  from public.communities community
  left join public.community_discovery_reviews review on review.community_id = community.id
  left join public.reports report
    on report.community_id = community.id
    and report.target_type = 'community'
    and report.target_id = community.id::text
  where community.visibility = 'public'
    and community.discovery_listed = true
    and (status_filter is null or coalesce(review.status, 'pending') = status_filter)
  group by community.id, review.community_id, review.status, review.created_at, review.reviewed_at
  order by
    case coalesce(review.status, 'pending') when 'pending' then 0 when 'suspended' then 1 when 'hidden' then 2 else 3 end,
    count(report.id) desc,
    coalesce(review.created_at, community.updated_at) asc
  limit least(greatest(result_limit, 1), 100);
end;
$$;
revoke all on function public.list_discovery_review_queue(text,integer) from public, anon;
grant execute on function public.list_discovery_review_queue(text,integer) to authenticated;
create or replace function public.review_discovery_listing(
  target_community_id uuid,
  next_status text,
  review_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED'; end if;
  if next_status not in ('pending','approved','rejected','hidden','suspended') then
    raise exception 'DISCOVERY_REVIEW_STATUS_INVALID';
  end if;
  if not exists (
    select 1 from public.communities community
    where community.id = target_community_id
      and community.visibility = 'public'
      and community.discovery_listed = true
  ) then raise exception 'DISCOVERY_LISTING_UNAVAILABLE'; end if;

  insert into public.community_discovery_reviews(community_id, status, reviewed_by, review_note, reviewed_at, updated_at)
  values(target_community_id, next_status, auth.uid(), left(nullif(btrim(review_reason), ''), 500), now(), now())
  on conflict (community_id) do update
    set status = excluded.status,
        reviewed_by = excluded.reviewed_by,
        review_note = excluded.review_note,
        reviewed_at = excluded.reviewed_at,
        updated_at = excluded.updated_at;

  insert into public.audit_log(community_id, actor_id, action_type, target_type, target_id, reason)
  values(
    target_community_id,
    auth.uid(),
    'discovery_review',
    'community_discovery_listing',
    target_community_id,
    left('Discovery listing marked ' || next_status || coalesce(': ' || nullif(btrim(review_reason), ''), ''), 500)
  );
  return true;
end;
$$;
revoke all on function public.review_discovery_listing(uuid,text,text) from public, anon;
grant execute on function public.review_discovery_listing(uuid,text,text) to authenticated;
comment on function public.review_discovery_listing(uuid,text,text) is
  'App-admin-only atomic discovery review state and audit event. No private community content is returned.';
