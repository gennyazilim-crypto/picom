# Picom final v2 readiness audit

## Executive decision

**Status: No-Go for public stable v2; ready for controlled staging/internal validation.**

This audit covers all 99 source tasks from 151 through 249. Every task has at least one matching checkpoint. It distinguishes implemented/structurally tested behavior from plans, placeholders, disabled features, simulated drills, and external evidence that does not yet exist. No mobile UI, Discord branding/assets/colors, automatic release, provider credential, or production deployment was added by this audit.

Assessment date: 2026-07-10. The authoritative release decision remains [stable v2 Go/No-Go](stable-v2-go-no-go.md).

## Current verification evidence

Executed against the Task 249 source state plus the Task 250 smoke-path correction:

- `npm run qa:smoke`: PASS, including environment, hook order, logging/redaction, errors, crash, secrets, renderer-native boundary, branding, desktop-only, Electron security, packaging config, diagnostics, LiveKit structure and mock mode.
- `npm run supabase:smoke`: PASS structural schema/config/seed checks; warning confirms Supabase CLI is unavailable, so no local reset/live RLS execution is claimed.
- `npm run typecheck`: PASS.
- `npm run build`: PASS; Electron TypeScript and Vite renderer production build completed.
- Build warnings: renderer JavaScript is approximately 1.576 MB minified and above the 500 kB warning threshold; `voiceService` dynamic import is ineffective because another service imports it statically.

Task 250 fixed one QA harness integration issue: the unified-error smoke test read the logging barrel instead of the actual central implementation. Runtime error handling did not change.

## Task-range assessment

| Range | Readiness | Strong outcomes | Important limitations |
| --- | --- | --- | --- |
| 151-175 | mixed implementation/foundation | Message pagination/search/ranking/presence/voice quality; moderation/report/appeal/audit foundations; attachment/CDN/scanning plans; bot security boundaries | Live staging/RLS/provider behavior often unverified; virus scanning provider, retention apply, attachment-message linking and public bots remain incomplete/disabled |
| 176-195 | implemented core plus controlled placeholders | Desktop upload UX, reactions/polls/events/threads/forums/announcements, reconnect/drafts, production-shaped DM/friends/blocking/discovery/invites/onboarding | Drag/paste and cross-device drafts remain constrained; some upload validation/reminders/experiments require backend deployment and live privacy/RLS proof |
| 196-210 | architecture/Edge/operations planning | Edge Function structure, community insights/admin access, third-party automation, residency/multi-region/self-host/cost decisions | Several Functions are explicitly placeholders; enterprise export/billing/multi-region/self-host/cloud PoCs remain disabled or documentation-only |
| 211-225 | quality/release engineering foundations | Performance contract CI, staging-only load/resilience plans, guarded backup restore tooling, dependency/API/update/signing/notarization/repository plans | Pixel visual regression and real E2E/load/chaos are not activated; drills are simulated; signing/notarization/repository/update production evidence is absent |
| 226-241 | governance and external assurance plans | Redacted crash-provider gate, SLO dashboards, on-call, pentest package, legal trackers, guidelines UI, abuse policy, plugin deny-by-default prototype, localization/accessibility plans | Providers, external security/accessibility reviews, legal publication, analytics/marketplace/billing/locales are not approved or completed; stable remains blocked |
| 242-247 | implemented desktop resilience/privacy | Configurable safe shortcuts; bounded/deduplicated/cancelable offline queue; local schema migration; production Safe Mode; allowlisted data export; gated anonymization/Auth soft-delete workflow | Live reconnect/RLS/Auth/deletion finalizer tests require staging; finalizer remains disabled pending Legal/Operations approval |
| 248-249 | release control | Evidence-driven v2 migration checklist and dated No-Go record | Checklists are not execution evidence; sign-offs remain pending |

## Strong areas

1. **Desktop boundary:** Electron custom desktop path, safe preload/context isolation, no direct renderer-native access, desktop-only/branding contracts and packaging config pass the QA gate.
2. **Core source health:** TypeScript, Electron compile, Vite production build and mock service smoke pass.
3. **Privacy/security defaults:** central log redaction, secret scan contracts, RLS-oriented services, private-channel design, bounded exports, no custom disk cache for private messages and no plugin code execution.
4. **Message resilience:** optimistic `clientMessageId` reconciliation, per-channel FIFO, bounded queue, duplicate reuse, cancellation and recoverable conflict states.
5. **Local recovery:** schema-versioned settings/draft/cache migration, scope-limited backups, storage-failure Safe Mode, repeated-crash recovery and redacted diagnostics.
6. **Account privacy workflows:** authenticated allowlisted export and default-disabled two-stage account anonymization preserve message/audit integrity and keep destructive authority outside the renderer.
7. **Operational discipline:** rollback, incident, backup, migration, SLO, alerting and Go/No-Go documents consistently refuse to claim unperformed production evidence.

## Critical release blockers

1. Exact RC migrations/Functions are not applied and smoke-tested in a real staging Supabase/LiveKit environment.
2. Cross-tenant/private-channel RLS, Realtime, Storage, search, attachment and export denials lack live role-matrix evidence.
3. Independent external security review and Critical/High retest are not completed.
4. Independent accessibility audit across Narrator, Orca and VoiceOver is not completed.
5. Counsel has not approved/published final Terms, Privacy, Guidelines, GDPR/DSA assessment, export/deletion/retention and account anonymization treatment.
6. A real isolated staging backup restore plus application/Storage verification is not completed.
7. Windows/Linux/macOS clean-host install, upgrade, uninstall and core-flow artifacts are not evidenced for the exact RC.
8. Windows signing and macOS notarization publisher/identity/timestamp/staple evidence are incomplete.
9. Production SLO dashboards, alert routes, on-call ownership and tested incident escalation are not live.
10. Rollback/forward-fix is documented but not rehearsed against the exact schema, backend and platform artifacts.
11. Required Product, Engineering, Security, Operations/Database, Legal/Privacy and Support sign-offs are missing.

## High risks and technical debt

- Root `supabase:smoke` validates a historical required migration set and does not itself execute later migrations; task-specific contracts cover recent files, but clean/previous-schema application is still required.
- Root TypeScript does not typecheck Deno Edge Functions as a deployed Supabase bundle; staging deployment and function tests are necessary.
- Broad post-MVP surface area increases regression/permission/test burden before live integration evidence exists.
- Renderer bundle size and ineffective LiveKit/voice code splitting may affect cold start/memory on lower-end desktops.
- Visual regression, E2E, load, chaos and provider drills are mostly contract/manual/simulated, not continuous behavioral proof.
- Attachment malware scanner/provider, data-retention apply job, email delivery and some moderation/notification Functions remain placeholders or disabled.
- Account deletion spans Postgres and Supabase Auth without a distributed transaction; the retryable `auth_soft_delete_failed` state needs staging/operator rehearsal.
- Offline queue is intentionally memory-only; crash/exit loses unsent private text, requiring clear user recovery expectations.

## Conditional non-blockers

- Production auto-update may remain disabled if distribution, manual update/rollback and support instructions are approved.
- Linux repository/rpm publishing can remain disabled if approved AppImage/deb/manual distribution satisfies scope.
- Billing, marketplace/plugin runtime, public bot/webhook publication, enterprise, multi-region/self-hosting and expanded locales can stay disabled and absent from stable marketing.
- The bundle warning and `voiceService` import warning can be accepted only with measured startup/memory evidence, an owner and a target date.
- Large-account asynchronous export can remain post-v2 if bounded truncation is clearly disclosed and legal response obligations are met operationally.

## Recommended next 10 priorities

1. Provision isolated staging and apply the exact ordered RC migrations/Functions; record clean and previous-schema results.
2. Execute live owner/admin/mod/member/visitor and cross-tenant RLS/Realtime/Storage/search/attachment/export denial matrix.
3. Perform isolated backup restore verification, integrity checks, Storage reconciliation and post-restore desktop smoke.
4. Run full two-client staging core flow, reconnect/offline response-loss, DM/friends, uploads, LiveKit voice/screen share and session revoke tests.
5. Commission external security review; fix and independently retest every Critical/High finding.
6. Complete counsel review and immutable publication decisions for legal/privacy/guidelines/export/deletion/retention/anonymization.
7. Complete external accessibility audit and blocker/high remediation/retest across supported desktop platforms.
8. Produce signed/notarized exact-RC Windows/Linux/macOS artifacts and run clean-host install/upgrade/uninstall/protocol/core-flow smoke with checksums/provenance.
9. Activate privacy-safe SLO dashboards, alerts, on-call rota and rehearse exact-RC rollback/forward-fix plus incident communication.
10. Measure bundle/startup/memory, activate meaningful E2E/visual/load coverage, close blockers, then create a new dated Go/No-Go record.

## What should not be enabled yet

- Account deletion finalization schedule/worker.
- Public plugin runtime, marketplace, bot/webhook developer publication or unrestricted Developer Portal.
- Billing/payments, enterprise console/SSO/SCIM, multi-region routing or self-host migration.
- Production analytics/crash provider without approved privacy/provider/retention configuration.
- Production auto-update or public Linux repository without signed rollout/rollback evidence.
- New locale availability without central runtime, EN/TR parity and human-reviewed legal text.
- Automatic destructive retention, unapproved scanner execution, or any production chaos/load test.

## Final conclusion

Tasks 151-249 substantially improve source structure, desktop safety, mock behavior, local resilience, privacy boundaries and operational planning. They do not prove a production stable release. Picom should continue only through controlled staging/internal validation until every blocker has evidence and sign-off; the current stable v2 decision remains No-Go.
