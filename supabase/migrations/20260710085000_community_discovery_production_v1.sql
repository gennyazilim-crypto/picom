alter table public.communities
  add column if not exists discovery_join_policy text not null default 'open'
  check (discovery_join_policy in ('open', 'request'));

create table if not exists public.community_discovery_reviews (
  community_id uuid primary key references public.communities(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete restrict,
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_join_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'canceled')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  unique (community_id, user_id)
);

create index if not exists idx_discovery_reviews_status_updated
  on public.community_discovery_reviews(status, updated_at desc);
create index if not exists idx_join_requests_community_status
  on public.community_join_requests(community_id, status, created_at desc);

alter table public.community_discovery_reviews enable row level security;
alter table public.community_join_requests enable row level security;
revoke all on table public.community_discovery_reviews from anon, authenticated;
revoke all on table public.community_join_requests from anon, authenticated;

create or replace function public.list_public_discovery_communities(
  search_text text default null,
  category_filter text default null,
  result_limit integer default 60
)
returns table(
  id uuid,
  name text,
  description text,
  icon_url text,
  accent_color text,
  category text,
  member_count bigint,
  join_policy text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    community.id,
    community.name,
    community.description,
    community.icon_url,
    community.accent_color,
    community.category,
    count(membership.id) as member_count,
    community.discovery_join_policy as join_policy
  from public.communities community
  join public.community_discovery_reviews review
    on review.community_id = community.id and review.status = 'approved'
  left join public.community_members membership on membership.community_id = community.id
  where community.visibility = 'public'
    and community.public_read_enabled = true
    and community.discovery_listed = true
    and (category_filter is null or community.category = category_filter)
    and (
      search_text is null
      or btrim(search_text) = ''
      or community.name ilike '%' || left(btrim(search_text), 80) || '%'
      or coalesce(community.description, '') ilike '%' || left(btrim(search_text), 80) || '%'
    )
  group by community.id
  order by count(membership.id) desc, community.created_at desc
  limit least(greatest(result_limit, 1), 60);
$$;

revoke all on function public.list_public_discovery_communities(text,text,integer) from public;
grant execute on function public.list_public_discovery_communities(text,text,integer) to anon, authenticated;

create or replace function public.join_or_request_discovery_community(target_community_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_policy text;
  default_role_id uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  select community.discovery_join_policy into target_policy
  from public.communities community
  join public.community_discovery_reviews review
    on review.community_id = community.id and review.status = 'approved'
  where community.id = target_community_id
    and community.visibility = 'public'
    and community.public_read_enabled = true
    and community.discovery_listed = true;
  if not found then raise exception 'DISCOVERY_COMMUNITY_UNAVAILABLE'; end if;

  if exists (
    select 1 from public.community_members membership
    where membership.community_id = target_community_id and membership.user_id = auth.uid()
  ) then return 'already_member'; end if;

  if target_policy = 'request' then
    insert into public.community_join_requests(community_id, user_id, status, created_at, reviewed_at, reviewed_by)
    values(target_community_id, auth.uid(), 'pending', now(), null, null)
    on conflict (community_id, user_id) do update
      set status = case when community_join_requests.status in ('denied', 'canceled') then 'pending' else community_join_requests.status end,
          created_at = case when community_join_requests.status in ('denied', 'canceled') then now() else community_join_requests.created_at end,
          reviewed_at = null,
          reviewed_by = null;
    return 'requested';
  end if;

  select role.id into default_role_id
  from public.roles role
  where role.community_id = target_community_id and (role.is_default = true or role.name = 'Member')
  order by role.is_default desc, role.level asc
  limit 1;
  if default_role_id is null then raise exception 'DISCOVERY_DEFAULT_ROLE_MISSING'; end if;

  insert into public.community_members(community_id, user_id, role_id)
  values(target_community_id, auth.uid(), default_role_id)
  on conflict (community_id, user_id) do nothing;
  return 'joined';
end;
$$;

revoke all on function public.join_or_request_discovery_community(uuid) from public, anon;
grant execute on function public.join_or_request_discovery_community(uuid) to authenticated;

comment on table public.community_discovery_reviews is
  'Backend/app-admin review gate. No community is returned by production discovery without an approved row.';
