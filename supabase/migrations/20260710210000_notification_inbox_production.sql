-- Task 277: recipient-owned notification inbox metadata.
-- Backend producers insert inbox rows only. Native desktop notifications remain a client routing concern.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  category text not null check (category in ('mention','reply','reaction','dm','event','system')),
  title text not null check (char_length(title) between 1 and 160),
  preview text not null default '' check (char_length(preview) <= 500),
  context_kind text not null check (context_kind in ('community','dm','system')),
  context_label text not null default 'Picom' check (char_length(context_label) <= 160),
  community_id uuid references public.communities(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  source_event_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz
);
create index if not exists idx_notifications_recipient_created
  on public.notifications(recipient_id, created_at desc)
  where deleted_at is null;
create index if not exists idx_notifications_recipient_unread
  on public.notifications(recipient_id, created_at desc)
  where read_at is null and deleted_at is null;
create unique index if not exists idx_notifications_recipient_source_event
  on public.notifications(recipient_id, source_event_id)
  where source_event_id is not null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, update(read_at, deleted_at) on public.notifications to authenticated;
drop policy if exists "notifications_recipient_select" on public.notifications;
create policy "notifications_recipient_select" on public.notifications
for select to authenticated using (recipient_id = auth.uid());
drop policy if exists "notifications_recipient_update" on public.notifications;
create policy "notifications_recipient_update" on public.notifications
for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());
comment on table public.notifications is
  'Private inbox metadata for one recipient. Never store credentials, tokens, authorization headers, or unrestricted private message content.';
