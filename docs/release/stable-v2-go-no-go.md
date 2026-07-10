# Picom stable v2 Go / No-Go record

## Decision snapshot

- Decision: **No-Go / Delay pending blocker verification**
- Scope: public stable v2 Electron desktop release for Windows, Linux, and macOS
- Assessment date: 2026-07-10
- Assessed source: Task 249 checkpoint commit candidate
- Release owner: unassigned
- Reassessment: only after every blocker below has dated evidence and required sign-off
- Automatic release/publish/update action: **none**

This record does not approve a public stable release. Source/build contracts and planning are mature enough for controlled staging/internal validation, but documentation or structural smoke is not production evidence.

## Evidence currently available

| Area | Status | Evidence | Interpretation |
| --- | --- | --- | --- |
| TypeScript/renderer build | passing in recent task gates | task checkpoints 241-248 | Useful code confidence, not platform/staging proof |
| Mock mode | passing in recent task gates | `npm run mock:smoke` | Core local path remains usable |
| Supabase structure | passing; CLI unavailable warning | `npm run supabase:smoke` | Files/contracts present; live migrations/RLS not proven |
| Local data v2 | implemented/tested structurally | settings schema 3, manifest 2, Safe Mode | Clean/legacy/corrupt manual desktop matrix still required |
| Offline queue | bounded/deduplicated/cancelable | Task 243 | Live reconnect/response-loss/two-window test still required |
| Data export/deletion | production-shaped, gated | Tasks 246-247 | Live RLS/Auth/legal evidence absent; finalizer disabled |
| Release/operations docs | prepared | deployment, rollback, incident, v2 migration | Execution evidence and named owners absent |

## Release blockers

| ID | Blocker | Required closing evidence | Owner/sign-off |
| --- | --- | --- | --- |
| V2-B01 | Full staging migration and smoke not executed | Exact RC migrations/functions applied to staging; auth/community/channel/message/upload/two-client Realtime/voice-screen paths pass with evidence | Engineering + Operations |
| V2-B02 | Live RLS/tenant isolation not proven | Owner/admin/mod/member/visitor and cross-community/private channel denial across REST, Realtime, Storage, search, attachments and exports | Security + Backend |
| V2-B03 | External security review not commissioned/completed | Independent report; Critical/High fixed and independently retested; Medium plan accepted | Security + Engineering + Legal |
| V2-B04 | External accessibility audit not performed | Windows Narrator, Linux Orca and macOS VoiceOver/keyboard/contrast audit; blocker/high independently retested | Product + Accessibility + Engineering |
| V2-B05 | Legal/privacy publication not approved | Counsel approval for Terms/Privacy/Guidelines, GDPR/DSA analysis, export/deletion/anonymization/retention notices and regional obligations | Legal + Product |
| V2-B06 | Backup restore not production-proven | Fresh backup plus isolated staging restore, integrity checks, application/Storage smoke, RTO/RPO and cleanup evidence | Database + Operations |
| V2-B07 | v2 migration compatibility not executed | Clean and previous-schema migration, last-supported client + v2 RC compatibility, local settings/draft/cache migration and forward-fix classification | Database + Desktop |
| V2-B08 | Platform packages not release-proven | Clean-host install/upgrade/uninstall/core-flow smoke for supported Windows, Linux and macOS artifacts | Release Engineering + QA |
| V2-B09 | Windows signing/macOS notarization incomplete | Approved publisher identities, protected CI, valid signatures/timestamps/notarization, post-sign checksums/provenance | Security + Release + Legal |
| V2-B10 | Monitoring/alerting not live | Production health/SLO dashboards, tested alerts, on-call rota/escalation and incident exercise evidence | Operations |
| V2-B11 | Rollback not rehearsed for exact RC | Previous app/backend compatibility, feature disable path, migration forward-fix/restore decision, signed artifact rollback and pause authority | Engineering + Operations |
| V2-B12 | Required sign-offs absent | Product, Engineering, Security, Operations, Support and Legal sign with date/notes after evidence review | Release owner |

Any Critical/High security issue, privacy leak, cross-tenant access, startup crash, data corruption, unverifiable artifact, failed migration/restore, or unknown rollback path remains an unconditional No-Go.

## Known non-blockers only if explicitly accepted

These items do not override blockers above:

- Current Vite renderer chunk exceeds the 500 kB warning threshold; owner should track startup/memory budget and code splitting.
- `voiceService` has an ineffective dynamic-import warning because another service imports it statically.
- Production auto-update remains disabled; a stable release may use approved manual distribution if install/rollback/support communication is complete.
- Linux repository distribution, public marketplace/plugin runtime, billing, enterprise features and advanced integrations remain disabled/not generally available.
- Account deletion finalization worker remains disabled pending Legal/Operations approval; user-facing availability must match the approved production process.

Each accepted non-blocker needs severity, user impact, owner, mitigation, target date, and Product/Engineering approval in release notes.

## Rollback readiness assessment

Status: **prepared in documentation, not demonstrated for this RC**.

Before changing to Go:

1. Identify exact previous known-good backend, Edge Function and platform artifacts with verified signatures/checksums/provenance.
2. Prove previous clients/backend remain compatible with expanded v2 schema.
3. Classify every migration as code-rollback-compatible, forward-fix-only, or restore-required.
4. Rehearse pause/kill-switch/degraded behavior without weakening RLS or permission enforcement.
5. Execute a staging rollback/forward-fix drill and verify auth, message send, private denial, upload and Realtime recovery.
6. Name stop authority, rollback owner, communication owner and evaluation window.

## Required sign-offs

| Area | Status | Name | Date | Notes |
| --- | --- | --- | --- | --- |
| Product | pending | | | scope, copy, known issues |
| Engineering | pending | | | build/staging/migration |
| Security | pending | | | RLS/external review/signing |
| Operations/Database | pending | | | backup/monitoring/rollback |
| Legal/Privacy | pending | | | publication/export/deletion |
| Support | pending | | | release communications/escalation |

## Reassessment procedure

1. Complete [v2 migration checklist](v2-migration-checklist.md), [production deployment checklist](../production-deployment-checklist.md), [RC dry run](../release-candidate-dry-run.md), and [staging smoke](../staging-smoke-test.md).
2. Attach protected evidence references, not credentials or user data.
3. Triage all failures; blocker/high fixes require rerun or independent retest where specified.
4. Review [rollback runbook](../rollback-runbook.md), [safe rollout](../safe-rollout.md), and [incident response](../incident-response.md) against the exact RC.
5. Record named sign-offs and residual risk acceptance.
6. Create a new dated decision record. Do not edit this No-Go snapshot into a retroactive Go.
