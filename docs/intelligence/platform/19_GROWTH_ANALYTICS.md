# Task 19 — Growth Analytics

Acquisition → activation → retention → referral funnels, aggregate/pseudonymous. Extends
[../ANALYTICS_DASHBOARD.md](../ANALYTICS_DASHBOARD.md).

## Architecture
```
consented lifecycle/download/community events ──► Event Bus ──► warehouse rollups
   ▼
funnel + cohort engine ─► Growth dashboard (AARRR)
```

## Metrics
- Acquisition: installs, sources (no PII). Activation: install→first session→first
  community. Retention: N-day cohort curves. Referral: invite→join conversion. Resurrection.

## Data & privacy
- Count/bucket events only; cohorts = signup-week buckets; **no** identity or content;
  k-anonymity suppression for small cells (Task 25).

## Database
- Warehouse (Task 23) aggregate tables; no new raw PII.

## APIs / jobs
- Operator dashboard reads aggregates; rollup jobs daily/weekly.

## Dashboard metrics
- AARRR funnel, cohort heatmaps, channel mix, conversion rates.

## Tests
- Funnel math on synthetic data; suppression below k; no identity fields.

## Validation checklist
- [ ] aggregate/pseudonymous · [ ] k-anonymity suppression · [ ] no content/identity · [ ] observable

## Risks / blockers
- Attribution needs source tagging without PII. Depends on Warehouse (23), Anonymization (25).

**Next:** Task 20 — A/B Testing Platform.
