-- RLS policies for public.message_reactions
-- Reaction access follows message visibility; users manage only their own reactions.

grant select, insert, delete on public.message_reactions to authenticated;
alter table public.message_reactions enable row level security;
drop policy if exists "message_reactions_select_visible_message" on public.message_reactions;
create policy "message_reactions_select_visible_message"
on public.message_reactions
for select
to authenticated
using (public.can_view_message(message_id));
drop policy if exists "message_reactions_insert_own_visible_message" on public.message_reactions;
create policy "message_reactions_insert_own_visible_message"
on public.message_reactions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.can_view_message(message_id)
);
drop policy if exists "message_reactions_delete_own_visible_message" on public.message_reactions;
create policy "message_reactions_delete_own_visible_message"
on public.message_reactions
for delete
to authenticated
using (
  user_id = auth.uid()
  and public.can_view_message(message_id)
);
