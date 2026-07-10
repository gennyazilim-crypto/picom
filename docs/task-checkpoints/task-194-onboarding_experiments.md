# Task 194 Checkpoint: Onboarding Experiments

- Added a typed, default-off `enableOnboardingExperiment` flag.
- Added deterministic control/guided assignment with a staging override.
- Preserved all five desktop steps and existing optional Skip actions.
- Recorded only aggregate started/completed counts per variant in local storage.
- Excluded user identifiers, profile values, invite codes, choices, follows, timestamps, and step-level tracking.
- Documented ethical guardrails, rollback, and a results template without claiming outcomes.

Validation: `npm run onboarding:experiments:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
