-- Task 172: affected-user appeals and community-scoped review foundation.

create table if not exists public.moderation_action_records (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  affected_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  action_type text not null check (action_type in ('ban','kick','timeout','message_delete','other')),
  target_id uuid,
  reason_code text not null default 'unspecified' check (char_length(reason_code) between 1 and 80),
  appealable boolean not null default true,
  appealable_until timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_moderation_action_records_affected_created on public.moderation_action_records(affected_user_id, created_at desc);
alter table public.moderation_action_records enable row level security;
revoke all on public.moderation_action_records from authenticated;
grant select on public.moderation_action_records to authenticated;
create policy "moderation actions affected or reviewer select" on public.moderation_action_records for select to authenticated using (affected_user_id = auth.uid() or public.can_moderate_community_reports(community_id));
create table if not exists public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete restrict,
  affected_user_id uuid not null references public.profiles(id) on delete restrict,
  moderation_action_id uuid not null references public.moderation_action_records(id) on delete restrict,
  reason text not null check (char_length(reason) between 10 and 2000),
  status text not null default 'open' check (status in ('open','under_review','accepted','denied','closed')),
  decision_note text check (decision_note is null or char_length(decision_note) <= 1000),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (moderation_action_id, affected_user_id)
);
create index if not exists idx_moderation_appeals_community_status_created on public.moderation_appeals(community_id, status, created_at desc);
alter table public.moderation_appeals enable row level security;
grant select, insert on public.moderation_appeals to authenticated;
revoke update, delete, truncate on public.moderation_appeals from authenticated;
grant update (status, decision_note, reviewed_by, updated_at) on public.moderation_appeals to authenticated;
create policy "appeals affected submit" on public.moderation_appeals for insert to authenticated with check (
  affected_user_id = auth.uid() and status = 'open' and reviewed_by is null and reviewed_at is null
  and exists (select 1 from public.moderation_action_records action where action.id = moderation_action_id and action.community_id = community_id and action.affected_user_id = auth.uid() and action.appealable and (action.appealable_until is null or action.appealable_until > now()))
);
create policy "appeals affected or reviewer select" on public.moderation_appeals for select to authenticated using (affected_user_id = auth.uid() or public.can_moderate_community_reports(community_id));
create policy "appeals reviewer update" on public.moderation_appeals for update to authenticated using (public.can_moderate_community_reports(community_id)) with check (public.can_moderate_community_reports(community_id) and reviewed_by = auth.uid());
create or replace function public.enforce_appeal_status_transition() returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = old.status then return new; end if;
  if not ((old.status = 'open' and new.status in ('under_review','accepted','denied','closed')) or (old.status = 'under_review' and new.status in ('accepted','denied','closed')) or (old.status in ('accepted','denied') and new.status = 'closed')) then raise exception 'invalid appeal status transition'; end if;
  if new.reviewed_by is null then raise exception 'reviewer required'; end if;
  new.reviewed_at := coalesce(old.reviewed_at, now()); new.updated_at := now(); return new;
end;
$$;
drop trigger if exists moderation_appeals_transition_guard on public.moderation_appeals;
create trigger moderation_appeals_transition_guard before update of status on public.moderation_appeals for each row execute function public.enforce_appeal_status_transition();
comment on table public.moderation_action_records is 'Trusted backend-written appeal source ledger; authenticated clients have no insert/update/delete privilege.';
comment on table public.moderation_appeals is 'Affected-user appeals with community-scoped reviewer RLS and terminal transition guard.';
