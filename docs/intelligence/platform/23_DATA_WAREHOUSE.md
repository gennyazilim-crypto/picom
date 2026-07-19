# Task 23 — Data Warehouse

Stores **aggregate, pseudonymous** analytics for dashboards and ML features. Never a
content store. Enforces retention (Task 27/09) and anonymization (Task 25).

## Architecture
```
Event Bus (22) ──► staging (raw envelopes, short TTL) ──► transforms ──► aggregate marts
                                                                          (marts = counts,
                                                                           cohorts, funnels,
                                                                           feature store)
```

## Layers
- **Staging**: raw consented envelopes, **short retention** (≤30d, Task 09), pseudonymous.
- **Marts**: daily/weekly aggregates (engagement, retention cohorts, growth funnels,
  community/creator rollups), long retention as aggregates only.
- **Feature store**: content-blind features for ML (Task 24) / recommendations (11/14).

## Data & privacy
- No message/DM/audio/video, no raw IP, no identity join. Pseudonymous keys; small cells
  suppressed (k-anonymity, Task 25). Aggregates are non-reversible.

## Database / infra
- Supabase Postgres schemas `staging.*` / `marts.*` with partitioning + TTL jobs; RLS locks
  raw to service-role, marts to operator/admin roles.

## APIs / jobs
- Transform/rollup jobs (scheduled); mart-read RPCs for dashboards (role-scoped).

## Dashboard metrics
- Row counts by layer, freshness/lag, retention-job success, suppression counts.

## Tests
- Staging TTL enforced; marts contain no identity/content; k-suppression; transform
  idempotency.

## Validation checklist
- [ ] staging short-TTL · [ ] marts aggregate-only · [ ] no content/identity/raw-IP
- [ ] k-anonymity · [ ] role-scoped

## Risks / blockers
- Cost/scale of Postgres-as-warehouse → partition + TTL; external OLAP later if needed.
  Depends on Event Bus (22), Anonymization (25), Retention (27).

**Next:** Task 24 — ML Pipeline.
