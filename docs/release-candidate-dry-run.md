# Release Candidate Dry Run Workflow

Use this workflow before promoting a Picom release candidate to beta or stable rings. Picom is an Electron desktop app for Windows, Linux, and macOS.

This workflow ties together staging, quality gates, desktop packaging, checksums, provenance, rollback, and release notes. It does not publish real artifacts by itself.

## RC metadata

- Release version:
- Release channel: internal / beta / stable placeholder
- Git commit:
- Build date:
- Owner:
- RC result: pass / fail / blocked

## Dry run steps

| Step | Required action | Result |
| --- | --- | --- |
| Choose release version | Confirm semver and release channel | TODO |
| Update changelog | Add user-facing release notes and known issues | TODO |
| Run quality gate | Run `npm run quality:gate` or documented equivalent | TODO |
| Run tests | Run targeted smoke/tests for changed areas | TODO |
| Run database migration on staging | Apply and verify staging migration | TODO |
| Run staging smoke test | Follow `docs/staging-smoke-test.md` | TODO |
| Build Windows package | Run Windows packaging command in supported environment | TODO |
| Build Linux package | Run Linux packaging command in supported environment | TODO |
| Build macOS package | Run macOS packaging if macOS is in release ring | TODO |
| Generate checksums | Run `npm run generate-checksums` or release script placeholder | TODO |
| Verify artifact metadata | Check provenance/build metadata against source commit | TODO |
| Install Windows package | Install and launch on Windows test machine | TODO |
| Install Linux package | Install and launch on Linux test machine | TODO |
| Install macOS package | Install and launch on macOS if in scope | TODO |
| Run desktop smoke test | Login/session, community, channel, message, upload, realtime | TODO |
| Verify rollback plan | Review `docs/rollback-runbook.md` and kill switches | TODO |
| Prepare release notes | Include supported platforms and known non-blockers | TODO |
| Mark RC result | pass / fail / blocked with owner and notes | TODO |

## Required desktop smoke flow

1. App starts without native File/Edit/View menu.
2. Custom titlebar/window controls work.
3. Light/dark theme works.
4. Community switching works.
5. Channel switching works.
6. Message sending works.
7. Realtime works with two clients where staging is available.
8. Image upload/preview works.
9. Settings modal opens.
10. No mobile UI appears.
11. No Discord branding/assets/exact colors appear.

## Pass criteria

RC can pass when:

- Quality gate passes.
- Staging smoke passes.
- Windows and Linux package smoke tests pass.
- macOS package smoke passes if macOS is part of the release.
- Checksums/provenance are generated and reviewed.
- Rollback and incident response docs are ready.
- Known issues are documented and non-blocking.

## Fail criteria

RC fails when:

- Core chat, auth, message send, upload, or realtime fails.
- Private channel/RLS boundary fails.
- Desktop app crashes on startup.
- Package artifacts are corrupt or metadata mismatches.
- Rollback path is unknown.

## Blocked criteria

RC is blocked when:

- Required environment or credentials are unavailable.
- Staging database migration cannot be verified.
- Required platform test machine is unavailable.
- A release blocker has no owner or mitigation.

## Related documents

- `docs/staging-smoke-test.md`
- `docs/production-deployment-checklist.md`
- `docs/release-artifacts.md`
- `docs/release-provenance.md`
- `docs/safe-rollout.md`
- `docs/rollback-runbook.md`
- `docs/incident-response.md`
- `docs/go-no-go-checklist.md` once available
