create table if not exists public.community_events (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null, title text not null check(char_length(title) between 1 and 120),
  description text not null default '' check(char_length(description)<=2000), starts_at timestamptz not null, ends_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict, cancelled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(ends_at is null or ends_at>starts_at)
);
create index if not exists idx_community_events_upcoming on public.community_events(community_id,starts_at) where cancelled_at is null;
grant select,insert,update on public.community_events to authenticated; grant select on public.community_events to anon;
alter table public.community_events enable row level security;
create policy "events_select_member_or_public" on public.community_events for select to anon,authenticated using (
 public.is_community_member(community_id) or exists(select 1 from public.communities c where c.id=community_id and c.visibility='public' and c.public_read_enabled=true)
);
create policy "events_insert_manager" on public.community_events for insert to authenticated with check (
 created_by=auth.uid() and (public.is_community_owner(community_id) or public.has_community_role_level(community_id,80))
);
create policy "events_update_manager" on public.community_events for update to authenticated using (
 public.is_community_owner(community_id) or public.has_community_role_level(community_id,80)
) with check (public.is_community_owner(community_id) or public.has_community_role_level(community_id,80));
