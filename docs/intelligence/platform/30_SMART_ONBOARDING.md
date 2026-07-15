# Task 30 — Smart Onboarding

Measures and improves the first-run experience (funnel completion, time-to-first-value)
without profiling the user — aggregate step conversion only.

## Architecture
```
onboarding_step (stepId, outcome, Task 02) ──► funnel rollup ──► onboarding dashboard
                                                     └─► variant/step tuning signals
```

## Metrics
- Step-by-step completion/drop, time-to-first-value (join community / send first message),
  first-launch card interactions (notifications card, DND), abandonment point.

## Data & privacy
- Step ids + outcomes only; no content, no per-user profiling. First-launch setup still
  **never requests native/media permission** (enforced by existing smoke) — this only
  measures the funnel, it does not change the no-permission-at-startup rule.

## Database / infra
- `onboarding_events(session, step_id, outcome, ts)`; aggregates in marts.

## APIs / jobs
- Funnel rollup; cohort completion by acquisition (aggregate).

## Dashboard metrics
- Funnel chart, TTFV distribution, biggest drop step.

## Tests
- No permission requested at startup (reuse existing assertion); aggregate step counts;
  no content/profiling.

## Validation checklist
- [ ] no startup permission prompt · [ ] step ids/outcomes only · [ ] aggregate
- [ ] no per-user profiling

## Risks / blockers
- Over-instrumenting onboarding → keep to key steps. Uses Growth Analytics (19).

**Next:** Task 31 — Content Quality Scoring.
