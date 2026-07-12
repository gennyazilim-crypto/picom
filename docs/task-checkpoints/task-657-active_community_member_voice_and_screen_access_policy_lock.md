# Task 657 Checkpoint: Active Community Member Voice and Screen Access Policy Lock

## Result

**COMPLETE - policy locked; feature remains HIDDEN_FROM_V1.**

## Canonical product decision

- Every authenticated active community member may discover Voice channels, join, speak, listen, share a selected screen, and receive remote shares.
- Owner/Admin/Moderator/custom-role grants are not required for ordinary media access.
- Visitors, pending/non-members, removed, banned, suspended, and explicitly blocked users remain denied.
- Remote mute/remove/ban/end-room remain role- and hierarchy-controlled.

## Audit findings

- Renderer join/audio/screen controls currently repeat role permission checks.
- Task 645 SQL currently derives discovery, join, audio, screen, and private Voice access from role/channel overrides.
- Legacy Voice and meeting migrations contain additional role-specific ordinary media decisions.
- Release scope and function manifest correctly remain hidden because real provider, hosted, and packaged-Windows evidence is not complete.

## Files

- `docs/v1-community-member-media-policy.md`
- `docs/v1-voice-screen-amendment.md`
- `docs/v1-voice-screen-scope-lock.md`

## Validation

Documentation-only policy task. Repository references were audited; no runtime, migration, release flag, or provider setting was changed. Build tests are intentionally deferred to implementation tasks because they cannot validate a policy-only change.

## Provider/dashboard work

None in Task 657. Real provider provisioning begins in Task 658.

## Evidence classification

| Gate | Result |
| --- | --- |
| Active-member policy | PASS_LOCAL |
| Conflicting role gates inventoried | PASS_LOCAL |
| Moderation separation | PASS_LOCAL |
| Provider projects | BLOCKED - Task 658 |
| Hosted environment | BLOCKED - Task 659 |
| Hosted two-client media | BLOCKED - Task 665 |
| Packaged Windows media | BLOCKED - Task 666 |
| V1 inclusion | HIDDEN / NOT DECIDED |

## Next task

Task 658 must provision dedicated LiveKit Cloud staging and production projects and record redacted provider evidence without exposing secret values.

