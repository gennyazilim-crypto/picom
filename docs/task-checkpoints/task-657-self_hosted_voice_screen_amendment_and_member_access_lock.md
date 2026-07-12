# Task 657 Checkpoint: Self-Hosted Voice Screen Amendment and Member Access Lock

## Result

**COMPLETE - SELF_HOSTED_LIVEKIT architecture locked; Voice/Screen remains IN_V1.**

## Decisions

- Replaced the previous LiveKit Cloud operating dependency with Picom-controlled self-hosting.
- Preserved historical Cloud checkpoints without treating them as current self-hosted release evidence.
- Kept Voice Rooms and Screen Share visible in the V1 registry and feature flags.
- Separated product inclusion from public-release readiness.
- Locked development, staging, and production environment separation.
- Locked ordinary media access to authenticated active community membership.
- Kept moderation role/hierarchy controlled.
- Kept recording/Egress, SIP, Ingress, camera meetings, captions, AI summaries, external livestreaming, and cloud-only enhanced filtering out of scope.

## Security

Provider, Redis, TURN, TLS, SSH, Supabase, and signing secrets remain outside source, renderer, packages, diagnostics, evidence, and Git history.

## Evidence

- docs/self-hosted-livekit-amendment.md
- docs/community-member-media-policy.md
- src/config/voiceInfrastructureContract.ts
- scripts/self-hosted-livekit-architecture-contract.mjs

## Remaining blockers

Tasks 658-673 must produce real self-hosted infrastructure and native evidence. Task 674 confirms inclusion; Tasks 675-676 own immutable RC and final Go/No-Go. No public release is authorized by Task 657.

## Validation

- Self-hosted architecture contract
- V1 core scope contract
- TypeScript
- Mock smoke
