-- Task 328: user-scoped synchronous export job metadata; payloads are never persisted here.
revoke insert, update, delete on public.data_export_requests from authenticated;
create or replace function public.begin_own_data_export()
returns table(id uuid, requested_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare created public.data_export_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if exists(select 1 from public.data_export_requests r where r.user_id=auth.uid() and r.status in ('requested','processing') and r.requested_at>now()-interval '10 minutes') then raise exception 'EXPORT_ALREADY_PROCESSING' using errcode='P0001'; end if;
  insert into public.data_export_requests(user_id,status,format) values(auth.uid(),'processing','json') returning * into created;
  return query select created.id,created.requested_at;
end; $$;
create or replace function public.complete_own_data_export(target_export_id uuid, next_status text, next_failure_code text default null)
returns table(id uuid,status text,requested_at timestamptz,completed_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare completed public.data_export_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if next_status not in ('ready','failed') then raise exception 'INVALID_EXPORT_STATUS' using errcode='22023'; end if;
  if next_failure_code is not null and next_failure_code !~ '^[A-Z0-9_]{1,80}$' then raise exception 'INVALID_FAILURE_CODE' using errcode='22023'; end if;
  update public.data_export_requests r set status=next_status,completed_at=now(),expires_at=case when next_status='ready' then now()+interval '15 minutes' else null end,failure_code=case when next_status='failed' then coalesce(next_failure_code,'EXPORT_FAILED') else null end where r.id=target_export_id and r.user_id=auth.uid() and r.status='processing' returning * into completed;
  if completed.id is null then raise exception 'EXPORT_REQUEST_NOT_FOUND' using errcode='42501'; end if;
  return query select completed.id,completed.status,completed.requested_at,completed.completed_at,completed.expires_at;
end; $$;
revoke all on function public.begin_own_data_export() from public,anon;
revoke all on function public.complete_own_data_export(uuid,text,text) from public,anon;
grant execute on function public.begin_own_data_export() to authenticated;
grant execute on function public.complete_own_data_export(uuid,text,text) to authenticated;
comment on function public.begin_own_data_export() is 'Creates bounded metadata for the authenticated user only. Export content is never stored.';
comment on function public.complete_own_data_export(uuid,text,text) is 'Finalizes only the authenticated user own processing request with allowlisted status/failure metadata.';
