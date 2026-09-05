# SQL root cause and correction

Production rejected `public.insert_trusted_desktop_notification` with SQLSTATE
`42601`. The invalid procedural expression was a simple `CASE target_type`
branch that attempted to match two values with a comma:

```sql
when 'followed_user_live', 'followed_publisher_live' then 'event'
```

PostgreSQL requires one value per `WHEN` branch for a simple `CASE`. The new
migration uses two explicit `WHEN` branches.

The corrected function was also reviewed and tightened to fail closed for:

- missing actor, self-recipient, unsupported type, invalid resource kind,
  missing resource id, invalid context, and blank/missing dedupe key;
- either-direction block relationships;
- disabled per-user notification preference.

It retains `SECURITY DEFINER` only for trusted trigger producers, a fixed
`search_path = public, pg_temp`, and revoked execution for `public`, `anon`,
and `authenticated`. The migration contains no direct client grant for trusted
event creation and preserves recipient RLS.
