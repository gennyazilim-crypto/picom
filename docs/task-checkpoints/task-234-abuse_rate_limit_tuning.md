# Task 234 checkpoint: abuse rate-limit tuning

- Retained current server limits because representative beta/post-launch data is absent.
- Added auth/message/upload/invite/webhook/bot evidence matrix, privacy-safe aggregates, false-positive guardrails, canary and rollback process.
- Candidate ranges are explicitly unconfigured hypotheses; no runtime/schema change.
- Validation: `npm run abuse:rate-limit:tuning:smoke`, `npm run abuse:events:smoke`.
