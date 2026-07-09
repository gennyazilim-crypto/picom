-- User-owned saved messages. Message visibility is rechecked for every read/insert.
create table if not exists public.saved_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);
create index if not exists idx_saved_messages_user_created on public.saved_messages(user_id, created_at desc);
grant select, insert, delete on public.saved_messages to authenticated;
alter table public.saved_messages enable row level security;
create policy "saved_messages_select_owner_visible" on public.saved_messages for select to authenticated using (
  user_id = auth.uid() and exists (select 1 from public.messages message where message.id = message_id and public.can_view_channel(message.channel_id))
);
create policy "saved_messages_insert_owner_visible" on public.saved_messages for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.messages message where message.id = message_id and public.can_view_channel(message.channel_id))
);
create policy "saved_messages_delete_owner" on public.saved_messages for delete to authenticated using (user_id = auth.uid());
