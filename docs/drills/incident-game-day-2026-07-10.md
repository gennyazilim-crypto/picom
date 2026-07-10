# Incident game day: simulated Auth/message/Realtime outage

## Exercise control

- Date: 2026-07-10
- Type: tabletop simulation only
- Environment: document/synthetic; no network or service changes
- Scenario ID: `GD-2026-07-10-01`
- Initial severity: SEV1
- User impact: simulated only; no real users, data, credentials or providers
- Runbook: `docs/incident-response.md`

## Assigned roles

- Incident Commander: IC placeholder
- Engineering/Auth owner: Engineering placeholder
- Realtime/Messaging owner: Realtime placeholder
- Operations/Supabase owner: Operations placeholder
- Security observer: Security placeholder
- Support/Product communications: Communications placeholder
- Scribe: Scribe placeholder

In a real drill, named people, primary/backup contacts and a private incident channel must be assigned before start.

## Scenario

At 10:00 UTC synthetic monitoring reports:

- valid login/session restore failure rate rises above the planned alert threshold;
- message inserts fail or remain optimistic/failed;
- Realtime clients disconnect and cannot recover;
- `/health/live` remains healthy while `/health/ready` is simulated unhealthy;
- no evidence of private-data access, data loss, secret exposure, upload or LiveKit impact.

Hidden exercise cause supplied to facilitator: a hypothetical backend configuration release points Auth/message/Realtime dependencies to an unavailable staging project. No migration was applied.

## Success criteria

- classify SEV1 and assign roles within 10 minutes;
- pause rollout and avoid unsafe database rollback;
- identify shared configuration/dependency hypothesis within 20 minutes;
- choose safe rollback to known-good config and verify core flows;
- provide plain-language draft communication without infrastructure/secrets;
- preserve redacted timeline and produce blameless postmortem/actions.

## Timeline

| Time UTC | Simulated event/action | Owner | Result |
| --- | --- | --- | --- |
| 10:00 | Facilitator injects valid-login, message-send and Realtime failure alerts | Facilitator | Exercise starts |
| 10:02 | Scribe opens incident record; IC placeholder accepts command | Scribe/IC | Roles and SEV1 recorded |
| 10:04 | Operations checks simulated live/ready split and recent release/config history | Operations | Process live, dependency readiness failed |
| 10:06 | Engineering separates invalid-credential errors from provider/unavailable errors | Engineering | Valid-user failures classified as service-side |
| 10:08 | Realtime owner confirms disconnect/reconnect failures and no unauthorized room/event evidence | Realtime | Realtime impact confirmed; no privacy escalation |
| 10:10 | IC pauses beta/stable rollout and all unrelated deploy/migration/job changes | IC | Blast radius frozen |
| 10:12 | Communications drafts status: sign-in and live messaging unavailable; failed text remains recoverable | Communications | Draft only; no real publication |
| 10:15 | First-15-minute checklist reviewed; Security keeps SEV0 escalation watch | IC/Security | Checklist complete |
| 10:18 | Team correlates all failures with hypothetical dependency endpoint/config change | Engineering/Operations | Leading hypothesis established |
| 10:22 | Decision: roll back config/release, not database; retain degraded banner and avoid retry storm | IC | Mitigation selected |
| 10:25 | Facilitator marks known-good config restored | Facilitator | Simulated dependency recovery begins |
| 10:28 | Ready health recovers; new login and session restore synthetic checks pass | Operations/Engineering | Auth recovery verified |
| 10:31 | One message send confirms and reconciles clientMessageId; failed message remains retryable | Engineering | No duplicate in simulation |
| 10:34 | Two-client Realtime smoke reconnects once; message echo/presence resume | Realtime | Live update recovery verified |
| 10:38 | Windows/Linux/macOS startup impact reviewed; no desktop release rollback required | Desktop owner placeholder | Existing clients compatible |
| 10:42 | Monitoring window begins; rollout remains paused | IC | No immediate re-release |
| 10:50 | Communications drafts recovery update and support guidance | Communications | Draft only |
| 11:00 | First-hour checklist complete; incident simulated resolved, postmortem required | IC | Exercise ends |

## First 15 minutes review

- Incident type/start/platform/severity: recorded.
- Live/readiness: simulated live pass/readiness fail.
- Supabase/provider/release/migration history: simulated endpoint/config change identified; no migration.
- Rollout/kill switch: rollout paused; no unrelated kill switch needed.
- Redacted timeline: maintained.
- Roles: assigned placeholders.

Gap: there is no real staffed escalation/contact roster or production dashboard/alert route.

## First hour review

- Shared backend dependency/config classified.
- Mitigation was known-good config rollback, not unsafe DB rollback.
- Auth/message/realtime verification was specified.
- User communication drafts were clear and non-technical.
- Rollout stayed paused for observation.
- Postmortem/actions created.

## Simulated communication

Initial draft:

> Picom is experiencing sign-in and live messaging issues. Existing app content may remain visible, but new messages can fail or update late. Failed message text should remain available to retry. We are working to restore service.

Recovery draft:

> Sign-in and live messaging have recovered. We are monitoring stability and keeping the rollout paused while we review the incident. If a message failed, retry it once after confirming your connection.

No passwords, tokens, user IDs, community/channel names or provider internals are included.

## Decisions

- SEV1 was appropriate because Auth and core messaging were simulated unavailable.
- No SEV0 escalation because no data access/loss/security evidence existed; Security remained engaged.
- Database rollback was explicitly rejected because no migration/data corruption was implicated.
- Existing desktop update was not rolled back because scenario cause was backend configuration and clients remained compatible.
- Rollout remained paused after recovery pending observation and go/no-go review.

## Exercise result

Result: **Pass with operational gaps.** The runbook supported classification, mitigation, verification and communication. This tabletop did not prove actual alerts, provider access, rollback permissions, endpoint restore time, dashboards, two-client staging behavior or paging/on-call readiness.

## Actions

| Action | Owner placeholder | Due placeholder | Priority |
| --- | --- | --- | --- |
| Assign named IC/engineering/ops/security/support primary and backup roster | Operations | Before beta-all | P0 |
| Create production-safe Auth/message/Realtime dashboard and alert routing | Engineering/Operations | Before stable | P0 |
| Add config endpoint validation/canary before deployment | Engineering | Before next backend release | P1 |
| Automate post-rollback staging core-flow verification | QA | After E2E runner approval | P1 |
| Run the scenario against isolated staging using approved resilience drill | Operations | Before stable go/no-go | P1 |
