# Task 39 — Cost Analytics

Tracks infrastructure cost drivers (Supabase egress/compute/storage, LiveKit minutes,
storage growth, function invocations) to keep unit economics visible — infra metering, no
user data.

## Architecture
```
usage meters (edge invocations, storage, LiveKit minutes, egress) ──► cost model ──► cost dashboard
```

## Metrics
- Cost per active community/user (aggregate ratios), LiveKit voice-minute spend, storage
  growth (attachments), edge invocation volume, egress; forecast vs budget.

## Data & privacy
- Aggregate infra meters only; no per-user financial profiling. Cost attributed to
  features/services, not identified individuals.

## Database / infra
- `cost_metrics(service, unit, quantity, cost, period)`; sourced from provider usage APIs +
  internal counters.

## APIs / jobs
- Periodic import of usage meters; cost allocation job; budget-alert job.

## Dashboard metrics
- Total + per-service cost, cost-per-active-community trend, top drivers, forecast.

## Tests
- Aggregate only; no per-user PII; allocation sums to total; budget alerts fire.

## Validation checklist
- [ ] infra meters only · [ ] no per-user profiling · [ ] allocation reconciles
- [ ] budget alerts

## Risks / blockers
- Provider meter drift → reconcile against invoices. Uses Warehouse (23), pairs with API
  Usage (40).

**Next:** Task 40 — API Usage Analytics.
