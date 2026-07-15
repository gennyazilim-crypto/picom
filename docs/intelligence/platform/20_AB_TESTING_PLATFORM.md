# Task 20 — A/B Testing Platform

Deterministic experiment assignment + aggregate metric comparison, privacy-safe. Builds on
Feature Flags (Task 21) and Event Bus (Task 22).

## Architecture
```
experiment config ─► deterministic bucketing hash(userId|deviceId, expKey) ─► variant
variant exposure (consented event) ─► warehouse ─► stats engine (per-variant aggregate) ─► results
```

## Assignment
- Stable variant via `hash(subject, experimentKey) % buckets`; no server round-trip needed;
  sticky. Holdouts + mutually-exclusive layers supported.

## Data & privacy
- Exposure logged as a count/label event (variant id only); metrics are aggregate. **No**
  content; identity pseudonymous. Consent required for optional-metric experiments;
  essential UX experiments use no personal data.

## Database
- `experiments(key, variants, allocation, status)`; `experiment_exposure` (aggregate).

## APIs / jobs
- `get_variant(experimentKey)` (client, deterministic); results rollup + significance job.

## Dashboard metrics
- Per-variant conversion/retention (aggregate), significance, sample ratio mismatch (SRM).

## Tests
- Deterministic sticky assignment; even allocation; SRM guard; no content/identity in
  exposure; kill switch stops an experiment.

## Config & deploy
- Experiment config via remote config/flags; kill-switchable.

## Validation checklist
- [ ] deterministic/sticky · [ ] aggregate results · [ ] consent-gated optional metrics
- [ ] SRM guard · [ ] kill-switch

## Risks / blockers
- Peeking/p-hacking → fixed horizons + SRM. Depends on Feature Flags (21), Warehouse (23).

**Next:** Task 21 — Feature Flags.
