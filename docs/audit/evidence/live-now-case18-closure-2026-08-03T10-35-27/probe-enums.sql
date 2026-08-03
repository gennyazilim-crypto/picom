select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as def
from pg_constraint
where contype = 'c'
  and conrelid::regclass::text in (
    'publisher_applications','publisher_profiles','publisher_badges',
    'community_live_screen_sessions','publisher_live_schedules'
  )
order by 1,2;
select t.typname, e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and (
    t.typname ilike '%publisher%'
    or t.typname ilike '%live%'
    or t.typname ilike '%badge%'
    or t.typname ilike '%moderation%'
    or t.typname ilike '%visibility%'
  )
order by 1, e.enumsortorder;
