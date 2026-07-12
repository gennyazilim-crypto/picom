# Task 658 Checkpoint: LiveKit Cloud Staging and Production Provisioning

## Result

**PARTIAL PASS - real projects provisioned; production operations gate BLOCKED.**

## Provider/dashboard configuration completed

- Renamed the existing provider project to `Picom Staging`.
- Created a separate `Picom Production` project.
- Confirmed separate public WSS endpoints and project-local API key records.
- Disabled Agent Observability in both projects.
- Kept provider sandbox token server off.
- Verified Build-plan quota: 100 concurrent participants, 2 Egress, 2 Ingress.
- Verified DNS, TCP 443, and HTTPS/TLS for both public endpoints.

## Security

No API key, API secret, participant token, account email, private room identifier, or captured media entered source, terminal output, documentation, screenshots, or Git history.

## Evidence

- `docs/evidence/task-658-livekit-provider-redacted.json`
- `docs/v1-livekit-production-environment.md`
- `docs/v1-livekit-secret-custody.md`

## Checks

| Check | Result |
| --- | --- |
| Staging project exists | PASS_REAL |
| Production project exists | PASS_REAL |
| Separate endpoint/key namespaces | PASS_REAL |
| Observability disabled | PASS_REAL |
| DNS/TLS reachability | PASS_REAL |
| Protected staging secrets | BLOCKED - Task 659 |
| Production plan/cost approval | BLOCKED |
| Region/data-residency approval | BLOCKED |
| Backup ownership | BLOCKED |

## Remaining blockers

- Transfer staging credentials directly into protected Supabase Edge Function secrets without exposing values.
- Create/approve a production Supabase or secret-manager destination.
- Assign backup provider, billing, rotation, incident, and revoke owners.
- Approve global routing or upgrade/request EU region pinning.
- Approve public production capacity/cost limits; Build is staging-only.

## Release effect

Task 658 enables real staging integration work but does not close the V1 release gate. Voice/Screen remains `HIDDEN_FROM_V1` until Tasks 659-667 and the operations blockers pass.