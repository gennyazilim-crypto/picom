# Database Connection Pooling Plan

Picom currently uses Supabase as the MVP backend for Auth, Postgres, RLS, Storage, Realtime, and Edge Functions. The Electron renderer must not receive direct database credentials or `DATABASE_URL`.

This plan documents current assumptions and the future connection-pooling path if Picom adds a long-running backend, worker, or Prisma-based service.

## Current behavior

- Renderer uses Supabase client with renderer-safe URL and anon key only.
- RLS is the security boundary for direct Supabase access.
- No `DATABASE_URL` is present in `.env.example` because the desktop renderer must not connect directly to Postgres.
- No Prisma runtime is currently configured in the renderer path.
- Supabase managed infrastructure handles the primary Postgres connection path for MVP features.

## Prisma connection behavior placeholder

If a Prisma backend is introduced later:

- Prisma should run only in server/Edge/serverless-safe backend contexts, never in the Electron renderer.
- Prisma connection pooling must be configured through server-only environment variables.
- Prisma migration commands should use a controlled migration connection, not a renderer bundle.
- Prisma Client lifecycle should avoid creating a new client per request in long-running Node backends.

## Development configuration

- Local development should use Supabase local/staging credentials only in server-side env files.
- `.env.example` remains renderer-safe and placeholder-only.
- Local database URLs, if added later, belong in non-committed server `.env.local` files.
- Keep local pool sizes small to avoid exhausting developer machines.

## Production configuration placeholder

Future production backend should define:

- `DATABASE_URL` for pooled application traffic.
- `DIRECT_DATABASE_URL` or equivalent for migrations only if the provider requires it.
- Max connection settings based on provider limits.
- Pool timeout and idle timeout defaults.
- Separate credentials for app runtime, migrations, and read-only maintenance if supported.

No risky production values are hardcoded in this repository.

## Max connections placeholder

Initial planning values for a future long-running backend:

| Component | Placeholder max connections | Notes |
| --- | ---: | --- |
| API backend instance | 5-10 | Scale with instance count and provider limits. |
| Background worker | 2-5 | Jobs should be batched and bounded. |
| Migration process | 1 | Run separately from live traffic. |
| Read-only integrity checks | 1-2 | Prefer replicas/low traffic windows when available. |
| Realtime gateway | Provider-managed | Supabase Realtime should not consume app DB pool unexpectedly. |

These are placeholders and must be replaced with provider-specific capacity planning.

## Pooling provider placeholder

Options to evaluate later:

- Supabase connection pooler.
- PgBouncer managed by provider.
- Prisma Data Proxy/Accelerate if Prisma is adopted and licensing/architecture fit.
- Direct Postgres only for migrations or trusted maintenance tasks.

## Serverless vs long-running backend

Serverless/Edge:

- Risk: too many cold starts can exhaust database connections.
- Prefer provider pooler or HTTP APIs where possible.
- Keep functions short-lived and avoid long transactions.

Long-running backend:

- Reuse connection pools per process.
- Limit per-instance max connections.
- Monitor pool saturation and query latency.

## Migration connection behavior

- Run migrations from controlled CI/ops environment.
- Verify backup before risky migrations.
- Do not run migrations from desktop clients.
- Use a migration-specific connection only if required by provider/tooling.
- Keep realtime clients compatible with schema changes during rollout.

## Realtime/backend worker usage

- Supabase Realtime is provider-managed for MVP.
- Future Redis/realtime adapters should not use Postgres as a high-frequency pub/sub bus.
- Background jobs should batch reads/writes and avoid holding connections during external calls.
- Integrity and cleanup jobs should be read-only/dry-run by default.

## Failure symptoms

- `/health/ready` fails database dependency check.
- Auth works but messages/communities fail to load.
- Query timeout or connection acquisition timeout errors increase.
- Migration commands hang waiting for connections.
- Realtime appears delayed because database writes are slow.
- Upload metadata writes fail while object storage itself is healthy.

## Monitoring queries placeholder

Adapt to the provider and permissions available:

```sql
-- Active connections by state
select state, count(*) from pg_stat_activity group by state;

-- Long-running queries
select pid, state, now() - query_start as age, wait_event_type, wait_event
from pg_stat_activity
where query_start is not null
order by age desc
limit 20;

-- Database size placeholder
select pg_database_size(current_database());
```

Do not expose query text publicly if it may contain sensitive values.

## Related documents

- `docs/production-deployment-checklist.md`
- `docs/database-restore-drill.md`
- `docs/data-corruption-detection.md`
- `docs/rollback-runbook.md`
- `docs/slo.md`
