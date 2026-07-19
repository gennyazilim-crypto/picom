-- Read states table schema hardening
-- Keeps per-user channel read markers consistent for unread indicators.

create index if not exists idx_read_states_channel_updated_at
  on public.read_states(channel_id, updated_at desc);
create index if not exists idx_read_states_last_read_message_id
  on public.read_states(last_read_message_id)
  where last_read_message_id is not null;
create or replace function public.ensure_read_state_message_matches_channel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_read_message_id is not null and not exists (
    select 1
    from public.messages message_record
    where message_record.id = new.last_read_message_id
      and message_record.channel_id = new.channel_id
  ) then
    raise exception 'last_read_message_id must belong to the same channel' using errcode = '23514';
  end if;

  return new;
end;
$$;
drop trigger if exists trg_read_states_message_matches_channel on public.read_states;
create trigger trg_read_states_message_matches_channel
before insert or update of channel_id, last_read_message_id on public.read_states
for each row
execute function public.ensure_read_state_message_matches_channel();
