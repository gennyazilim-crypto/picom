alter table public.profiles add column if not exists is_bot boolean not null default false;

create table if not exists public.bots (
  id uuid primary key default gen_random_uuid(), profile_id uuid not null unique references public.profiles(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete restrict, display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text, created_at timestamptz not null default now()
);

create table if not exists public.community_bots (
  community_id uuid not null references public.communities(id) on delete cascade, bot_id uuid not null references public.bots(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict, installed_by uuid not null references public.profiles(id) on delete restrict,
  installed_at timestamptz not null default now(), primary key (community_id, bot_id)
);

alter table public.bots enable row level security;
alter table public.community_bots enable row level security;
grant select on public.bots to authenticated;
grant select, delete on public.community_bots to authenticated;
create policy "bots_authenticated_select" on public.bots for select to authenticated using (true);
create policy "community_bots_member_select" on public.community_bots for select to authenticated using (exists (select 1 from public.community_members membership where membership.community_id = community_bots.community_id and membership.user_id = auth.uid()));
create policy "community_bots_manager_delete" on public.community_bots for delete to authenticated using (public.is_community_owner(community_id) or exists (select 1 from public.community_members membership join public.roles role on role.id = membership.role_id where membership.community_id = community_bots.community_id and membership.user_id = auth.uid() and role.level >= 80));

-- Bot creation and installation INSERT remain unavailable to the renderer.
-- A future trusted Edge Function may provision bot profiles without ever returning raw credentials.
