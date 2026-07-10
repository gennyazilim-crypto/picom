# Final Go / No-Go Checklist

Use this checklist before promoting a Picom beta or stable release. Picom is an Electron desktop app for Windows, Linux, and macOS.

The current stable v2 decision snapshot is `docs/release/stable-v2-go-no-go.md`; it is No-Go until its evidence blockers close.

Mobile release readiness is out of scope. Do not approve release if mobile UI, Discord branding/assets/exact colors, or unreviewed advanced features appear.

## Decision options

- Go
- Go with known non-blockers
- No-Go
- Delay pending blocker fix

## Required sign-offs placeholder

| Area | Sign-off | Name | Date | Notes |
| --- | --- | --- | --- | --- |
| Product | pending | | | |
| Engineering | pending | | | |
| Security | pending | | | |
| Operations | pending | | | |
| Support | pending | | | |

## Product readiness

- [ ] `[BLOCKER]` MVP scope matches approved release notes.
- [ ] `[BLOCKER]` No post-MVP marketplace/plugin/enterprise/E2EE/public discovery feature is presented as production-ready unless explicitly included.
- [ ] `[VERIFY]` Known limitations are documented.
- [ ] `[VERIFY]` User-facing copy is clear for beta/stable audience.

## Desktop UI readiness

- [ ] `[BLOCKER]` Windows and Linux desktop app starts.
- [ ] `[VERIFY]` macOS app starts if macOS is in this release ring.
- [ ] `[BLOCKER]` Custom titlebar works and native File/Edit/View menu does not appear.
- [ ] `[BLOCKER]` 4-column community chat layout is stable.
- [ ] `[BLOCKER]` No mobile UI or bottom mobile navigation appears.
- [ ] `[VERIFY]` Light/dark themes remain polished.
- [ ] `[VERIFY]` Coolicons/AppIcon is used consistently.
- [ ] `[BLOCKER]` No Discord branding, logo, copied assets, or exact colors appear.

## Backend readiness

- [ ] `[BLOCKER]` Production deployment checklist is complete: `docs/production-deployment-checklist.md`.
- [ ] `[BLOCKER]` Auth, communities, channels, messages, uploads, permissions, and realtime core flows pass staging smoke.
- [ ] `[VERIFY]` API compatibility and client version assumptions are documented.
- [ ] `[VERIFY]` Optional/degraded service behavior is understood.

## Database readiness

- [ ] `[BLOCKER]` Database migration reviewed and applied in staging.
- [ ] `[BLOCKER]` Backup verification or restore drill completed.
- [ ] `[BLOCKER]` RLS/private channel boundaries verified.
- [ ] `[VERIFY]` Data corruption detection plan is available.

## Realtime readiness

- [ ] `[BLOCKER]` Realtime two-client staging smoke passes or release explicitly degrades realtime.
- [ ] `[VERIFY]` Backpressure policy exists.
- [ ] `[VERIFY]` Duplicate/out-of-order event handling is documented/prepared.

## Packaging readiness

- [ ] `[BLOCKER]` Windows package smoke passes.
- [ ] `[BLOCKER]` Linux package smoke passes.
- [ ] `[VERIFY]` macOS package smoke passes if in release ring.
- [ ] `[VERIFY]` Checksums generated.
- [ ] `[VERIFY]` Provenance metadata reviewed.
- [ ] `[VERIFY]` Release candidate dry run completed: `docs/release-candidate-dry-run.md`.

## Security readiness

- [ ] `[BLOCKER]` No known critical/high unmitigated dependency vulnerability.
- [ ] `[BLOCKER]` Secret scanning placeholder passes and no real secrets are committed.
- [ ] `[BLOCKER]` Private channel and attachment access boundaries are verified.
- [ ] `[VERIFY]` Logs/diagnostics are redacted.
- [ ] `[VERIFY]` Security risks documented with owners.

## Support readiness

- [ ] `[VERIFY]` Beta/release notes and known issues are available.
- [ ] `[VERIFY]` Incident response runbook is available: `docs/incident-response.md`.
- [ ] `[VERIFY]` Postmortem template is available.
- [ ] `[VERIFY]` Support communication placeholder prepared.

## Monitoring readiness

- [ ] `[BLOCKER]` Health/readiness/liveness endpoints are available.
- [ ] `[VERIFY]` SLO plan reviewed: `docs/slo.md`.
- [ ] `[VERIFY]` Rollout pause/kill switch process reviewed.
- [ ] `[VERIFY]` Staging smoke test completed: `docs/staging-smoke-test.md`.

## Rollback readiness

- [ ] `[BLOCKER]` Rollback runbook reviewed: `docs/rollback-runbook.md`.
- [ ] `[BLOCKER]` Database rollback limitations understood.
- [ ] `[VERIFY]` Emergency kill switches available for risky features.
- [ ] `[VERIFY]` Desktop client/server compatibility checked before rollback.

## Known issues

| Issue | Severity | Blocker? | Owner | Mitigation | Follow-up date |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
| | | | | | |

Known non-blockers must be documented before choosing “Go with known non-blockers.”

## Final decision

- Decision: Go / Go with known non-blockers / No-Go / Delay pending blocker fix
- Decision owner:
- Date/time:
- Release version:
- Release channel:
- Notes:
