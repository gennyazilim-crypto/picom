-- Compatibility predecessor for Publisher Phase 1.
-- SOURCE_MIGRATION: NOT_FOUND_IN_GIT_HISTORY
-- CANONICAL_SOURCE: STAGING_SCHEMA_INTROSPECTION (picom-staging / ufmtvqtsklqsmqxefbbs)
-- COMPATIBILITY_VERSION: 20260803135000
--
-- Required by 20260803140000 / 20260803160000 (language sql joins).
-- Fail-closed: if the table already exists, required columns/constraints must match.

begin;

do $picom_par_guard$
declare
  rel regclass := to_regclass('public.platform_account_restrictions');
  missing text;
begin
  if rel is null then
    return;
  end if;

  select string_agg(required.column_name, ', ' order by required.column_name)
    into missing
  from (
    values
      ('user_id', 'uuid'),
      ('status', 'text'),
      ('reason', 'text'),
      ('restricted_until', 'timestamp with time zone'),
      ('updated_by', 'uuid'),
      ('updated_at', 'timestamp with time zone'),
      ('created_at', 'timestamp with time zone'),
      ('reason_code', 'text'),
      ('internal_note', 'text'),
      ('effective_at', 'timestamp with time zone'),
      ('expires_at', 'timestamp with time zone'),
      ('created_by', 'uuid'),
      ('notify_user', 'boolean'),
      ('revoke_sessions', 'boolean'),
      ('request_id', 'uuid')
  ) as required(column_name, data_type)
  left join information_schema.columns col
    on col.table_schema = 'public'
   and col.table_name = 'platform_account_restrictions'
   and col.column_name = required.column_name
   and col.data_type = required.data_type
  where col.column_name is null;

  if missing is not null then
    raise exception 'PLATFORM_ACCOUNT_RESTRICTIONS_INCOMPATIBLE_SCHEMA'
      using errcode = '55000',
            hint = format('Existing public.platform_account_restrictions is missing/mismatched columns: %s', missing);
  end if;
end;
$picom_par_guard$;

create table if not exists public.platform_account_restrictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active'
    check (status = any (array[
      'active'::text,
      'limited'::text,
      'under_review'::text,
      'suspended'::text,
      'temporarily_banned'::text,
      'permanently_banned'::text,
      'deletion_pending'::text,
      'deleted'::text
    ])),
  reason text null
    check (reason is null or (char_length(reason) >= 3 and char_length(reason) <= 500)),
  restricted_until timestamptz null,
  updated_by uuid null references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  reason_code text null,
  internal_note text null,
  effective_at timestamptz not null default now(),
  expires_at timestamptz null,
  created_by uuid null references public.profiles(id) on delete set null,
  notify_user boolean not null default false,
  revoke_sessions boolean not null default false,
  request_id uuid null
);

create index if not exists platform_account_restrictions_status_idx
  on public.platform_account_restrictions (status, updated_at desc);

alter table public.platform_account_restrictions enable row level security;

-- Staging has RLS enabled with zero policies and no authenticated/anon grants.
revoke all on table public.platform_account_restrictions from public, anon, authenticated;
grant select, insert, update, delete, references, trigger, truncate
  on table public.platform_account_restrictions to service_role;

comment on table public.platform_account_restrictions is
  'Canonical platform account restriction ledger (staging-introspected compatibility predecessor).';

commit;
