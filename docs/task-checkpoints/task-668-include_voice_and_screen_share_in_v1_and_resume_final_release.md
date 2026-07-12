# Task 668 Checkpoint: Include Voice and Screen Share in V1

## Decision

**INCLUDED**

Voice Rooms and Screen Share are included for every authenticated active community member. Visitors, non-members, removed, banned, and suspended users remain denied. Ordinary access is independent of Owner/Admin/Moderator/custom roles; moderation remains separate.

## Evidence

- Task 661 token deployment: run 29194842117, passed.
- Task 665 hosted four-client matrix: run 29197503222, passed.
- Task 666 packaged Windows certification: run 29198913461, passed.
- Task 667 security/reliability gate: run 29199409039, passed.
- Evidence artifacts reported containsSecrets=false and no raw media storage.

## Runtime/release changes

- Central scope and public/local feature flags now include Voice/Screen.
- Channel, route, Settings, Help, diagnostics, and Connected Voice gates resolve enabled.
- livekit-token and livekit-moderation are authenticated release functions.
- livekit-webhook is an internal signature/body-hash/idempotency guarded release function.
- Release copy and support matrix distinguish technical inclusion from public-release authorization.

## Validation

The Task 668 commit is allowed only after the complete local Voice/Screen, Edge, V1 scope, legal truthfulness, typecheck, mock, build, QA, and performance matrix passes.

## Remaining blockers

Trusted signing, clean physical-device/multi-monitor coverage, legal approval, production ownership/capacity, immutable RC, and final Go/No-Go remain open. No public release is authorized by this checkpoint.

## Handoff

Resume Task 655 and then Task 656. Task 656 must fail closed while any independent public-release blocker remains.
