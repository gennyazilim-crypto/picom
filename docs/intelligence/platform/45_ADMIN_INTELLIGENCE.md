# Task 45 — Admin Intelligence

Platform-operator moderation & safety console — surfaces T&S signals (risk, fraud, reports)
and moderation workload, integrating with the existing Admin Operations panels.

## Architecture
```
account_risk (35) + fraud_signals (37) + reports/mutes + moderation actions
        └─► admin intelligence views (operator RLS) ──► AdminOperations panels
```

## Metrics / surfaces
- Moderation queue (risk/fraud-ranked), report volume + resolution time, action outcomes,
  repeat-offender clusters, appeal rate, safety SLA. Ties into `AdminOperationsPanel` /
  `AdminOperationsV2Sections` and `adminOperationsService`.

## Data & privacy
- Operator-scoped (highest-privilege RLS), **security legal basis** for risk/fraud data.
  Access is audited (feeds Consent/Compliance audit trails). Content shown only where
  moderation legally requires (reported item review), never bulk content mining.

## Database / infra
- Reuses `account_risk`, `fraud_signals`, report/mute tables + a `moderation_actions` audit
  log; operator-only RLS.

## APIs / jobs
- Queue builder; SLA/metrics rollup; action-audit writer.

## Dashboard metrics
- Queue depth, resolution time, actions/day, precision, appeals.

## Tests
- Operator-only access; every action audited; no bulk content access; adverse actions
  reversible/appealable.

## Validation checklist
- [ ] operator RLS · [ ] actions audited · [ ] security basis · [ ] no bulk content mining
- [ ] appeal path

## Risks / blockers
- Operator over-reach → least-privilege + audit + review. Depends on 35/37, integrates with
  shipped Admin Operations.

**Next:** Task 46 — Root Dashboard.
