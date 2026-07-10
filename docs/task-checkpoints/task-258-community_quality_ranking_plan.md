# Task 258 checkpoint: community quality ranking plan

- Defined an opt-in eligibility gate that excludes private, invite-only, unreviewed and held communities before ranking.
- Limited future signals to aggregate sustainable activity, retention, report/safety, moderation-health and listing-reliability bands.
- Separated private Community Health insights from public Discovery ranking and prohibited invasive user profiling/private content.
- Added cold-start fairness, anti-gaming, owner transparency, re-review, telemetry and kill-switch requirements.
- No ranking algorithm, analytics, UI, schema, dependency or runtime behavior was implemented.

Validation: a local documentation contract check verified all required aggregate signals, opt-in/private-community rules, privacy prohibitions and rollout controls. Typecheck, mock smoke and build were skipped because this task is documentation-only.
