# Hosted Migration Reconciliation — 20260803221951

| Field | Value |
| --- | --- |
| Production ref | `cqnsetsmcduraryemhbi` |
| Migration version | `20260803221951` |
| Remote name | `live_screen_session_metadata` |
| Recovered source | `supabase_migrations.schema_migrations.statements` (read-only MCP `execute_sql`) |
| Classification | **EXACT_RECONSTRUCTABLE** |
| History mutation performed | **no** |
| Hosted apply performed | **no** |

## Recovered SQL

```sql
alter table public.community_live_screen_sessions
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'community_live_screen_sessions_metadata_object_check'
  ) then
    alter table public.community_live_screen_sessions
      add constraint community_live_screen_sessions_metadata_object_check
      check (jsonb_typeof(metadata) = 'object');
  end if;
end $$;
```

## Affected objects

- Table: `public.community_live_screen_sessions`
- Column: `metadata jsonb not null default '{}'::jsonb`
- Constraint: `community_live_screen_sessions_metadata_object_check`

## Local equivalent

Before materialization: local clean schema lacked `metadata` (verified).  
Materialized file: `supabase/migrations/20260803221951_live_screen_session_metadata.sql`  
LF SHA-256: `87d557e440a68257b41d426552dc702b09e958600d49d819fc99c55818ed4919`

## Exact differences

None intentional vs recovered statements (canonical whitespace/LF only).

## Materialization strategy

Insert identical versioned migration into repository so clean reset and production-ordered upgrades include the hosted change. Production history row left untouched; hosted apply remains separate gated task.

## Evidence timestamp

2026-08-04 (TASK 08C)
