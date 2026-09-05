# Production Apply Failure — Desktop Notifications

## Result

```text
PRODUCTION_APPLY: FAILED_SQL_42601
MIGRATION: 20260904100000_production_desktop_notifications.sql
TARGET: picom-production / cqnsetsmcduraryemhbi
RETRY: NOT_PERFORMED
MIGRATION_REPAIR: NOT_PERFORMED
FEATURE_FLAG: OFF
```

The official linked Supabase CLI offered exactly the sealed migration and began
the transaction. PostgreSQL rejected the body of
`public.insert_trusted_desktop_notification` with `SQLSTATE 42601`.

The invalid syntax is the multi-value `WHEN` arm in the `CASE target_type`
expression:

```sql
when 'followed_user_live', 'followed_publisher_live' then 'event'
```

PostgreSQL requires a valid boolean `WHEN` predicate or separate simple-CASE
arms. No corrective migration, history repair, retry, or alternate executor was
used after this first SQL error.

The sealed manifest remains historical evidence of the pre-apply gate result;
this record supersedes it as the production-apply verdict.
