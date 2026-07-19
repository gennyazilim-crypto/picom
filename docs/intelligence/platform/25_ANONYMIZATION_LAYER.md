# Task 25 — Anonymization Layer

Cross-cutting service guaranteeing that everything reaching the warehouse/dashboards is
pseudonymous or anonymous, with k-anonymity suppression and salted hashing.

## Architecture
```
Event Bus (22) ──► anonymization gate ──► warehouse (23)
   - drop/deny content & identifier fields (defense in depth)
   - salted-hash quasi-identifiers (IP→bucket, device→bucket)
   - generalize (timestamps→buckets, geo→region-off, counts→ranges)
   - k-anonymity suppression on marts (< k → suppressed/rolled up)
```

## Techniques
- **Pseudonymization**: stable salted hashes for device/session (never reversible to IP).
- **Generalization/bucketing**: durations, sizes, counts, hours as buckets (already in
  schema).
- **Suppression**: any aggregate cell below `k` (default 20) is suppressed or merged.
- **Salt management**: server-side secret salt, rotated; never shipped to renderer.

## Data & privacy
- Removes direct identifiers; blocks content entirely; ensures marts are non-reversible.
  Special-category data is never present to anonymize.

## Database / infra
- Applied in the ingest/transform path (Task 22/23). `k_threshold` in config.

## APIs / jobs
- Transform functions; a re-identification-risk check job flags low-k cells.

## Dashboard metrics
- Suppressed-cell count, k-distribution, reject count by rule.

## Tests
- Identifier/content fields dropped; hashing salted + non-reversible; sub-k cells suppressed;
  no raw IP/geo persisted.

## Validation checklist
- [ ] no direct identifiers in marts · [ ] salted non-reversible hashing · [ ] k-anonymity
- [ ] content blocked · [ ] salt server-only

## Risks / blockers
- Re-identification via combination → conservative k + generalization. Central dependency
  for Warehouse (23), Growth (19), all analytics.

**Next:** Task 26 — Realtime Analytics.
