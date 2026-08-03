-- Compatibility predecessor for Publisher Phase 1 eligibility helpers.
-- SOURCE_MIGRATION: NOT_FOUND_IN_GIT_HISTORY
-- CANONICAL_SOURCE: STAGING_SCHEMA_INTROSPECTION (picom-staging / ufmtvqtsklqsmqxefbbs)
-- COMPATIBILITY_VERSION: 20260803135300
--
-- Required by 20260803140000 / 20260803160000 (profiles.deactivated_at predicates).
-- Staging: timestamptz NULL, no default, no index/check; comment present.
-- Fail-closed: if the column already exists, type/nullability must match.

begin;

do $picom_deactivated_at_guard$
declare
  col_type text;
  col_nullable text;
begin
  select c.data_type, c.is_nullable
    into col_type, col_nullable
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'profiles'
    and c.column_name = 'deactivated_at';

  if col_type is null then
    return;
  end if;

  if col_type is distinct from 'timestamp with time zone' or col_nullable is distinct from 'YES' then
    raise exception 'PROFILES_DEACTIVATED_AT_INCOMPATIBLE_SCHEMA'
      using errcode = '55000',
            hint = format(
              'Existing public.profiles.deactivated_at has type=%s nullable=%s; expected timestamp with time zone / YES',
              coalesce(col_type, '<missing>'),
              coalesce(col_nullable, '<missing>')
            );
  end if;
end;
$picom_deactivated_at_guard$;

alter table public.profiles
  add column if not exists deactivated_at timestamptz null;

comment on column public.profiles.deactivated_at is
  'Soft deactivation timestamp; account is not deleted.';

commit;
