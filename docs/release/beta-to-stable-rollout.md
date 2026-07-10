# Beta-to-Stable Rollout Process

## Purpose

This process controls promotion of a tested Picom beta to the stable Windows, Linux, and macOS desktop channel. Promotion is evidence-based, manually approved, and reversible. A completed document does not enable production auto-update by itself.

## Promotion principles

- Promote the exact immutable beta artifacts or rebuild from the same reviewed commit in protected CI.
- Do not promote by elapsed time alone.
- A missing required sign-off, unresolved blocker, or unverifiable result is a `No-Go`.
- Known non-blockers may ship only when impact, workaround, owner, target fix, and support copy are recorded.
- Platform scope is explicit. A platform without package/signing/smoke approval is excluded from that release.
- Stable rollout begins with the canary/ring rules in `docs/update/auto-update-rollout-gate.md`.

## Required release record

Record before review:

| Field | Value |
| --- | --- |
| Candidate version | |
| Stable version | |
| Source commit | |
| Beta observation window | |
| Windows artifact/checksum | |
| Linux artifact/checksum | |
| macOS artifact/checksum | |
| Backend/migration version | |
| Supabase project/environment | staging evidence only; no secrets |
| LiveKit environment | staging evidence only; no secrets |
| Release owner | |

## 1. Beta feedback review

1. Freeze the beta feedback window and deduplicate reports under canonical issues.
2. Confirm every report has platform, app version, environment, reproduction steps, severity, owner, and release impact.
3. Reproduce blocker, critical, and recurring major reports against the exact candidate.
4. Verify completed fixes on the final artifact, not only in development mode.
5. Summarize counts by category, severity, platform, fixed/deferred status, and regression risk.

Required evidence: beta triage export, fixed-issue retest links, unresolved issue list, and support trend summary. Follow `docs/beta-feedback-triage.md`.

## 2. Known-issues triage

Stable promotion is blocked by:

- any unresolved security/privacy/data-isolation concern;
- startup, install, login/session restore, community/channel load, or message-send blocker;
- reproducible data loss/corruption or duplicate/lost message defect;
- inaccessible critical desktop flow;
- unsigned/unverifiable artifact when signing is required;
- an issue without an assigned owner or understood user impact.

For every accepted non-blocker record severity, affected versions/platforms, workaround, support response, owner, target release, and why stable use remains safe. Update final release notes and known issues before approval.

## 3. Security sign-off

Security approval requires:

- secret scan and dependency vulnerability review;
- Electron security checks (`contextIsolation`, disabled Node integration, minimal preload IPC, no native menu regression);
- CSP/external-link/deep-link and uploaded attachment boundary review;
- redacted logs, diagnostics, crash reports, and support exports;
- no critical/high unmitigated finding;
- incident, kill-switch, pause, and rollback procedures reviewed.

Any credible credential exposure, arbitrary native capability, private-data leak, or unmitigated critical/high issue is an immediate `No-Go`.

## 4. Supabase RLS sign-off

RLS approval requires a real staging database and authenticated test identities. Structural SQL inspection alone is insufficient.

- Apply all migrations to a disposable/staging project and record migration history.
- Run the RLS regression suite for owner/admin/moderator/member/visitor and cross-community users.
- Verify private community, private channel, message, attachment, membership, role, invite, export, and deletion boundaries.
- Verify direct REST/client access is denied where UI actions are hidden.
- Confirm service-role credentials never reach renderer code or user diagnostics.
- Record test project, migration version, command, timestamp, and sanitized result.

Missing Supabase CLI or unavailable staging credentials means RLS sign-off is `blocked`, not passed.

## 5. LiveKit sign-off

- Use a production-like staging room/token endpoint with secrets server-side only.
- Test two-client join/leave, mute/deafen, speaking indication, reconnect, device loss, and token expiry.
- Test Electron screen-source selection, publish/unpublish, remote rendering, and permission denial.
- Complete native checks on each released OS, including macOS microphone/screen-recording permission behavior.
- Review quality metrics and degraded/error states without recording private audio/video content.

If voice/screen share is in stable scope, a missing applicable platform test is a blocker. If excluded, UI and release notes must clearly mark it unavailable rather than presenting an untested production feature.

## 6. Package and signing sign-off

For each released platform:

- package from the approved commit in a clean environment;
- generate and verify checksum/provenance metadata;
- install, launch, restart, upgrade/reinstall, and uninstall/remove;
- confirm custom titlebar/window controls, icon, protocol behavior, filesystem locations, and no white-screen startup;
- verify platform signatures/notarization where required;
- verify downloaded artifact after distribution, not only the local build output.

Windows requires approved Authenticode evidence. macOS requires Developer ID signing, hardened-runtime review, notarization/stapling, and Gatekeeper verification. Linux release scope and package mechanism must match `docs/release/linux-distribution-final.md`.

## 7. Legal and privacy sign-off

- Terms, privacy notice, community guidelines, data export/deletion, and support/legal contact drafts are approved for the target jurisdictions.
- Runtime legal versions match published documents and re-acceptance policy.
- Third-party notices and Coolicons attribution are complete.
- Data retention, telemetry/diagnostics consent, account deletion grace period, and subprocessors are accurately described.
- Store/distribution metadata makes no unsupported security, encryption, compliance, or platform claim.

Unapproved legal drafts or mismatch between product behavior and published policy is a `No-Go`.

## 8. Support readiness

- Support owner and escalation schedule are staffed for canary and initial stable rollout.
- Incident response, rollback, update-failure recovery, and postmortem templates are linked.
- Known-issue replies and recovery instructions are prepared for each platform.
- Support can collect only redacted diagnostics and can identify version/channel/build provenance.
- Status communication and rollout-pause message templates are approved.

## 9. Final release notes

Final notes must contain version/channel/build date, supported OS/package types, user-visible changes, security/privacy-impacting changes, known non-blockers and workarounds, compatibility/minimum-version notes, installation/update expectations, support/reporting path, and checksum/provenance verification instructions. Remove beta-only claims that do not apply to stable.

## Sign-off matrix

| Gate | Decision | Approver | Date | Evidence link or artifact | Blocking notes |
| --- | --- | --- | --- | --- | --- |
| Beta feedback | pending | | | | |
| Known issues | pending | | | | |
| Engineering/quality | pending | | | | |
| Security | pending | | | | |
| Supabase RLS | pending | | | | |
| LiveKit | pending | | | | |
| Windows package/signing | pending | | | | |
| Linux package | pending | | | | |
| macOS signing/notarization | pending | | | | |
| Legal/privacy | pending | | | | |
| Operations/monitoring | pending | | | | |
| Support | pending | | | | |
| Product | pending | | | | |

Allowed decisions are `pass`, `pass with documented non-blocker`, `blocked`, and `fail`. Every required row must be `pass` or approved `pass with documented non-blocker` before promotion.

## Final decision and rollout

1. Complete `docs/go-no-go-checklist.md` against the final artifact.
2. Record `Go`, `Go with known non-blockers`, `No-Go`, or `Delay pending blocker fix` with approvers.
3. Publish immutable artifacts, checksums, provenance, final notes, and channel metadata atomically.
4. Begin the stable canary at the lowest approved percentage; never jump directly from beta to full stable rollout.
5. Monitor version/platform health and pause at the thresholds in the auto-update rollout gate.
6. Record promotion, pause, rollback, and completion decisions in the release record.

