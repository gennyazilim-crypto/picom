# Picom Safe Rollout Strategy

Picom is an Electron desktop community chat app for Windows, Linux, and macOS. This plan defines how beta and stable desktop releases should move through controlled rings without relying on mobile release flows or production auto-update being available yet.

This document is a production-readiness plan. It does not enable production auto-update, public marketplace distribution, or any advanced post-MVP feature by itself.

## Goals

- Reduce blast radius for risky desktop releases.
- Keep Windows, Linux, and macOS validation explicit.
- Provide clear pause, rollback, and communication criteria.
- Align future remote config and updateService behavior with release channels.
- Separate release blockers from known non-blockers.

## Non-goals

- No mobile rollout process.
- No production auto-update implementation.
- No paid crash or analytics provider integration.
- No feature marketplace, bots, plugins, or enterprise rollout process.
- No secret keys, signing credentials, or private distribution URLs in this document.

## Release rings

| Ring | Audience | Entry criteria | Exit criteria | Rollback or pause triggers |
| --- | --- | --- | --- | --- |
| Internal | Picom contributors and trusted local test machines | Quality gate passes, staging smoke test reviewed, release notes drafted | No blocker defects after focused Windows/Linux/macOS smoke | Startup crash, install failure, login blocker, message send blocker |
| Beta small group | Small invited tester group | Internal ring is green, checksums/provenance generated, known issues documented | Feedback triaged, no critical regression trend | Crash-free sessions below threshold placeholder, API errors above threshold placeholder |
| Beta all | All beta testers | Beta small group has no release blocker, support channel is staffed | Stable desktop usage with only known non-blockers | Realtime outage, upload outage, installer failure spike, private data access concern |
| Stable percentage rollout placeholder | Future staged stable users | Beta all passes go/no-go, rollback plan is ready, compatibility checked | Error and support volume stay within thresholds | Bad desktop update, corrupted artifact, backend compatibility issue |
| Stable full rollout | Full stable audience | Percentage rollout completes safely, incident response is ready | Release is promoted and monitored | Any security incident, data loss concern, or critical crash spike |

## Ring promotion checklist

- Release scope matches the locked Picom desktop MVP.
- `npm run quality:gate` or equivalent quality gate passes.
- Windows package smoke test is complete.
- Linux package smoke test is complete.
- macOS package smoke test is complete when macOS artifact is in scope.
- Staging smoke test is complete when backend changes are included.
- Release checksums are generated.
- Release provenance metadata is generated.
- Known issues are reviewed and tagged as blocker or non-blocker.
- Rollback runbook is reviewed.
- Incident response owner placeholder is assigned.

## Threshold placeholders

These thresholds are placeholders until real monitoring is connected. They should be tuned before production auto-update or wide stable rollout.

| Signal | Alert threshold placeholder | Rollback or pause threshold placeholder | User impact |
| --- | --- | --- | --- |
| Crash-free desktop sessions | Below 99% | Below 98.5% or repeated startup crash reports | App cannot be used reliably |
| Backend API error rate | Above 2% for 15 minutes | Above 5% for 15 minutes | Login, messages, settings, or attachments may fail |
| Message send success | Below 99% | Below 97% | Chat core flow is degraded |
| Realtime reconnect failure | Above 3% reconnect failure | Sustained outage or duplicate message reports | Users miss or duplicate live updates |
| Attachment upload success | Below 98% | Below 95% | Users cannot share images reliably |
| Installer failure | Above 3% of attempted installs | Above 5% or platform-specific installer break | Users cannot install or update |
| Support tickets | Unusual spike | Critical/common blocker reports | Release may need to pause |

## Rollback criteria

Pause rollout or roll back when any of these are confirmed:

- App fails to start for a meaningful share of testers.
- Authentication or session restore blocks normal use.
- Message sending fails or duplicates messages frequently.
- Private community/channel data appears accessible to unauthorized users.
- Installer or package artifacts are corrupted.
- A release artifact does not match published checksum/provenance.
- New release requires a backend version that is not safely deployed.
- Security incident or data loss is suspected.

## Update pause procedure placeholder

1. Mark the release as paused in the release tracker.
2. Disable future remote-config promotion for the affected release channel when remote config is available.
3. If future updateService rollout controls exist, stop serving the affected version as recommended/latest.
4. Keep already-installed users on the safest available path.
5. Publish a short known-issues note for beta testers.
6. Open or update an incident if user impact is active.
7. Use feature flags or emergency kill switches only for availability control, never as the only security boundary.

## Remote config and updateService alignment

Current state:

- Remote config is a safe configuration placeholder.
- updateService can represent update state, but production auto-update is out of scope.
- Release channels are expected to use `dev`, `beta`, and `stable` semantics.

Future alignment:

- `releaseChannel` should decide which rollout ring a desktop client belongs to.
- `recommendedClientVersion` should advance only after ring criteria pass.
- `minimumSupportedClientVersion` should move slowly and only after compatibility review.
- Emergency kill switches may disable risky features during rollout, but backend permissions must still enforce access.
- Update messaging should be clear: update available, update required, rollout paused, or known issue.

## Communication plan placeholder

Internal ring:

- Use engineering release notes and task checkpoint links.
- Keep communication concise and technical.

Beta rings:

- Share beta release notes, known issues, and required test flows.
- Ask testers to report platform, version, logs, and reproduction steps.
- Use plain language for impact and workaround.

Stable rings:

- Publish release notes before full rollout.
- Explain user-visible changes and known non-blockers.
- If paused, state that rollout is paused and existing users can continue using the previous safe version if available.

## Known issues handling

- Every known issue needs impact, workaround, owner placeholder, and blocker status.
- Known blockers prevent ring promotion.
- Known non-blockers can ship only if product, engineering, and support sign off.
- Duplicate beta reports should be grouped under one tracked issue.
- Resolved known issues should be verified in the next ring before promotion.

## Go / no-go relationship

The final go/no-go decision should reference:

- `docs/release-checklist.md`
- `docs/beta-release-notes.md`
- `docs/staging-smoke-test.md` when backend changes are included
- `docs/rollback-runbook.md`
- `docs/incident-response.md`
- This safe rollout strategy

## MVP release boundary

Safe rollout does not expand MVP scope. It only controls how a release reaches users.

Out of scope for this rollout plan:

- Mobile app rollout
- Bot marketplace
- Webhook production system
- Plugin runtime
- Enterprise release controls
- Billing
- Production auto-update
- Public discovery marketplace
- E2EE production
- Advanced analytics

