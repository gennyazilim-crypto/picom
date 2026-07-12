# Meeting Workspace Known Issues

Status date: 2026-07-11

| ID | Severity | State | Issue | Required closure |
| --- | --- | --- | --- | --- |
| MTG-KI-01 | P0 | BLOCKED | Protected hosted RLS/private-resource matrix has not executed for all meeting roles. | Run Task 577 against approved staging with synthetic owner/admin/mod/member/visitor/guest/blocked identities and revoke temporary access. |
| MTG-KI-02 | P0 | BLOCKED | Deployed meeting-token, signed webhook, private Realtime, and audit-log behavior lack hosted evidence. | Deploy the release-scoped endpoints, execute positive/negative/replay/deduplication cases, and retain redacted run references. |
| MTG-KI-03 | P0 | BLOCKED | Real two-client audio/video/screen-share/reconnect/cleanup has not passed. | Execute Task 575 with two isolated clients, real devices, controlled network interruption, and no raw-media retention. |
| MTG-KI-04 | P0 | BLOCKED | Twelve-person camera/voice/share/stage capacity and provider quota/cost have not run. | Execute Task 576 in isolated staging and record latency, subscription, memory, rejection, quota, and cost results. |
| MTG-KI-05 | P0 | BLOCKED | Windows meeting workspace is not certified. | Test the exact trusted, timestamp-signed candidate on controlled supported Windows hardware with a distinct remote client. |
| MTG-KI-06 | P0 | BLOCKED | Linux AppImage/DEB meeting workspace is not certified. | Build on Linux and exercise Wayland and X11, PipeWire/portal, native devices, remote share, install, and uninstall. |
| MTG-KI-07 | P0 | BLOCKED | macOS meeting workspace is not signed/notarized/native-certified. | Sign nested code, notarize and staple DMG/ZIP, verify Gatekeeper/quarantine/TCC, and execute the 27-flow matrix. |
| MTG-KI-08 | P0 | OPEN | A clean clone lacks the tracked `assets/brand/picom-logo.png` imported by `RegisterScreen`. | Commit the approved user-owned asset or correct the import, then run an unmodified clean-clone build. |
| MTG-KI-09 | P1 | PROVIDER GATED | Captions code and privacy controls are complete, but no transcription provider is configured. | Keep captions disabled/unadvertised or configure an approved server-side provider and run consent, isolation, retention, and deletion evidence. |
| MTG-KI-10 | P1 | WARNING | Initial CSS is 235.1 KiB versus the 180 KiB target; hard cap 240 KiB still passes. | Consolidate legacy/component CSS and preserve visual regression coverage. |
| MTG-KI-11 | P1 | WARNING | Total renderer assets are 3404.0 KiB versus the 2800 KiB target; hard cap 3500 KiB still passes. | Continue feature-level splitting and asset optimization without raising the cap. |
| MTG-KI-12 | P1 | OPEN | No independent adversarial review or native assistive-technology pass exists. | Run authorized security review and keyboard/screen-reader/reduced-motion checks on packaged native candidates. |

## User-facing policy

- Do not advertise hosted production readiness, platform certification, captions availability, recording, AI summaries, breakout rooms, virtual backgrounds, or livestreaming.
- Do not expose unavailable controls as placeholders.
- Do not convert a local contract PASS into a hosted/native PASS.
- Do not publish until the stable Go/No-Go gate is rerun with immutable artifacts and all mandatory blockers closed or formally accepted.
