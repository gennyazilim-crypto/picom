-- Realtime Authorization evaluates these policies in its own transaction.
-- Keep the membership checks inline, matching Supabase's documented pattern,
-- so request JWT claims and realtime.topic() are evaluated in that context.

drop policy if exists "picom members receive private realtime topics" on realtime.messages;
create policy "picom members receive private realtime topics"
on realtime.messages
for select
to authenticated
using (
  case
    when extension = 'presence'
      and (select realtime.topic()) ~ '^presence:community:[0-9a-fA-F-]{36}$'
    then exists (
      select 1
      from public.community_members membership
      where membership.user_id = (select auth.uid())
        and membership.community_id = split_part((select realtime.topic()), ':', 3)::uuid
    )
    when extension in ('broadcast', 'presence')
      and (select realtime.topic()) ~ '^(typing|room):community:[0-9a-fA-F-]{36}:channel:[0-9a-fA-F-]{36}$'
    then exists (
      select 1
      from public.channels channel
      join public.community_members membership
        on membership.community_id = channel.community_id
       and membership.user_id = (select auth.uid())
      where channel.id = split_part((select realtime.topic()), ':', 5)::uuid
        and channel.community_id = split_part((select realtime.topic()), ':', 3)::uuid
        and public.can_view_channel(channel.id)
    )
    else false
  end
);
drop policy if exists "picom members send private realtime topics" on realtime.messages;
create policy "picom members send private realtime topics"
on realtime.messages
for insert
to authenticated
with check (
  case
    when extension = 'presence'
      and (select realtime.topic()) ~ '^presence:community:[0-9a-fA-F-]{36}$'
    then exists (
      select 1
      from public.community_members membership
      where membership.user_id = (select auth.uid())
        and membership.community_id = split_part((select realtime.topic()), ':', 3)::uuid
    )
    when extension in ('broadcast', 'presence')
      and (select realtime.topic()) ~ '^(typing|room):community:[0-9a-fA-F-]{36}:channel:[0-9a-fA-F-]{36}$'
    then exists (
      select 1
      from public.channels channel
      join public.community_members membership
        on membership.community_id = channel.community_id
       and membership.user_id = (select auth.uid())
      where channel.id = split_part((select realtime.topic()), ':', 5)::uuid
        and channel.community_id = split_part((select realtime.topic()), ':', 3)::uuid
        and public.can_view_channel(channel.id)
    )
    else false
  end
);
