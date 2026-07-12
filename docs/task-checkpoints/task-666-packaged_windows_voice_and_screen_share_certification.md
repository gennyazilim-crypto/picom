# Task 666 Checkpoint: Packaged Windows Voice and Screen Share Certification

## Scope

Task 666 binds the active-community-member Voice/Screen policy to an exact
Windows x64 NSIS candidate. The protected certification installs the candidate,
runs the existing four-client hosted Supabase/LiveKit matrix inside the installed
`Picom.exe`, verifies native Electron desktop capture, then removes the temporary
installation and ephemeral hosted fixtures.

## Safety boundary

- The packaged certification runtime is built only when
  `PICOM_BUILD_WINDOWS_MEMBER_MEDIA_CERTIFICATION=CONTROLLED_WINDOWS_ONLY`.
- Runtime activation additionally requires packaged Windows, the exact
  `CONTROLLED_WINDOWS_ONLY` value, inherited FD 3, and a SHA-256 binding.
- Ordinary local, QA, and release builds remove the certification runtime.
- Renderer clients remain sandboxed with `contextIsolation: true` and
  `nodeIntegration: false`.
- Provider credentials never enter the package or renderer. Edge-issued
  participant tokens cross a one-way inherited pipe and are not persisted.
- No raw microphone audio or shared-screen image is recorded or uploaded.

## Required evidence

- Exact installer and installed executable SHA-256 and byte size.
- Silent controlled install, normal packaged restart, and cleanup.
- Real hosted password authentication and RLS-visible Voice channel for a
  roleless active member.
- Owner/Admin/Moderator/Member join, microphone publish, bidirectional RTP,
  mute events, speaking events, reconnect, leave, and track cleanup.
- Native screen and window source inventory, cancel flow, selected window
  capture, four simultaneous shares, remote render, source-ended, and restart.
- Visitor, non-member, and banned denial plus separate moderation hierarchy.

## Honest environment limits

The protected Windows runner uses Chromium's controlled fake microphone device,
so no physical microphone model or user audio is claimed. The artifact records
the actual monitor count and current scale; additional monitors and 125/150%
physical DPI runs are not claimed when the runner does not provide them. This
task does not claim trusted Authenticode signing; final signing remains a later
release gate.

## Validation

- `npm run voice:screen:windows:contract`
- `npm run voice:screen:hosted:contract`
- `npm run voice:screen:hosted:e2e -- --build-only`
- `npm run electron:build` with controlled certification build flag
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- Protected workflow: `Picom Windows Member Voice Screen Certification`

## Status

Source and workflow contract are prepared. Native PASS is recorded only after
the protected Windows run uploads a redacted evidence artifact with
`status=passed`.
