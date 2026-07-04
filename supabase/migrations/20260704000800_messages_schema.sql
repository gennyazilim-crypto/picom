-- Messages table schema hardening
-- Prepares message records for optimistic sends, Supabase Realtime, and safe pagination.

alter table public.messages
  add column if not exists client_message_id text;

alter table public.messages
  add constraint messages_body_length check (char_length(body) <= 4000),
  add constraint messages_client_message_id_length check (client_message_id is null or char_length(client_message_id) <= 120),
  add constraint messages_edited_after_created check (edited_at is null or edited_at >= created_at),
  add constraint messages_deleted_after_created check (deleted_at is null or deleted_at >= created_at);

create unique index if not exists messages_author_client_message_unique
  on public.messages(author_id, client_message_id)
  where client_message_id is not null;

create index if not exists idx_messages_community_channel_created_at
  on public.messages(community_id, channel_id, created_at desc);

create index if not exists idx_messages_channel_visible_created_at
  on public.messages(channel_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_messages_client_message_id
  on public.messages(client_message_id)
  where client_message_id is not null;

create or replace function public.ensure_message_channel_matches_community()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.channels channel_record
    where channel_record.id = new.channel_id
      and channel_record.community_id = new.community_id
  ) then
    raise exception 'channel_id must belong to the same community' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_messages_channel_matches_community on public.messages;
create trigger trg_messages_channel_matches_community
before insert or update of community_id, channel_id on public.messages
for each row
execute function public.ensure_message_channel_matches_community();