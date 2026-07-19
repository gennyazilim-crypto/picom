create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict, action_type text not null check (action_type in ('community_update','channel_create','channel_update','channel_delete','role_change','member_change','moderation_action','invite_create','invite_revoke')),
  target_type text not null, target_id uuid, reason text check (reason is null or char_length(reason) <= 500), created_at timestamptz not null default now()
);
create index if not exists idx_audit_log_community_created on public.audit_log(community_id, created_at desc);
alter table public.audit_log enable row level security;
create or replace function public.can_view_community_audit_log(target_community_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_community_owner(target_community_id) or exists (select 1 from public.community_members membership join public.roles role on role.id = membership.role_id where membership.community_id = target_community_id and membership.user_id = auth.uid() and (role.level >= 80 or coalesce((role.permissions ->> 'viewAuditLog')::boolean, false)));
$$;
grant execute on function public.can_view_community_audit_log(uuid) to authenticated;
grant select on public.audit_log to authenticated;
create policy "audit_log_permitted_select" on public.audit_log for select to authenticated using (public.can_view_community_audit_log(community_id));
create or replace function public.append_community_audit_log(target_community_id uuid, event_action_type text, event_target_type text, event_target_id uuid default null, event_reason text default null) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (public.can_view_community_audit_log(target_community_id) or public.can_moderate_community_reports(target_community_id) or public.can_create_community_invite(target_community_id)) then raise exception 'permission denied'; end if;
  insert into public.audit_log(community_id,actor_id,action_type,target_type,target_id,reason) values(target_community_id,auth.uid(),event_action_type,event_target_type,event_target_id,left(event_reason,500)) returning id into new_id;
  return new_id;
end;
$$;
revoke all on function public.append_community_audit_log(uuid,text,text,uuid,text) from public;
grant execute on function public.append_community_audit_log(uuid,text,text,uuid,text) to authenticated;
