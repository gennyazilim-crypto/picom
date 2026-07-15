# Task 28 — Search Analytics

Improves search **without storing query text**. Only result-count buckets, zero-result
rate, and refinement patterns — never the words users type.

## Architecture
```
search_performed (resultBucket, Task 02) ──► warehouse ──► search dashboards + tuning signals
```

## Metrics
- Searches per session, **zero-result rate**, result-bucket distribution, refinement rate
  (searched-again within window), abandonment.

## Data & privacy
- **Query text is Forbidden** and never collected. Only buckets/counts/timings. No linkage
  to user identity or content.

## Database / infra
- Reuse `search_performed`; aggregates in marts. No query-text column exists anywhere.

## APIs / jobs
- Rollup job; dashboard read.

## Dashboard metrics
- Zero-result rate trend, search volume, refinement/abandonment.

## Tests
- Assert no query-text field is present in any event/table; buckets only; aggregate.

## Validation checklist
- [ ] no query text collected/stored · [ ] buckets/counts only · [ ] aggregate/pseudonymous

## Risks / blockers
- Tuning without query text is coarser → complement with explicit "no results?" feedback
  (no free text). Depends on schema (Task 02).

**Next:** Task 29 — Notification Intelligence.
