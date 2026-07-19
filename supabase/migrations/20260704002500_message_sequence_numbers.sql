-- Message sequence numbers
-- Adds per-channel monotonic sequence numbers for stable ordering and future sync.

alter table public.messages
  add column if not exists sequence bigint;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_sequence_positive'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_sequence_positive check (sequence is null or sequence > 0);
  end if;
end;
$$;
with ranked_messages as (
  select
    id,
    row_number() over (partition by channel_id order by created_at asc, id asc) as next_sequence
  from public.messages
  where sequence is null
)
update public.messages message_record
set sequence = ranked_messages.next_sequence
from ranked_messages
where message_record.id = ranked_messages.id;
create unique index if not exists messages_channel_sequence_unique
  on public.messages(channel_id, sequence)
  where sequence is not null;
create index if not exists idx_messages_channel_sequence_created_at
  on public.messages(channel_id, sequence desc, created_at desc, id desc)
  where sequence is not null;
create or replace function public.assign_message_sequence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_sequence bigint;
begin
  perform pg_advisory_xact_lock(hashtext(new.channel_id::text));

  select coalesce(max(message_record.sequence), 0) + 1
  into next_sequence
  from public.messages message_record
  where message_record.channel_id = new.channel_id;

  new.sequence = next_sequence;
  return new;
end;
$$;
drop trigger if exists trg_messages_assign_sequence on public.messages;
create trigger trg_messages_assign_sequence
before insert on public.messages
for each row
execute function public.assign_message_sequence();
comment on column public.messages.sequence is 'Per-channel monotonic message ordering number assigned on insert.';
