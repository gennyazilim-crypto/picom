alter table public.communities add column if not exists discovery_content_flags text[] not null default '{}';
alter table public.communities drop constraint if exists communities_discovery_content_flags_check;
alter table public.communities add constraint communities_discovery_content_flags_check check(discovery_content_flags <@ array['user_generated_content','mature_topics','regulated_topics','voice_enabled','external_links']::text[]);
create or replace function public.requeue_discovery_listing_on_profile_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.visibility='public' and new.discovery_listed=true and (
    new.name is distinct from old.name or new.description is distinct from old.description or new.icon_url is distinct from old.icon_url
    or new.category is distinct from old.category or new.discovery_content_flags is distinct from old.discovery_content_flags
    or new.visibility is distinct from old.visibility or new.discovery_listed is distinct from old.discovery_listed or new.public_read_enabled is distinct from old.public_read_enabled
  ) then
    insert into public.community_discovery_reviews(community_id,status,reviewed_by,review_note,reviewed_at,updated_at)
    values(new.id,'pending',null,null,null,now())
    on conflict(community_id) do update set status='pending',reviewed_by=null,review_note=null,reviewed_at=null,updated_at=now();
  end if;
  return new;
end $$;
drop trigger if exists requeue_discovery_listing_profile_update on public.communities;
create trigger requeue_discovery_listing_profile_update after update of name,description,icon_url,category,discovery_content_flags,visibility,discovery_listed,public_read_enabled on public.communities for each row execute function public.requeue_discovery_listing_on_profile_change();
drop function if exists public.list_discovery_review_queue(text,integer);
create function public.list_discovery_review_queue(status_filter text default null,result_limit integer default 100)
returns table(community_id uuid,community_name text,description text,icon_url text,category text,content_flags text[],review_status text,report_count bigint,submitted_at timestamptz,reviewed_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED'; end if;
  if status_filter is not null and status_filter not in ('pending','approved','rejected','hidden','suspended') then raise exception 'DISCOVERY_REVIEW_STATUS_INVALID'; end if;
  return query select community.id,community.name,community.description,community.icon_url,community.category,community.discovery_content_flags,coalesce(review.status,'pending'),count(report.id) filter(where report.target_type='community'),coalesce(review.created_at,community.updated_at),review.reviewed_at
  from public.communities community left join public.community_discovery_reviews review on review.community_id=community.id
  left join public.reports report on report.community_id=community.id and report.target_type='community' and report.target_id=community.id::text
  where community.visibility='public' and community.discovery_listed=true and (status_filter is null or coalesce(review.status,'pending')=status_filter)
  group by community.id,review.community_id,review.status,review.created_at,review.reviewed_at
  order by case coalesce(review.status,'pending') when 'pending' then 0 when 'suspended' then 1 when 'hidden' then 2 else 3 end,count(report.id) desc,coalesce(review.created_at,community.updated_at) asc
  limit least(greatest(result_limit,1),100);
end $$;
revoke all on function public.list_discovery_review_queue(text,integer) from public,anon;
grant execute on function public.list_discovery_review_queue(text,integer) to authenticated;
create or replace function public.review_discovery_listing(target_community_id uuid,next_status text,review_reason text default null) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_app_admin() then raise exception 'APP_ADMIN_REQUIRED'; end if;
  if next_status not in ('pending','approved','rejected','hidden','suspended') then raise exception 'DISCOVERY_REVIEW_STATUS_INVALID'; end if;
  if not exists(select 1 from public.communities community where community.id=target_community_id and community.visibility='public' and community.discovery_listed=true) then raise exception 'DISCOVERY_LISTING_UNAVAILABLE'; end if;
  if next_status='approved' and not exists(select 1 from public.communities community where community.id=target_community_id and community.category in('development','design','gaming','music','study','work')) then raise exception 'DISCOVERY_CATEGORY_REQUIRED'; end if;
  insert into public.community_discovery_reviews(community_id,status,reviewed_by,review_note,reviewed_at,updated_at) values(target_community_id,next_status,auth.uid(),left(nullif(btrim(review_reason),''),500),now(),now())
  on conflict(community_id) do update set status=excluded.status,reviewed_by=excluded.reviewed_by,review_note=excluded.review_note,reviewed_at=excluded.reviewed_at,updated_at=excluded.updated_at;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),'discovery_review','community_discovery_listing',target_community_id,left('Discovery listing marked '||next_status||coalesce(': '||nullif(btrim(review_reason),''),''),500));
  return true;
end $$;
revoke all on function public.review_discovery_listing(uuid,text,text) from public,anon;
grant execute on function public.review_discovery_listing(uuid,text,text) to authenticated;
create table if not exists public.report_submission_rate_limits(user_id uuid primary key references public.profiles(id) on delete cascade,window_started_at timestamptz not null default now(),submission_count integer not null default 0,updated_at timestamptz not null default now());
alter table public.report_submission_rate_limits enable row level security;
revoke all on public.report_submission_rate_limits from anon,authenticated;
create or replace function public.enforce_report_submission_rate_limit() returns trigger language plpgsql security definer set search_path=public as $$
declare counter public.report_submission_rate_limits%rowtype; begin
  insert into public.report_submission_rate_limits(user_id,window_started_at,submission_count,updated_at) values(auth.uid(),now(),1,now())
  on conflict(user_id) do update set window_started_at=case when report_submission_rate_limits.window_started_at<=now()-interval '1 hour' then now() else report_submission_rate_limits.window_started_at end,submission_count=case when report_submission_rate_limits.window_started_at<=now()-interval '1 hour' then 1 else report_submission_rate_limits.submission_count+1 end,updated_at=now() returning * into counter;
  if counter.submission_count>5 then raise exception 'RATE_LIMITED' using errcode='P0001',detail='retry_after_seconds=3600'; end if;
  return new;
end $$;
drop trigger if exists reports_submission_rate_limit on public.reports;
create trigger reports_submission_rate_limit before insert on public.reports for each row execute function public.enforce_report_submission_rate_limit();
comment on table public.report_submission_rate_limits is 'Content-free anti-spam counters. Never stores report text, credentials, tokens, raw IP addresses, or private content.';
