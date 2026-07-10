# Task 131 - Experimentation Governance

## Result

Completed as documentation only. Picom now distinguishes rollout flags from experiments and defines proposal, approval, privacy, consent, assignment, metric, no-dark-pattern, rollout, analysis, rollback, and cleanup rules.

## Changed files

- `docs/product/experimentation-governance.md`
- `docs/task-checkpoints/task-131-experimentation-governance.md`

## Verification

- `npm run typecheck`
- `npm run mock:smoke`

No experiment runtime, assignment service, analytics provider, or UI change was added. Production experimentation remains disabled until all documented gates are met.
