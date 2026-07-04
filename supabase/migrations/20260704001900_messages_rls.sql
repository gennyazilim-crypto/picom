-- RLS policies for public.messages
-- Message access follows channel visibility; sends are limited to text channels.

create or replace function public.can_send_message_to_channel(target_channel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.channels channel
    where channel.id = target_channel_id
      and channel.type = 'text'
      and public.can_view_channel(channel.id)
  );
$$;

grant execute on function public.can_send_message_to_channel(uuid) to authenticated;

grant select, insert, update, delete on public.messages to authenticated;

alter table public.messages enable row level security;

drop policy if exists "messages_select_visible_channel" on public.messages;
create policy "messages_select_visible_channel"
on public.messages
for select
to authenticated
using (public.can_view_channel(channel_id));

drop policy if exists "messages_insert_author_visible_text_channel" on public.messages;
create policy "messages_insert_author_visible_text_channel"
on public.messages
for insert
to authenticated
with check (
  author_id = auth.uid()
  and public.can_send_message_to_channel(channel_id)
);

drop policy if exists "messages_update_own_visible_message" on public.messages;
create policy "messages_update_own_visible_message"
on public.messages
for update
to authenticated
using (
  author_id = auth.uid()
  and public.can_view_channel(channel_id)
)
with check (
  author_id = auth.uid()
  and public.can_view_channel(channel_id)
);

drop policy if exists "messages_delete_own_or_owner" on public.messages;
create policy "messages_delete_own_or_owner"
on public.messages
for delete
to authenticated
using (
  public.can_view_channel(channel_id)
  and (
    author_id = auth.uid()
    or public.is_community_owner(community_id)
  )
);