create table if not exists public.app_admins (user_id uuid primary key references public.profiles(id) on delete cascade, granted_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now());
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;
create or replace function public.is_app_admin() returns boolean language sql stable security definer set search_path=public as $$ select auth.uid() is not null and exists(select 1 from public.app_admins admin where admin.user_id=auth.uid()); $$;
revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;
-- App-admin grants are operator/bootstrap actions only; the renderer has no mutation route.
