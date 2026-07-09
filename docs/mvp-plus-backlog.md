# Picom MVP+ Backlog

This backlog is evidence-driven planning only. It does not authorize implementation or change the locked Full MVP/stable No-Go decision.

## Priority definitions

- **P0 urgent hotfix/release blocker:** security/privacy/data loss/core unavailable or required evidence blocking release.
- **P1 next patch:** high-impact reliability/performance defect with bounded scope and no major product expansion.
- **P2 next minor:** validated UX/workflow improvement after stable core is proven.
- **P3 later roadmap:** optional/new surface requiring separate scope, architecture, privacy, and ownership.

## P0 - release blockers

| ID | Category | Item | Rationale / acceptance evidence |
| --- | --- | --- | --- |
| MVP+-P0-01 | Supabase/RLS | Run real migration + owner/admin/mod/member/visitor/private channel pgTAP/staging matrix | No unexpected allow/deny; archived redacted evidence |
| MVP+-P0-02 | Upload/Storage | Implement authenticated signed-URL refresh for historical private attachments | Reload/expiry/access-loss/unauthorized tests pass; no URL persisted |
| MVP+-P0-03 | Realtime | Run/fix deployed two-window ordering/reconnect/cleanup/private subscription | Insert/update/delete/reconnect exactly once; private rows denied |
| MVP+-P0-04 | Voice/screen share | Deploy token function and pass two-user native platform matrix | Correct identity/room/TTL, media controls/share/leave cleanup pass |
| MVP+-P0-05 | Packaging | Produce and smoke supported native Linux/macOS artifacts | Clean install/launch/upgrade/uninstall/media smoke evidence |
| MVP+-P0-06 | Release security | Complete stable Windows/macOS signing/notarization | Valid signatures/timestamps/notary/Gatekeeper evidence |
| MVP+-P0-07 | Operations | Execute isolated backup restore/rollback drill | RTO/RPO/integrity/app smoke and approver evidence |
| MVP+-P0-08 | Legal/policy | Finalize Terms/Privacy/consent/license/publisher/support approval | Named dated legal/product/privacy sign-off |

## P1 - next patch after blocker closure

| ID | Category | Item | Rationale / acceptance evidence |
| --- | --- | --- | --- |
| MVP+-P1-01 | Performance | Measure and split heavy startup/LiveKit bundles where justified | Meets approved performance budget; no startup/voice regression |
| MVP+-P1-02 | Auth/social login | Harden Google/Apple provider callback/session error recovery on packaged apps | Windows/Linux/macOS packaged callback denial/success tests pass |
| MVP+-P1-03 | Diagnostics | Add fake-value regression fixtures for new provider/error fields | Secrets/log/diagnostics smoke covers every new field |
| MVP+-P1-04 | Upload | Resolve thumbnail/signed URL refresh and failed orphan cleanup workflow | Private delivery works; cleanup remains safe/dry-run first |
| MVP+-P1-05 | Voice/network | Improve reconnect/degraded UX only from measured native failures | No duplicate participants/stale capture; text chat remains usable |

## P2 - next minor candidates

| ID | Category | Candidate | Why not earlier |
| --- | --- | --- | --- |
| MVP+-P2-01 | UX polish | Address repeated verified desktop layout/accessibility friction | Wait for real platform/user evidence; preserve design |
| MVP+-P2-02 | Onboarding | Improve completion/profile/community/follow steps from observed drop-offs | No analytics/provider or fake funnel assumptions now |
| MVP+-P2-03 | Community management | Refine owner/admin/mod/member workflows and audit context | Only after RLS/live permission evidence is stable |
| MVP+-P2-04 | Moderation | Expand report/moderation actions from safety incidents | Requires clear policy, permissions, audit, appeals boundaries |
| MVP+-P2-05 | Friends/profile | Improve existing local follow/friend status behavior | Do not turn it into DM scope without approval |

## P3 - parked future scope

| Category | Status | Reconsideration gate |
| --- | --- | --- |
| DM/friends messaging | Parked | Core stable launch, privacy/abuse model, backend schema/RLS, product approval |
| Bots/webhooks | Parked | Stable API/security/rate-limit/audit model and explicit scope |
| Plugin/platform runtime | Parked | Sandboxing/signing/review/UI restrictions and separate architecture approval |
| Enterprise | Parked | Customer requirement, SSO/SCIM/compliance/support/deployment ownership |
| Analytics | Parked | Privacy/legal approval, consent, minimized event schema, provider/security decision |
| Public discovery | Parked | Moderation/abuse/privacy/age-region controls and operational staffing |
| Production auto-update | Parked | Signing, signed metadata, rollout/rollback/update failure recovery approval |
| Production E2EE | Parked | Cryptographic protocol/key/device/recovery/search/moderation design and expert review |

## Intake template

```text
ID:
Source/evidence:
Category:
Problem (not proposed solution):
Affected version/platform/environment:
Impact and frequency:
Security/privacy/data considerations:
Priority rationale:
Owner:
Acceptance evidence:
Dependencies:
Target release:
Status:
```

## Scope rules

- P0/P1 do not permit unrelated redesign or feature expansion.
- Frontend permission hiding never replaces RLS/backend enforcement.
- No mobile or browser-first UI enters this desktop backlog.
- No Discord branding/assets/exact colors.
- Moving a parked item into delivery requires updated scope/ADR/security/privacy/release plans.
