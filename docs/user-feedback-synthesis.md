# Picom User Cohort Feedback Synthesis

Date: 2026-07-10  
Scope: Windows, Linux and macOS desktop beta/post-launch readiness  
Status: Repository-evidence synthesis; not a quantitative user research report

## Evidence boundary

This synthesis uses existing Picom beta triage, release notes, known limitations, diagnostics design, support process and readiness audits. Picom currently keeps diagnostics local and has no approved centralized support/analytics ingestion. No raw user logs, private messages, identifiers, attachment content or externally collected cohort dataset was available or used.

Therefore:

- no issue count, percentage, frequency or user sentiment score is claimed;
- documented release gaps are not mislabeled as user-reported defects;
- historical issues must be regression-tested before being called current;
- the top ten list is an actionable prioritization hypothesis for validation, not evidence of demand volume.

## Evidence labels

- **Confirmed gate:** a current automated check fails or required production evidence is explicitly absent.
- **Documented limitation:** release/audit documentation states the capability is incomplete or unverified.
- **Feedback category:** support intake is designed to collect this issue class, but no aggregate count exists.
- **Historical regression risk:** prior beta work addressed this area; it needs continued regression coverage rather than an assumption that it is broken now.

## Feedback themes by platform

| Platform | Evidence-backed themes | Severity hypothesis | Required validation |
| --- | --- | --- | --- |
| Windows | Unsigned candidates can trigger SmartScreen; installer/install-upgrade-clean-launch and rollback need certification; startup/blank-screen/crash-loop remain support categories | P1 if a release ring cannot install/start; P3 for isolated UI/native behavior | Signed candidate, clean and upgrade machines, titlebar/tray/notification/startup controls, uninstall/reinstall, crash-free startup |
| Linux | AppImage/deb build and native launch/desktop integration are not certified on a Linux host; tray/notification/startup/voice/screen permissions need platform evidence | P1 for package launch; P2 for native integration/media failure | Target distributions, Wayland/X11 where supported, package install/remove, file/URL protocol, tray, notifications, audio/capture |
| macOS | dmg/zip, signing/notarization, microphone and screen-recording permission paths require native-host certification | P1 for install/notarization/startup; P2 for voice/screen permission issues | Signed/notarized artifact, Gatekeeper, clean install/upgrade, permission denial/recovery, titlebar/window controls |
| Cross-platform | Diagnostics/abuse redaction gates fail; live RLS, scanner, realtime/LiveKit, monitoring, backup/restore and accessibility evidence are incomplete | P0 for privacy/data leak; P1 for startup/auth/message; P2 for degraded upload/voice | Staging/adversarial suites, real provider sessions, safe exports, SLO baseline, restore and accessibility runs |

## Feedback themes by severity

### P0: release/security blockers

- Any private-channel, cross-tenant, credential, attachment, data-loss or malicious-package exposure.
- Current diagnostics redaction smoke failure.
- Current abuse-event safe summary/copy smoke failure.
- Unverified deployed RLS/tenant-isolation and production scanner boundaries.

### P1: core desktop blockers

- Package will not install/start or enters a crash/recovery loop for a release ring.
- Valid login/session restore fails broadly.
- Message send/reconciliation/realtime fails broadly or duplicates/corrupts messages.
- No safe rollback/restore/monitoring/support response during a stable incident.

### P2: major feature degradation

- Uploads unavailable while text chat remains safe.
- Voice/screen share join, permission or reconnect failures.
- Platform-specific native notification/tray/startup/deep-link issues.
- Large-channel performance or accessibility barriers with a workaround.

### P3/P4: localized issues and requests

- UI clipping, focus, copy, translation, theme, DPI and isolated device defects.
- Feature requests and advanced ecosystem ideas that do not block current workflows.

## Feedback themes by persona

| Persona | Primary jobs | Likely pain/risk areas from current evidence | Success evidence |
| --- | --- | --- | --- |
| New user | Install, launch, register/login, onboarding, join first community | Unsigned/native package friction, startup/session regression, unclear support path | Clean install/launch/auth/onboarding tests by platform and low startup/auth failure rate |
| Returning member | Resume session, navigate, send/read/search/react, upload | Session restore, message retry/duplicate/order, realtime reconnect, quarantine states | Two-client tests, recoverable failures, stable message SLO, no private leaks |
| Community owner/admin/moderator | Manage channels/roles/members/reports/audit | RLS/permission mismatch, tenant leakage, incomplete safety operations | Adversarial role matrix, immutable/redacted audit, tested moderation/escalation |
| Voice/screen-share participant | Join, mute/deafen, switch/reconnect, share screen | Provider/network/device/OS permission and cross-platform behavior | Real multi-client degraded-network and permission tests per platform |
| Privacy-conscious user | Control diagnostics/analytics, export/delete data | Redaction gates, fragmented final policy, placeholder operational processing | Safe synthetic-secret review, transparent controls, scoped export/delete staging tests |
| Accessibility user | Keyboard/focus, screen reader, contrast, reduced motion, scaling | Manual assistive-tech/platform evidence missing | Keyboard/screen-reader/zoom/DPI/contrast certification and tracked fixes |
| Support/operator | Diagnose, communicate, rollback, restore | Local-only reports, no intake/case system, failing redaction checks, unnamed owners | Trusted intake, redacted packet, case lifecycle, alerts/runbooks, drills |
| Developer/integration admin | Configure safe bots/webhooks/apps | Most ecosystem features remain foundation/placeholder and abuse gate fails | Public platform stays disabled until scoped API, credentials, abuse and support are certified |

## Feedback themes by feature area

| Feature area | Current signal | Classification |
| --- | --- | --- |
| Startup/desktop shell | Build passes; startup/crash/blank screen remains a support class and platform certification is incomplete | Historical regression risk + documented limitation |
| Authentication/account | MVP paths exist; hosted/stable valid-attempt baseline and recovery evidence still needed | Documented limitation |
| Community/permissions | RLS architecture exists; clean live RLS/tenant adversarial execution missing | Confirmed evidence gap, P0 if leakage |
| Messaging/realtime | Mock/build/order foundations pass; hosted two-client/load/reconnect evidence incomplete | Documented limitation |
| Upload/media | Validation/quarantine foundation exists; production scanner/worker unavailable | Confirmed release gap |
| Voice/screen share | Structural LiveKit/Electron bridge tests pass; real multi-platform sessions missing | Documented limitation |
| Diagnostics/support | Local export exists; diagnostics and abuse safety smoke gates fail; no approved intake | Confirmed gate |
| Packaging/native integration | Windows artifact exists; signing and complete Windows/Linux/macOS certification missing | Confirmed evidence gap |
| Performance/accessibility | Bundle warning and missing manual platform/assistive evidence | Documented limitation |
| Advanced ecosystem | Foundation/placeholder only; no public readiness | Intentionally deferred |

## Top 10 actionable fixes

### 1. Repair diagnostics and abuse-event privacy gates

Priority: P0  
Personas: all users, support, security  
Action: make `diagnostics:smoke` and `abuse:events:smoke` pass for the real centralized redaction/export paths, then manually inspect exports using safe synthetic secret-shaped values. Keep automatic upload disabled until approved.

### 2. Execute the full Supabase RLS and tenant-isolation matrix

Priority: P0  
Personas: members, visitors, owners/admins/moderators  
Action: clean-reset staging, apply all migrations, regenerate types and test public/private community/channel/message/attachment/search/realtime access across roles and revoked sessions.

### 3. Make attachment scanning/quarantine operational

Priority: P0/P1  
Personas: message senders, recipients, moderators  
Action: deploy a trusted scanner worker, authenticate it server-side, handle retry/dead-letter/review, keep suspicious/failed/pending files private and prove signed delivery plus orphan/restore behavior.

### 4. Certify install, startup and rollback on all desktop platforms

Priority: P1  
Personas: new/returning users, support  
Action: sign/notarize artifacts and run clean install, upgrade, startup, titlebar/native controls, uninstall/reinstall, checksum/provenance and rollback tests on Windows, Linux and macOS.

### 5. Validate auth/session recovery with hosted services

Priority: P1  
Personas: new/returning users  
Action: test valid login/register/restore/logout/revoke/expired-session, offline/backend-unreachable and sleep/wake paths without hook-order/null crashes or raw errors.

### 6. Certify message delivery and realtime recovery

Priority: P1  
Personas: community members and moderators  
Action: run two-window and load/partition tests for rapid sends, optimistic reconcile, duplicate prevention, edit/delete/reaction ordering, offline queue/retry and permission changes.

### 7. Certify LiveKit voice and screen share per platform

Priority: P2/P1 when voice is release-critical  
Personas: voice users  
Action: test two or more clients, token scope, mute/deafen, speaking, reconnect, device switch, screen source/permission, stop/rejoin and degraded networks on all supported OSes.

### 8. Establish trusted feedback intake and case lifecycle

Priority: P1 operational  
Personas: users, support, security  
Action: create an approved support/security intake with case IDs, restricted evidence, retention, duplicate/known-issue linking, owner/update targets and release-linked closure while keeping content/credentials out.

### 9. Measure and improve desktop performance/accessibility

Priority: P2  
Personas: large-community and accessibility users  
Action: baseline cold start, main bundle, memory, large message/member lists, images and reconnect; run keyboard, focus, screen reader, contrast, zoom/DPI and reduced-motion certification. Address the approximately 998 kB renderer entry warning based on measured impact.

### 10. Activate privacy-safe operations before stable rollout

Priority: P1 operational  
Personas: all users, operators  
Action: deploy content-free monitoring/SLO alerts, assign support/incident owners, restore a real backup, rehearse rollback/incident response, complete legal/privacy/license/vendor sign-offs and rerun formal go/no-go.

## Prioritization method for real feedback

When approved feedback intake exists, score each canonical issue without storing unnecessary personal data:

- severity/security/privacy override;
- affected supported platform and release ring;
- affected core job and persona;
- reproducibility and safe workaround;
- number of deduplicated cases in a bounded period;
- SLO/error-budget and support burden;
- engineering risk/dependency and regression coverage;
- accessibility/legal obligations.

P0 incidents override numeric scoring. Do not prioritize based on identifiable user value, private message content, community popularity or persistent behavioral profiles.

## Validation plan

- Review this synthesis weekly during beta with product, support, engineering, security/privacy and release owners.
- Link each accepted item to one canonical issue with platform/persona/feature/severity and measurable closure criteria.
- Mark evidence source and freshness; remove resolved limitations only after exact artifact/environment retest.
- Publish user-facing known issues without infrastructure secrets or private case details.

## Current decision

The first ten actions focus on stable safety and core desktop reliability. New marketplace, enterprise, billing, mobile, E2EE or advanced analytics work must not displace them under the V2 governance lock.
