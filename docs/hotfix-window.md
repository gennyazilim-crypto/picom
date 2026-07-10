# Stable Hotfix Window

Status date: 2026-07-10  
Window status: **Not opened**

No stable release was distributed and no production incident occurred. Therefore there is no eligible stable hotfix, artifact replacement, version bump, or redistributing action in this window.

## Eligibility

A future hotfix window is limited to:

- Launch/startup crash.
- Critical login/session/message failure.
- Data loss, private-data leak, authorization bypass, or secret exposure.
- Installed package that cannot launch or is corrupted.
- Severe voice/screen-share crash when included in the release promise.
- Distribution/update issue that requires immediate rollback or replacement.

Feature work, redesign, backlog cleanup, dependency modernization without an incident, and speculative optimization are not hotfixes.

## Required hotfix record

Every hotfix must include:

1. Incident/issue ID, affected version/platform/users, and severity.
2. Root cause and narrow fix scope.
3. Security/privacy/data-migration impact.
4. Automated and platform-specific tests.
5. Rollback/kill-switch plan.
6. New immutable version, checksums, provenance, and release notes.
7. Named engineering/security/operations approval.
8. Distribution ring and monitoring thresholds.

Artifacts must never be silently replaced under the same version. Database rollback must be evaluated separately and may be unsafe.

## Current decisions

- Pre-release smoke assertion fixes from Tasks 352-354 remain ordinary release preparation commits, not hotfixes.
- No user-facing stable artifact changed.
- No production release notes or known issues require a hotfix addendum.
- The active No-Go and release blockers remain authoritative.
