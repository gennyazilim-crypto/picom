create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade, name text not null check (char_length(name) between 1 and 80),
  avatar_url text, token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'), created_by uuid not null references public.profiles(id) on delete restrict,
  revoked_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(token_hash)
);
create index if not exists idx_webhooks_community_channel on public.webhooks(community_id, channel_id, created_at desc);
alter table public.webhooks enable row level security;
create or replace function public.can_manage_channel_webhooks(target_community_id uuid) returns boolean language sql stable security definer set search_path = public as $$ select public.is_community_owner(target_community_id) or exists (select 1 from public.community_members membership join public.roles role on role.id = membership.role_id where membership.community_id = target_community_id and membership.user_id = auth.uid() and (role.level >= 80 or coalesce((role.permissions ->> 'manageChannels')::boolean, false))); $$;
grant execute on function public.can_manage_channel_webhooks(uuid) to authenticated;
grant select, insert, update on public.webhooks to authenticated;
create policy "webhooks_manager_select" on public.webhooks for select to authenticated using (public.can_manage_channel_webhooks(community_id));
create policy "webhooks_manager_insert" on public.webhooks for insert to authenticated with check (created_by = auth.uid() and public.can_manage_channel_webhooks(community_id) and exists (select 1 from public.channels channel where channel.id = channel_id and channel.community_id = community_id));
create policy "webhooks_manager_revoke" on public.webhooks for update to authenticated using (public.can_manage_channel_webhooks(community_id)) with check (public.can_manage_channel_webhooks(community_id));
alter table public.audit_log drop constraint if exists audit_log_action_type_check;
alter table public.audit_log add constraint audit_log_action_type_check check (action_type in ('community_update','channel_create','channel_update','channel_delete','role_change','member_change','moderation_action','invite_create','invite_revoke','webhook_create','webhook_revoke'));
