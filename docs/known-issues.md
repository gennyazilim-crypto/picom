# Picom Known Issues

Status date: 2026-07-11
Decision context: Full MVP Partial; Stable No-Go

Tester distribution, withdrawal, and rollback remain governed by `docs/beta-distribution-portal.md`. An item marked blocker must not be hidden in release notes.

## Status labels

- `blocker`: required before a release candidate can be approved.
- `critical`: required before wider beta unless explicitly risk-accepted.
- `major`: acceptable only for constrained internal testing with a documented limitation.
- `minor`: does not invalidate the current local build.
- `external-blocked`: needs hosted/native/legal/owner evidence unavailable to local source checks.

## Current issues

### KI-001: Renderer performance budget fails

- Status: `blocker`
- Area: Renderer performance
- Platforms: Windows, Linux, macOS
- Evidence: `initialJs=1757.0 KiB` exceeds the 1650.0 KiB hard cap; `initialCss=240.8 KiB` exceeds the 240.0 KiB hard cap.
- Impact: The required performance gate exits non-zero. Build success does not override it.
- Required action: Audit the current entry/static graph and global CSS after concurrent UI work is frozen. Do not raise or disable the caps merely to pass.

### KI-002: Generated license report is stale

- Status: `blocker`
- Area: Third-party licensing
- Evidence: `npm run licenses:smoke` passes, but `npm run licenses:check` exits non-zero and reports a missing/stale generated report.
- Impact: The source/asset dependency inventory cannot be certified for release.
- Required action: Reconcile package/assets/notices after concurrent work is complete, run the approved generator, review the diff, and make both license gates pass.

### KI-003: Current validation is not tied to a clean immutable candidate

- Status: `blocker`
- Area: Release reproducibility
- Evidence: User-owned Cursor changes were present while Task 520 commands ran.
- Impact: Local outcomes describe the current working tree, not solely the audited Git commit.
- Required action: Preserve and review user changes, commit them intentionally, use a clean checkout, and rerun all gates.

### KI-004: Full staging E2E is blocked

- Status: `external-blocked`
- Area: Supabase/desktop E2E
- Evidence: Task 519 contract covers 18 flows, but the record is 0 PASS, 0 FAIL, 18 BLOCKED.
- Impact: Registration/onboarding, community kinds, Text, Radio, Podcast, Friends/DM, Profile, Feed, Settings, moderation, session restore and privacy are not certified together against one staging candidate.
- Required action: Provision protected staging, synthetic actor fixtures, two clients and redacted evidence; run the guarded matrix.

### KI-005: Hosted Supabase closure remains partial

- Status: `external-blocked`
- Area: RLS, Storage, Realtime and Edge Functions
- Evidence: Structural QA passes; Supabase CLI pgTAP is skipped locally; private Presence, broader Storage lifecycle and deployed Edge request evidence remain incomplete.
- Impact: Local contracts cannot certify cross-user isolation or deployed behavior.
- Required action: Run approved hosted actor/content and lifecycle matrices without exposing secrets.

### KI-006: Voice and native screen share are not certified

- Status: `external-blocked`
- Area: LiveKit and Electron desktop capture
- Platforms: Windows, Linux, macOS
- Evidence: Local token/device/reconnect/bridge/publish contracts pass; no complete two-client/native matrix exists.
- Impact: Media permissions, remote render, reconnect and cleanup are not release-proven.
- Required action: Run provider-backed two-client voice and platform-native screen-share certification.

### KI-007: No immutable trusted cross-platform artifact set exists

- Status: `external-blocked`
- Area: Packaging and trust
- Evidence: Unsigned Windows development/beta files exist; Linux and macOS stable artifacts do not.
- Impact: Stable checksums/provenance, clean-machine install, trusted publisher, notarization and rollback cannot be certified.
- Required action: Build from one frozen source commit on native runners, sign/notarize where required, then install/smoke/hash/provenance-test exact bytes.

### KI-008: Production ownership, legal approval and restore evidence are open

- Status: `external-blocked`
- Area: Operations, legal, privacy and database recovery
- Evidence: RB-09, RB-10 and RB-11 remain open.
- Impact: Production custody, policy authority and recoverability are not approved.
- Required action: Assign accountable owners, obtain authorized approvals and complete a compatible isolated restore plus guarded lifecycle drill.

### KI-009: Visual and UI E2E checks are contracts, not executed UI tests

- Status: `major`
- Area: Desktop QA
- Evidence: Visual contract maps 33 scenarios; E2E contract maps 17 flows; no Playwright/Electron pixel/click runner is active.
- Impact: Regressions can still escape source-level contract checks.
- Required action: Add a reviewed deterministic desktop runner, fixed fixtures, redacted artifacts and tuned cross-platform baselines.

### KI-010: Windows package output can be locked by stale Picom processes

- Status: `minor`
- Area: Windows packaging
- Symptom: Electron builder may fail while renaming a temporary unpacked folder.
- Workaround: Close only Picom project processes, remove the confirmed project-local temporary output, and retry.
- Safety: Do not terminate unrelated Electron applications or delete broad temporary directories.

## Intentional scope boundaries

These are not bugs and must not be advertised as implemented:

- No mobile app or mobile layout.
- No Discord branding, copied assets, copied layouts, logos or exact colors.
- No production auto-update.
- No bot marketplace, plugin runtime, enterprise admin console, billing or public discovery marketplace in this Full MVP completion decision.

## Review rule

Close an issue only with the named command/evidence on the exact candidate. Missing credentials, skipped providers, documentation or a local contract cannot be converted into PASS.
