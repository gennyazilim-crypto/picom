# Post-MVP Production Audit

Date: 2026-07-10  
Version reviewed: `0.1.1-beta.1`  
Target: Electron desktop for Windows, Linux, and macOS  
Decision: **Not ready**

## Executive decision

Picom has a healthy compile/build foundation and substantial production-oriented architecture, but it is not ready for a stable public production release. A diagnostics redaction quality gate currently fails, and several security- and platform-critical controls have only structural or documentation-level evidence rather than staging/production evidence.

This decision does not block local development or a tightly controlled internal beta. It blocks stable promotion until every release blocker below has an owner, evidence, and a passing result.

## Evidence collected

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| TypeScript | Pass | `npm run typecheck` |
| Mock mode | Pass | `npm run mock:smoke` |
| Renderer/Electron build | Pass | `npm run build`; Vite reports a large-chunk warning |
| Packaging configuration | Pass | `npm run package:verify` |
| Windows artifact presence | Partial | Local `0.1.1-beta.1` installer exists; install, signature, provenance, and clean-machine execution were not re-certified in this audit |
| Supabase schema | Structural pass | `npm run supabase:smoke`; Supabase CLI unavailable, so reset/migration/pgTAP/RLS execution was not performed |
| LiveKit | Structural pass | `npm run livekit:smoke`; no real two-client or three-platform media session was run |
| Attachment quarantine | Pass | `npm run attachments:quarantine:smoke`; no production malware scanner provider is configured |
| Realtime ordering | Pass | `npm run realtime:ordering:smoke`; no hosted load/partition test was run |
| Diagnostics redaction | **Fail** | `npm run diagnostics:smoke` reports missing `password` redaction evidence |
| Third-party notices | Pass | `npm run licenses:smoke`; final legal approval remains external |
| Accessibility settings | Structural pass | `npm run accessibility:display:smoke`; no manual keyboard/screen-reader/platform certification |
| Bundle budget | Pass with warning | `npm run bundle:size:smoke`; main renderer output is about 998 kB minified and Vite warns above 500 kB |

## Release blockers

1. **Diagnostics redaction gate fails.** Resolve the `diagnostics:smoke` failure and prove that passwords, tokens, cookies, authorization values, and secrets cannot enter support exports.
2. **RLS has not been executed against a disposable/staging Supabase project.** Install/use the Supabase CLI, apply all migrations from a clean database, run pgTAP/RLS suites, and retain results for owner/admin/member/visitor/adversarial cases.
3. **Attachment malware scanning is not production-operational.** Supabase uploads intentionally remain `pending` and unavailable without a trusted scanner. Configure a scanner worker/provider, signed service authentication, retry/dead-letter behavior, and quarantine review evidence.
4. **Real LiveKit certification is missing.** Run two-client voice, reconnect, device switching, mute/deafen, screen share, permission denial, and degraded-network tests on Windows, Linux, and macOS.
5. **Release artifacts are not fully certified.** Produce clean Windows/Linux/macOS candidates, sign/notarize them, verify checksums/provenance, install on clean machines, and execute rollback/update-channel checks.

## Domain assessment

### Build and package

Status: Ready with blockers. Build and packaging configuration pass. Windows output exists locally. Linux and macOS release artifacts, signing/notarization, clean-machine install, uninstall, upgrade, and rollback evidence are still required.

### Supabase and RLS

Status: Not ready. The migration inventory and static schema smoke pass, and dedicated RLS files exist. Static presence is not proof of deployed policy behavior. Clean reset, migration ordering, generated types, RLS adversarial tests, backup, and restore must be demonstrated in staging.

### LiveKit

Status: Ready with blockers. Renderer service, token Edge Function, room naming, Electron capture bridge, and UI wiring pass structural smoke. Real service credentials, token policy, multi-client media, network recovery, and per-platform permissions need certification.

### Storage and attachments

Status: Not ready for production uploads. MIME/size validation, quarantine metadata, safe rendering states, and signed URL architecture exist. A production scanner and thumbnail worker are absent; pending or unsafe files must remain inaccessible until those services are operational.

### Realtime

Status: Ready with non-blockers for controlled beta. Event ordering/deduplication foundations pass. Hosted fan-out, Redis/pub-sub deployment, reconnect storms, backpressure, and load thresholds still need staging evidence before stable release.

### Diagnostics and logging

Status: Not ready. Redaction is a release boundary and its smoke test currently fails. Do not enable external crash/support upload until this gate passes and exported payloads are manually reviewed with safe synthetic secret values.

### Legal and policy

Status: Ready with external approval required. Third-party notice checks pass and policy/release documents exist. Product counsel/owner must approve terms, privacy, retention, deletion, regional obligations, and final project-license choice before public release.

### Support

Status: Ready with non-blockers. Help, feedback, diagnostics, incident, rollback, and support material exists. Assign real owners, escalation contacts, response windows, status communication, and privacy-safe log intake before stable launch.

### Release process

Status: Ready with blockers. Checksum, provenance, release channels, safe rollout, incident, rollback, staging smoke, deployment, and go/no-go plans exist. CI enforcement and a complete release-candidate dry run with signed artifacts remain required.

### Security

Status: Not ready. Electron isolation and multiple security foundations exist, but the failing diagnostics gate, unexecuted live RLS suite, absent scanner provider, pending penetration test, and incomplete signed artifact certification are critical gaps.

### Performance

Status: Ready with non-blockers for beta. Build is fast and bundle smoke passes, but the renderer chunk warning is material. Establish measured startup, memory, large-message-list, member-list, image, and reconnect baselines on representative Windows/Linux/macOS hardware.

### Accessibility

Status: Ready with non-blockers for beta. High contrast and reduced motion paths pass structural smoke. Complete keyboard-only traversal, focus order/restoration, screen reader labels, zoom/DPI, contrast, and platform assistive-technology checks.

## Required promotion sequence

1. Fix and pass diagnostics redaction/export tests.
2. Run clean Supabase migration plus RLS/pgTAP/adversarial staging suite.
3. Operate and verify attachment scanner/quarantine release flow.
4. Complete real LiveKit and realtime multi-client platform certification.
5. Build, sign/notarize, checksum, install, smoke, and rollback Windows/Linux/macOS release candidates.
6. Run staging smoke, RC dry run, penetration test, legal approval, and formal go/no-go review.

## Non-blocking technical debt

- Split the approximately 998 kB renderer entry chunk and measure cold-start impact.
- Add hosted realtime load and Redis failover evidence.
- Add manual accessibility evidence and visual regression baselines per platform.
- Replace operational placeholders with named owners, alert thresholds, and support contacts.
- Keep advanced post-MVP surfaces disabled until their backend enforcement and support ownership are production-ready.

## Scope guardrails

This audit adds no mobile UI and makes no branding, feature, runtime, or permission change. Picom remains an original desktop product; Discord assets, logo, and exact colors are not approved dependencies.
