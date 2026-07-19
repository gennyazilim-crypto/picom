-- Realtime publication and notification integrity for friend service flows.
begin;

alter table public.friend_requests replica identity full;
alter table public.friendships replica identity full;
alter table public.friend_request_notifications replica identity full;

with duplicate_notifications as (
  select id,
    row_number() over (
      partition by request_id, event_type, recipient_id
      order by created_at, id
    ) as duplicate_rank
  from public.friend_request_notifications
  where request_id is not null
)
delete from public.friend_request_notifications notification
using duplicate_notifications duplicate
where notification.id = duplicate.id and duplicate.duplicate_rank > 1;

create unique index if not exists friend_request_notifications_event_once_idx
  on public.friend_request_notifications(request_id, event_type, recipient_id)
  where request_id is not null;
create index if not exists friend_request_notifications_recipient_created_idx
  on public.friend_request_notifications(recipient_id, created_at desc);

alter table public.friend_request_notifications enable row level security;
drop policy if exists friend_request_notifications_recipient_read_v2 on public.friend_request_notifications;
create policy friend_request_notifications_recipient_read_v2
on public.friend_request_notifications for select to authenticated
using (recipient_id = auth.uid());

revoke insert, update, delete on public.friend_request_notifications from authenticated;
grant select on public.friend_request_notifications to authenticated;

do $$
declare
  relation_name text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach relation_name in array array['friend_requests', 'friendships', 'friend_request_notifications']
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = relation_name
      ) then
        execute format('alter publication supabase_realtime add table public.%I', relation_name);
      end if;
    end loop;
  end if;
end;
$$;

comment on table public.friend_request_notifications is
  'Recipient-private friend lifecycle notifications. Desktop/inbox routing additionally respects local user notification preferences.';;
