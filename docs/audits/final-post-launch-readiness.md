# Final Post-Launch Readiness Audit

Date: 2026-07-10  
Version reviewed: `0.1.1-beta.1`  
Platforms: Windows, Linux, macOS Electron desktop  
Decision: **Delay pending blocker fix — not ready for stable launch or unattended post-launch operation**

## Executive conclusion

Picom has a compilable desktop application, a substantial set of security and operational plans, a controlled-beta support foundation, and a clear stable-hardening roadmap. It does not yet have the production evidence and staffed operations needed to launch stable and then operate safely.

Local/internal beta development may continue with known limitations and non-production data. Public stable rollout, production analytics/crash upload, external platform APIs, and production attachment uploads must remain disabled or gated until the release blockers are closed and a new go/no-go review records approval.

## Current evidence

| Check | Result | Interpretation |
| --- | --- | --- |
| `npm run typecheck` | Pass | TypeScript compiles |
| `npm run mock:smoke` | Pass | Core mock flows remain available |
| `npm run build` | Pass with warning | Electron/renderer build succeeds; renderer entry chunk is about 998 kB and exceeds Vite's warning threshold |
| `npm run production:launch:audit:smoke` | Pass | Production-launch documentation structure exists |
| `npm run safe-rollout:smoke` | Pass | Safe-rollout plan exists |
| `npm run rollback:smoke` | Pass | Rollback runbook structure exists |
| `npm run backup:verify:smoke` | Placeholder pass | Script/document contract exists; no real backup was restored |
| `npm run incident:response:smoke` | Pass | Incident runbook structure exists |
| `npm run licenses:smoke` | Pass | Third-party notices/license process structure passes; final project/legal approval remains open |
| `npm run analytics:placeholder:smoke` | Pass | Analytics remains provider-free, local/opt-in, and disabled by default |
| `npm run diagnostics:smoke` | **Fail** | Missing required password-redaction evidence |
| `npm run abuse:events:smoke` | **Fail** | Missing central redaction and safe Admin Operations summary/copy evidence |

Static smoke tests prove repository contracts, not deployed service behavior. Supabase CLI/live RLS, real backup restore, real LiveKit/realtime sessions, scanner operation, signed artifacts, and clean-machine platform tests remain separate evidence requirements.

## Readiness by domain

### Monitoring

Status: **Not ready**.

The restricted Admin Operations dashboard provides bounded local aggregate signals and safe design guidance. It is not a production telemetry backend, does not transmit authoritative metrics, and cannot calculate the stable SLOs. No approved ingestion service, provider credentials, dashboards, alert rules, data freshness, retention, regional handling, or staffed on-call routing is active.

Required before launch:

- privacy-reviewed typed/content-free event ingestion;
- authoritative server/provider counters for startup, auth, send, realtime, upload, voice, crash, and install outcomes;
- platform/version/channel dashboards, freshness indicators, SLO/error-budget calculations, and burn-rate alerts;
- named alert owners and tested runbook links;
- two baseline measurement windows before publishing any SLA claim.

### Support

Status: **Ready with operational blockers**.

Help content, beta triage, diagnostics export design, response templates, escalation categories, incident conversion, and privacy boundaries are documented. The process still needs a real support intake, security-reporting channel, named owners/on-call contacts, access-controlled evidence store, retention policy, response schedules, training, and a tabletop exercise.

Do not ask users for passwords, tokens, `.env` files, private data dumps, or unnecessary message/attachment content. External diagnostics upload remains disabled while redaction gates fail.

### Rollback

Status: **Ready with execution blockers**.

Backend, database, desktop, feature-flag/kill-switch, Edge Function, object storage, LiveKit, realtime, and communication paths are documented. Database rollback is correctly treated as potentially unsafe. A stable release still needs a known-good signed prior artifact, verified client/server compatibility, protected update-channel controls, actual rollback rehearsal, owner approval, and post-rollback smoke evidence.

### Backups and restore

Status: **Not ready**.

Backup/restore/verification/drill documents and guarded placeholders exist, but the verification command only proves the placeholder contract. No real encrypted production-like backup was restored into an isolated staging database, no RPO/RTO result was measured, no object-storage recovery was demonstrated, and named approvers/retention/access controls are unresolved.

Stable release requires automated backups, off-account/region policy as approved, checksum/encryption/access evidence, scheduled restore verification, application smoke after restore, object metadata/bytes reconciliation, and a recorded drill result.

### Incident response

Status: **Ready with operational blockers**.

Severity definitions, first-15-minute/first-hour actions, domain runbooks, security/data-loss/private-channel paths, communication guidance, postmortem template, and support escalation exist. Assign an incident commander rotation, engineering/operations/security/privacy/support contacts, status channel, evidence store, provider escalation contacts, and conduct a tabletop plus one technical rollback/restore exercise.

### Stable release status

Status: **No-Go / delay pending blocker fix**.

Blocking evidence:

1. Diagnostics redaction smoke fails.
2. Abuse-event/Admin Operations safe-summary smoke fails.
3. Clean deployed Supabase migrations plus pgTAP/RLS/tenant-isolation tests have not been run with retained evidence.
4. Production attachment scanner/quarantine worker is absent; pending files intentionally cannot be served.
5. Real LiveKit/realtime multi-client and degraded-network certification is incomplete.
6. Signed/notarized Windows/Linux/macOS artifacts and clean-machine install/upgrade/uninstall/rollback certification are incomplete.
7. Production monitoring/alerting and stable SLO measurement are not active.
8. Real backup restore verification and disaster-recovery drill are incomplete.
9. Legal/product-license/privacy/terms/vendor and support/operations sign-offs are not complete.

### Legal and policy

Status: **Not ready for public stable release**.

Third-party notices and legal/policy checklists exist, and no license smoke issue was found. The repository intentionally does not treat a placeholder as a license grant. Final project distribution terms, Terms/Privacy/community rules, retention/deletion/export claims, age/region obligations, Supabase/LiveKit/storage/crash/metrics vendor disclosures, data-processing/transfer terms, support contacts, and counsel/product approvals remain required.

Privacy/retention information is split across data-export/deletion, deletion policy, message retention, legal checklist, analytics, and risk documents rather than one approved public policy. Consolidate only after legal review; do not publish draft architecture as final legal text.

### Analytics and privacy

Status: **Safe default, not production telemetry**.

The analytics abstraction is disabled by default, provider-free, content-free, event-whitelisted, bounded locally, and clears its local queue when disabled. This is safe to keep. It is insufficient for SLO monitoring and must not be silently repurposed.

Before any external analytics/health ingestion:

- approve purpose, consent/legal basis, user control, event/label schema, retention, regions, vendor, access and deletion behavior;
- prohibit content, credentials, IDs/high-cardinality/user-generated labels, private URLs/paths and detailed presence/activity histories;
- pass redaction/schema/opt-out/network tests and expose transparent settings/policy copy;
- keep kill switch and backend validation/rate limiting.

### Security posture

Status: **Not ready**.

Strong foundations include Electron isolation, minimal service bridges, RLS architecture, safe external-link/deep-link boundaries, token hashing patterns, feature flags/kill switches, attachment quarantine, audit immutability, secret/dependency policies, and incident/rollback planning.

Critical gaps are the two failing redaction/abuse gates, unexecuted live RLS suite, absent production scanner, incomplete signed artifacts and penetration test, no production monitoring, incomplete provider credential/rotation exercises, and no clean staging/restore evidence. Any private-channel/cross-tenant leak, credential exposure, data loss, malicious artifact, or updater compromise is immediate No-Go regardless of SLO budget.

### User feedback loops

Status: **Ready for controlled beta, not scaled support**.

In-app feedback/diagnostics, beta categories/severity, known-issue handling, response templates, escalation, and postmortem paths exist. Reports remain local and user-mediated; there is no approved support backend or automatic upload. This privacy-safe default should remain while redaction fails.

Before stable launch, provide a trusted intake, case IDs/status, consent and redaction review, duplicate/known-issue workflow, release-linked closure/retest, accessibility channel, security disclosure channel, and aggregate product feedback review without collecting private content.

### Next roadmap

Status: **Clear and correctly gated**.

`docs/roadmap-v2.md` correctly places stable hardening first, followed by trust and safety, bot/webhook/developer ecosystem, platform ecosystem, enterprise readiness, and monetization later. Mobile remains out of scope unless separately approved through product governance and an ADR.

No ecosystem, enterprise, marketplace, billing, or mobile work should displace the release blockers listed here.

## Post-launch operating plan (activate only after Go)

### First 24 hours

- Keep rollout in the smallest approved ring and confirm artifact checksum/signature/channel.
- Watch startup, crash-free, install, auth, message, realtime, upload, and voice SLOs by platform/version.
- Confirm health/readiness, scanner/quarantine, backup completion, support intake, and alert routing.
- Review failures and support reports at a fixed cadence; pause on any fast-burn, security, privacy, data-loss, or artifact signal.

### Days 2–7

- Expand only when error budgets, provider health, support volume, and known issues are acceptable.
- Verify backup and one non-destructive restore check; review abuse/permission/quarantine aggregates.
- Reconcile release notes, support cases, crash fingerprints, rollback readiness, and feature-flag state.
- Do not mix beta/staging/mock events into stable SLOs.

### Days 8–30

- Complete first SLO/error-budget and incident/support review.
- Run restore/rollback/tabletop follow-up and close owned launch actions.
- Publish post-launch known issues and fixes without private data.
- Decide whether to continue stable hardening; do not start public ecosystem rollout automatically.

## Required final promotion checklist

1. Fix `diagnostics:smoke` and `abuse:events:smoke`; manually review safe synthetic-secret exports.
2. Pass clean Supabase staging reset/migrations, generated types, RLS/pgTAP/adversarial isolation tests.
3. Operate attachment scanner/quarantine/signed delivery and complete orphan/restore checks.
4. Pass real two-client realtime and LiveKit voice/screen-share tests on all supported platforms.
5. Produce and certify signed/notarized artifacts, checksums, provenance, install/upgrade/uninstall and rollback.
6. Restore a real production-like backup in isolated staging and record RPO/RTO/data/application results.
7. Activate privacy-approved monitoring, stable SLO dashboards/alerts, named on-call and status/support channels.
8. Complete penetration/security review, legal/policy/license/vendor approvals and privacy sign-off.
9. Run staging smoke, RC dry run, incident tabletop, rollback drill and formal Go/No-Go sign-offs.

## Final decision

- Local development: **Go**.
- Controlled internal beta with non-production data and explicit limitations: **Go with known blockers and close monitoring**.
- Public stable release: **No-Go**.
- Post-launch unattended operation: **No-Go**.
- Decision label: **Delay pending blocker fix**.

No runtime, UI, Electron, Supabase, LiveKit, analytics transport, mobile, branding, or release behavior changed in this audit.
