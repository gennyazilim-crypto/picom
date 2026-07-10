-- Task 171: fail-closed report workflow transitions and review timestamps.

alter table public.reports add column if not exists reviewed_at timestamptz;

create or replace function public.enforce_report_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = old.status then return new; end if;
  if not ((old.status = 'open' and new.status in ('reviewed', 'dismissed', 'action_taken')) or (old.status = 'reviewed' and new.status in ('dismissed', 'action_taken'))) then
    raise exception 'invalid report status transition';
  end if;
  if new.reviewed_by is null then raise exception 'reviewer required'; end if;
  new.reviewed_at := coalesce(new.reviewed_at, now());
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reports_status_transition_guard on public.reports;
create trigger reports_status_transition_guard before update of status on public.reports for each row execute function public.enforce_report_status_transition();

comment on function public.enforce_report_status_transition() is 'Allows open to reviewed/dismissed/action_taken and reviewed to dismissed/action_taken; terminal report states cannot be reopened.';
comment on column public.reports.reviewed_at is 'First trusted moderation transition timestamp. Report content and target relations remain protected by RLS.';
