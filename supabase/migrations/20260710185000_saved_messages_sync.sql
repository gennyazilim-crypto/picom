drop policy if exists "saved_messages_select_owner_visible" on public.saved_messages;
create policy "saved_messages_select_owner_visible" on public.saved_messages for select to authenticated
using(user_id=auth.uid() and exists(select 1 from public.messages message where message.id=message_id and message.deleted_at is null and public.can_view_channel(message.channel_id)));
drop policy if exists "saved_messages_insert_owner_visible" on public.saved_messages;
create policy "saved_messages_insert_owner_visible" on public.saved_messages for insert to authenticated
with check(user_id=auth.uid() and exists(select 1 from public.messages message where message.id=message_id and message.deleted_at is null and public.can_view_channel(message.channel_id)));
create or replace function public.list_accessible_saved_messages(result_limit integer default 200)
returns table(id uuid,message_id uuid,community_id uuid,channel_id uuid,author_id uuid,preview text,message_created_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select saved.id,saved.message_id,message.community_id,message.channel_id,message.author_id,left(message.body,220),message.created_at,saved.created_at
  from public.saved_messages saved join public.messages message on message.id=saved.message_id
  where saved.user_id=auth.uid() and message.deleted_at is null and public.can_view_channel(message.channel_id)
  order by saved.created_at desc limit greatest(1,least(coalesce(result_limit,200),200));
$$;
grant execute on function public.list_accessible_saved_messages(integer) to authenticated;
alter publication supabase_realtime add table public.saved_messages;
comment on function public.list_accessible_saved_messages(integer) is 'Returns only current-user bookmarks whose underlying message remains visible.';
