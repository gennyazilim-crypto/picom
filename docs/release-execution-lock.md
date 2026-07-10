# Picom Release Execution Lock

Status date: 2026-07-10  
Decision: **Not ready for public stable distribution**

Picom is now locked to release execution. Product feature development is paused until the stable gates below are either passed with evidence or explicitly removed from the release promise. The local Electron application, mock mode, type system, build pipeline, desktop shell, and prepared Supabase/LiveKit contracts are strong enough for controlled internal validation. They are not substitutes for hosted and platform evidence.

## Locked release scope

- Electron desktop application for Windows, Linux, and macOS.
- Auth, onboarding, Mention Feed, profiles, communities, channels, messaging, image attachments, role-aware access, DMs, settings, diagnostics, LiveKit voice, and explicit screen sharing.
- No mobile UI, public marketplace, production plugin runtime, enterprise suite, billing, E2EE claim, or production auto-update claim.

## Release blocker classification

| Class | Meaning | Current handling |
| --- | --- | --- |
| Release blocker | Stable distribution must not proceed | Tracked in `docs/release-blockers.md` |
| High priority non-blocker | Can ship only with explicit known-issue acceptance | Tracked below and in release notes |
| Post-launch | Valuable after stable launch | Prioritized in `docs/post-launch-backlog-prioritized.md` |
| v4 backlog | Future product/platform work | Deferred without release commitment |
| Rejected / not now | Outside locked scope | Do not implement during release execution |

## Current readiness

- Local TypeScript/build/mock checks: ready for execution gate.
- Electron source/configuration: locally prepared; packaged runtime needs platform evidence.
- Supabase: contracts and local/static smoke tests exist; hosted production-like RLS/Storage/Realtime/Edge evidence is missing.
- LiveKit/screen sharing: implementation and smoke contracts exist; real two-client/device/platform certification is missing.
- Packaging: Windows configuration exists; clean-machine evidence is missing. Linux and macOS require native runners. Signing/notarization is not complete.
- Legal/operations: documentation exists, but legal review, restore drill, production environment ownership, and named sign-offs are incomplete.

## Change control

Until a Go decision:

1. Fix release blockers only.
2. Do not add product features or redesign UI.
3. Record every gate as Passed, Failed, or Skipped/Blocked with evidence.
4. Never convert missing hosted/platform evidence into a pass.
5. Do not distribute artifacts while `docs/stable-go-no-go.md` is No-Go.

## Exact next 10 tasks

1. Task 352: confirm and fix only locally actionable critical blockers.
2. Task 353: run final full regression QA and record skipped manual surfaces.
3. Task 354: validate hosted Supabase/RLS/Storage/Realtime/Edge or keep the gate blocked.
4. Task 355: validate LiveKit with two real clients/devices or keep the gate blocked.
5. Task 356: certify screen share on Windows, Linux, and macOS.
6. Task 357: produce and smoke-test a Windows candidate.
7. Task 358: produce and smoke-test Linux artifacts on Linux.
8. Task 359: produce, sign/notarize, and smoke-test macOS artifacts on macOS.
9. Task 360: execute the selected RC artifact smoke matrix.
10. Task 361: close the final security/RLS/permission gate.

Task 352 is a blocker validation/fix pass, not release-candidate preparation.
