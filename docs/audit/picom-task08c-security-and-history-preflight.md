# TASK 08C — Security and History Preflight

Generated: 2026-08-04T00:50:00+02:00  
Branch: `feat/community-rebuild`  
HEAD: `5d168177a1b30ed80ac26edab8b6b2b2b4e7b9dd`

| Finding | Current state | Expected state | Security impact | Migration required? | Test required? | Hosted dependency | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Advertising pgTAP FAIL | `has_table('public', name)` 2-arg mis-arity; `plan(20)` vs 12 tests; permission asserts run as superuser | Correct 3-arg pgTAP; authenticated role; real fixtures | False FAIL hides real ACL gaps | No (test fix) | Yes | No | OPEN |
| Partner pgTAP FAIL | Same arity/plan issues; `UPDATE … WHERE false` never fires guards; insert as superuser | Authenticated role + fixture rows | False FAIL / weak contract | Possibly grants cleanup | Yes | No | OPEN |
| `ads_allow_internal_transition` PUBLIC EXECUTE | PUBLIC+postgres+service_role | No PUBLIC/anon/authenticated | Client can invoke helper (GUC still required) | Yes additive | Yes | No | OPEN |
| `platform_role_catalog` RLS off | relrowsecurity=false; grants revoked from client but PostgREST advisory critical | RLS on; no client write; admin-only read or safe view | Catalog readable if grants leak | Yes additive | Yes | No | OPEN |
| Hosted-only `20260803221951` | Prod has statements; local missing `metadata` column | Materialized exact SQL in repo | History drift blocks safe push | Yes materialize | Yes checkpoint | Prod read-only | OPEN |
| Incremental dedicated DBs | Only clean reset Path A done in 08B | A/B/C/D separate DBs | Missed upgrade collisions | No | Yes | No | OPEN |
| Storage JWT matrix | Static/contract only | Real Auth JWT + Storage API | Policy SQL ≠ E2E | Maybe | Yes | Local stack | OPEN |

## Hosted `20260803221951` recovered SQL (production)

```sql
alter table public.community_live_screen_sessions
  add column if not exists metadata jsonb not null default '{}'::jsonb;
-- + check constraint community_live_screen_sessions_metadata_object_check
```

Classification candidate: **EXACT_RECONSTRUCTABLE**

## Tools

Docker Server 29.4.2 · `npx supabase` 2.109.1 · Node v24.15.0 · psql via `docker exec supabase_db_picom`
