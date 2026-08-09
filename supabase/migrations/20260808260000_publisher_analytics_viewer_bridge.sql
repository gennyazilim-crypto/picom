-- TASK29: resolve publisher_stream from live session for viewer analytics join;
-- finalize analytics when publisher stream reaches terminal status.

create or replace function public.resolve_publisher_stream_id_for_live_session(
  target_live_session_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  actor uuid := auth.uid();
  stream_id uuid;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;
  if target_live_session_id is null then
    return null;
  end if;

  select s.id
    into stream_id
  from public.publisher_streams s
  where s.live_session_id = target_live_session_id
    and s.status in ('live', 'reconnecting', 'ready', 'connecting', 'ending')
  order by s.updated_at desc
  limit 1;

  return stream_id;
end;
$$;

comment on function public.resolve_publisher_stream_id_for_live_session(uuid) is
  'Returns linked publisher_streams.id for a community live session when viewable; UUID only, no PII.';

revoke all on function public.resolve_publisher_stream_id_for_live_session(uuid) from public, anon;
grant execute on function public.resolve_publisher_stream_id_for_live_session(uuid) to authenticated;

create or replace function public.publisher_analytics_on_stream_terminal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status in ('ended', 'failed', 'cancelled')
     and old.status is distinct from new.status then
    perform public.finalize_publisher_stream_analytics(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists publisher_streams_analytics_finalize_trg on public.publisher_streams;
create trigger publisher_streams_analytics_finalize_trg
  after update of status on public.publisher_streams
  for each row
  execute function public.publisher_analytics_on_stream_terminal();

comment on function public.publisher_analytics_on_stream_terminal() is
  'Idempotent finalize hook when publisher stream reaches a terminal status.';
