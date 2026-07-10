# Blameless postmortem: simulated Auth/message/Realtime outage

## Incident metadata

- Incident: `GD-2026-07-10-01`
- Date/time: 2026-07-10, 10:00–11:00 UTC
- Severity: simulated SEV1
- Affected users: none; tabletop only
- Affected platforms: simulated Windows, Linux and macOS clients
- Systems: simulated backend dependency configuration, Auth/session, message API and Realtime
- Prepared/reviewed by: Scribe/IC placeholders

## User impact

No real user impact occurred. In the scenario, valid users could not sign in/restore sessions, new messages failed or remained retryable, and live updates stopped. Existing local UI/content remained visible. No data loss, private-channel exposure, upload, voice or secret incident was simulated.

## Timeline

See `docs/drills/incident-game-day-2026-07-10.md`. Detection occurred at 10:00, rollout paused at 10:10, leading cause identified at 10:18, simulated rollback at 10:25, core recovery verified by 10:34 and exercise closed at 11:00 UTC.

## Root cause

Exercise root cause: a hypothetical backend configuration release referenced an unavailable staging-like Supabase dependency endpoint shared by Auth, message writes and Realtime.

Why safeguards did not catch it in the scenario:

- deployment validation checked process liveness but not dependency readiness/canary core flows;
- no automatic protected canary verified login, message confirmation and two-client Realtime before rollout;
- production operations ownership/dashboard/alerting remains placeholder-level.

This is a designed exercise cause, not evidence of an actual Picom defect or provider incident.

## Contributing factors

- shared dependency/config blast radius across core flows;
- liveness alone can appear healthy while readiness fails;
- manual placeholder role/escalation roster;
- no real E2E staging runner or production telemetry baseline yet.

## What went well

- SEV1 and roles were established quickly.
- Rollout paused before unrelated changes.
- Team distinguished valid-auth service failures from invalid credentials.
- Security/privacy escalation criteria stayed visible.
- Database rollback was avoided without migration evidence.
- Recovery checks covered login, message idempotency and Realtime reconnect.
- Communications avoided secrets and unsupported data-loss claims.

## What went poorly / gaps

- Roles and contacts are placeholders rather than staffed roster.
- Simulated alerts/dashboards do not prove production detection.
- Rollback permission/access and measured recovery time were not exercised.
- No automated UI/two-client staging E2E evidence.
- SLO targets remain planning placeholders without production telemetry.

## Detection and resolution

Detection method: synthetic exercise alerts for Auth failures, message failures, Realtime disconnects and readiness failure.

Resolution: simulated rollback to known-good dependency configuration, followed by readiness, login/session, message confirmation/clientMessageId and two-client Realtime verification. Rollout remained paused for observation.

## Follow-up actions

| Action | Owner | Due | Priority | Status |
| --- | --- | --- | --- | --- |
| Staff incident escalation roster and backups | Operations placeholder | Before beta-all | P0 | Open |
| Build redacted core-flow dashboards and alerts | Engineering/Operations placeholders | Before stable | P0 | Open |
| Add config validation and protected canary | Engineering placeholder | Before next backend release | P1 | Open |
| Add automated rollback verification after E2E approval | QA placeholder | Post-E2E activation | P1 | Open |
| Run isolated staging resilience/game day | Operations placeholder | Before stable go/no-go | P1 | Open |

## Prevention plan

- Gate deployments on dependency readiness plus synthetic core flows, not liveness alone.
- Version and validate public endpoint/config references before rollout.
- Maintain fail-safe client degraded states and idempotent message recovery.
- Establish monitoring, alert routing, named owners and runbook access.
- Rehearse staging rollback and verification twice before stable.

## Communication and privacy

Only exercise drafts were produced; no user/public message was sent. No private user data, message content, credentials, endpoints, headers, tokens or sensitive screenshots were used. Security sign-off is not required for this tabletop result, but a real data-access/loss signal would escalate to SEV0 immediately.

## Final assessment

Blameless conclusion: the exercise demonstrated a workable coordination sequence while identifying missing operational tooling and staffing. Those gaps are system/process maturity issues, not individual failures.
