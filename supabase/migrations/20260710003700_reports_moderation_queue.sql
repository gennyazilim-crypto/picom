create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  target_type text not null check (target_type in ('message','user','community')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','unsafe_content','impersonation','other')),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'open' check (status in ('open','reviewed','dismissed','action_taken')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reports_community_status_created on public.reports(community_id, status, created_at desc);
create index if not exists idx_reports_reporter_created on public.reports(reporter_id, created_at desc);
alter table public.reports enable row level security;

create or replace function public.can_moderate_community_reports(target_community_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_community_owner(target_community_id) or exists (
    select 1 from public.community_members membership join public.roles role on role.id = membership.role_id
    where membership.community_id = target_community_id and membership.user_id = auth.uid()
      and (role.level >= 60 or coalesce((role.permissions ->> 'moderateMessages')::boolean, false))
  );
$$;

grant execute on function public.can_moderate_community_reports(uuid) to authenticated;
grant select, insert, update on public.reports to authenticated;

create policy "reports_submit_visible_target" on public.reports for insert to authenticated
with check (reporter_id = auth.uid() and (community_id is null or exists (select 1 from public.communities community where community.id = community_id and (community.visibility = 'public' or exists (select 1 from public.community_members membership where membership.community_id = community.id and membership.user_id = auth.uid())))));
create policy "reports_moderator_select" on public.reports for select to authenticated
using (community_id is not null and public.can_moderate_community_reports(community_id));
create policy "reports_moderator_update" on public.reports for update to authenticated
using (community_id is not null and public.can_moderate_community_reports(community_id))
with check (community_id is not null and public.can_moderate_community_reports(community_id));
