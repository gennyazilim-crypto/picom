-- Protect server-authoritative account-deletion lifecycle fields while
-- preserving the existing owner-only profile editing policy for normal fields.
begin;

create or replace function public.protect_profile_deletion_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (
    new.is_deleted is distinct from old.is_deleted
    or new.deleted_at is distinct from old.deleted_at
    or new.deletion_requested_at is distinct from old.deletion_requested_at
  ) and auth.role() is distinct from 'service_role' then
    raise exception 'PROFILE_DELETION_LIFECYCLE_MANAGED_SERVER_SIDE'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.protect_profile_deletion_lifecycle() from public, anon, authenticated;

drop trigger if exists profiles_deletion_lifecycle_guard on public.profiles;
create trigger profiles_deletion_lifecycle_guard
before update on public.profiles
for each row execute function public.protect_profile_deletion_lifecycle();

comment on function public.protect_profile_deletion_lifecycle() is
  'Prevents non-service callers from directly mutating account deletion lifecycle fields.';

commit;
