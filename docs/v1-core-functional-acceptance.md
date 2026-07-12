# Picom V1 Core Functional Acceptance

## Decision

Local implementation contracts are **PASS**. End-to-end staging and installed-Windows acceptance are **BLOCKED**, not failed and not certified. The protected staging actors/fixtures do not exist in GitHub, this machine has no hosted test credentials, and the packaged first-launch run belongs to Task 624.

Status vocabulary:

- `PASS_LOCAL`: source/service/RLS contract or deterministic local smoke passed.
- `BLOCKED_HOSTED`: requires real `picom-staging` actors, data, Storage, Realtime or Edge deployment.
- `BLOCKED_NATIVE`: requires a clean installed Windows candidate.
- `HIDDEN`: route is excluded by the V1 registry and tested inaccessible.

## Acceptance matrix

| V1 path | Local evidence | External evidence required | Status |
|---|---|---|---|
| First Launch Setup | persistence/no-repeat smoke | clean installed Windows first run | PASS_LOCAL / BLOCKED_NATIVE |
| Register, login, logout, session restore | Auth/profile/onboarding contract; all authenticated entry reasons resolve to Feed | real staging accounts and restart | PASS_LOCAL / BLOCKED_HOSTED |
| Feed | Supabase service boundary and query smoke | staging public/private content and restart | PASS_LOCAL / BLOCKED_HOSTED |
| Text communities and channels | text template, public join, role access contracts | owner/admin/mod/member/visitor staging matrix | PASS_LOCAL / BLOCKED_HOSTED |
| Text send/edit/delete | service/RPC and RLS contracts | two-client staging message run | PASS_LOCAL / BLOCKED_HOSTED |
| Attachments | validation, signed URL and delivery contract | private Storage upload/download/restart | PASS_LOCAL / BLOCKED_HOSTED |
| Replies and reactions | production reply and DM interaction contracts | two-client staging reconciliation | PASS_LOCAL / BLOCKED_HOSTED |
| Read/unread | production read-state contract | two-client staging persistence | PASS_LOCAL / BLOCKED_HOSTED |
| Profile and avatar/cover | profile media bucket, owner RLS, replacement cleanup contract | staging upload, restart and cross-surface check | PASS_LOCAL / BLOCKED_HOSTED |
| Friends | request/privacy/service contract | two-account request/accept/remove | PASS_LOCAL / BLOCKED_HOSTED |
| Direct Messages | participant RLS, service, Realtime, UI recovery and central navigation contracts | participant/nonparticipant two-client run | PASS_LOCAL / BLOCKED_HOSTED |
| User Settings | typed persistence and architecture contract | staging profile/privacy persistence where applicable | PASS_LOCAL / BLOCKED_HOSTED |
| Community Admin core roles | role access and role-management contracts | owner/admin/mod/member/visitor mutation matrix | PASS_LOCAL / BLOCKED_HOSTED |
| Help and Support | safe navigation and diagnostics export contract | feedback provider is not required for local help | PASS_LOCAL |
| Diagnostics | redaction, aggregate status and explicit export contract | packaged-path review in Task 624 | PASS_LOCAL / BLOCKED_NATIVE |
| Installer startup | branding and first-launch structure contract | signed/installed candidate startup | PASS_LOCAL / BLOCKED_NATIVE |

## Landing and navigation policy

Login, registration, onboarding completion, session restore and relaunch all use the centralized authenticated entry router and land on Feed. Direct Messages is exposed through the global V1 navigation registry; the obsolete `ServerRail.onOpenDirectMessages` assertion was removed from its smoke test.

Hidden/post-V1 routes are filtered at global navigation, community kind, active view, deep-link, search, quick-filter and admin-section boundaries. Radio, Podcasts, Events, Bookmarks, Meeting Workspace and Discovery cannot be certified or entered through normal V1 navigation. Their stored data and source code remain intact.

## Fixes in this pass

1. Updated the DM production smoke to the current centralized navigation architecture instead of requiring a removed prop.
2. Updated diagnostics coverage to the aggregate `voiceDiagnosticsRegistry`; Task 668 includes Voice and Screen Share while diagnostics remain redacted and provider-secret-free.
3. Added a V1 functional acceptance contract that guards scope, Feed landing, DM navigation, fail-closed production data source and truthful evidence labels.

No product feature or UI behavior was changed because the targeted local contracts exposed no current functional defect.

## Hosted execution blocker

Task 619 confirms the `picom-staging` dashboard project exists, but there is no protected `hosted-staging` GitHub environment, synthetic actor credential set, fixture variables or current immutable hosted run. Therefore no backend row in this document is marked hosted PASS. Follow `docs/v1-hosted-supabase-closure.md`, then attach the workflow URL and commit SHA here.

## Native execution blocker

Installer structure is locally valid, but clean-machine installation, first-run persistence, restart, profile-media persistence and diagnostics path checks must use the exact Task 624 candidate. Do not infer installed behavior from Vite or unpacked output.
