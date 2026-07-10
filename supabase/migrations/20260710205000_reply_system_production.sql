-- Production reply persistence. Reply targets are immutable and must belong to
-- the same channel/community as the reply message.

alter table public.messages
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;

create index if not exists idx_messages_reply_to_message
  on public.messages(reply_to_message_id)
  where reply_to_message_id is not null;

create or replace function public.validate_message_reply_target()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_channel_id uuid;
  target_community_id uuid;
  target_deleted_at timestamptz;
begin
  if tg_op = 'UPDATE'
    and old.reply_to_message_id is distinct from new.reply_to_message_id
  then
    raise exception 'REPLY_TARGET_IMMUTABLE' using errcode = '23514';
  end if;

  if new.reply_to_message_id is null then
    return new;
  end if;

  if new.reply_to_message_id = new.id then
    raise exception 'REPLY_TARGET_SELF_REFERENCE' using errcode = '23514';
  end if;

  select message.channel_id, message.community_id, message.deleted_at
  into target_channel_id, target_community_id, target_deleted_at
  from public.messages message
  where message.id = new.reply_to_message_id;

  if target_channel_id is null then
    raise exception 'REPLY_TARGET_NOT_FOUND' using errcode = '23503';
  end if;

  if target_deleted_at is not null then
    raise exception 'REPLY_TARGET_DELETED' using errcode = '23514';
  end if;

  if target_channel_id <> new.channel_id or target_community_id <> new.community_id then
    raise exception 'REPLY_TARGET_CHANNEL_MISMATCH' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_message_reply_target() from public, anon, authenticated;

drop trigger if exists messages_validate_reply_target on public.messages;
create trigger messages_validate_reply_target
before insert or update of reply_to_message_id, channel_id, community_id on public.messages
for each row
execute function public.validate_message_reply_target();

comment on column public.messages.reply_to_message_id is
  'Optional immutable same-channel reply target. RLS on the reply message and target channel remains authoritative.';
comment on function public.validate_message_reply_target() is
  'Trigger-only validation preventing cross-channel/private-target reply references, self-reference, deleted targets, and reply retargeting.';
