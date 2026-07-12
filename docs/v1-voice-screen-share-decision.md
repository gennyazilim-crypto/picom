# Picom V1 Voice and Screen Share Decision

Decision: **INCLUDED**
Decision date: 2026-07-12
Authority: Task 668

## Evidence

| Gate | Evidence | Result |
| --- | --- | --- |
| Hosted active-member authorization and four-client media | GitHub Actions run 29197503222 | PASS |
| Packaged Windows install, native picker, four shares, remote render, reconnect, cleanup | GitHub Actions run 29198913461 | PASS |
| Security, abuse, rate limit, reconnect, leak, and cleanup gate | GitHub Actions run 29199409039 | PASS |

The protected matrix proves Owner, Admin, Moderator, Member, and roleless active-member access; visitor, non-member, banned, and suspended denial; four microphone publishers; four simultaneous Screen Share publishers; remote audio and screen rendering; reconnect; and cleanup.

## Included policy

Every authenticated active community member may see Voice channels, join, publish microphone audio, start a user-selected Screen Share, and subscribe to remote media. Ordinary access does not depend on role or channel overrides. Moderation remains separate and hierarchy controlled.

## Runtime alignment

- voiceRooms and screenShare are IN_V1 in the central registry.
- Local and hosted public feature flags are enabled.
- Channel visibility, authenticated Voice routes, Settings, Help, diagnostics, and Connected Voice surfaces consume the central gate.
- livekit-token, livekit-moderation, and signature-verified livekit-webhook are release-scoped.
- Provider keys and participant tokens never enter renderer source, diagnostics, or release evidence.

## Honest limitations

The Windows certification used a controlled Chromium microphone and one 100-percent-scale monitor. It does not claim physical microphone hardware, multi-monitor, 125/150-percent DPI, trusted signing, or fresh provider-side mute/remove/end execution. Legal approval, production ownership/capacity, signing, clean-machine, and immutable RC gates remain public-release blockers.

## Handoff

Task 668 authorizes resuming Task 655 for the final immutable RC and then Task 656 for final Go/No-Go. Task 656 must remain No-Go until every independent public-release blocker is closed.
