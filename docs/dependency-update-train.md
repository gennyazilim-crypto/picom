# Dependency update train

## Policy

Picom runs a bounded monthly npm patch-update train. Dependabot may open reviewed pull requests; it never merges automatically. Automatic minor and major version updates are disabled.

**No automatic merge:** every dependency pull request requires human review, the applicable CI gates, and a documented rollback path.

The train supports Windows, Linux and macOS Electron stability. Dependency updates do not authorize UI redesign, mobile UI, a second icon system, unsafe native access, provider secrets or advanced feature scope.

## Groups

### Routine patch train

Safe patch candidates for React/Vite/TypeScript/build tooling and small transitive dependencies may be grouped, excluding Electron, Supabase and LiveKit. A group is split if one package obscures failure ownership or release notes indicate behavior change.

### Electron patch train

Electron and `@electron/*` patches stay in a separate PR. Required evidence:

- upstream release/security notes and Node/Chromium impact;
- contextIsolation/nodeIntegration/preload IPC/security smoke;
- custom titlebar, drag/no-drag, controls, normal/maximized frame;
- tray/notifications/protocol/single-instance/window state where available;
- Windows/Linux dev and package smoke; macOS package/signing evidence before mac release;
- artifact checksums/provenance and rollback package.

### Supabase patch train

`@supabase/*` patches stay separate. Verify auth login/register/session restore/revoke, profiles, communities/channels/messages, RLS/private channels, Realtime, Storage/upload, Functions and API error shapes. Static smoke does not replace live staging RLS/two-client tests.

### LiveKit patch train

`livekit-client` patches stay separate. Verify token contract, voice join/leave, mute/deafen, device selection/errors, reconnect, participant state, screen source/share/stop and track cleanup on all release platforms. Never expose token/API secret.

## Cadence

1. Dependabot opens at most four monthly patch PRs.
2. Maintainer confirms dependency purpose, release notes, vulnerability and license changes.
3. Regenerate/check `THIRD_PARTY_LICENSES.generated.md` when lockfile changes.
4. Run universal and dependency-specific gates.
5. Test production-like Electron/staging flow for runtime-provider patches.
6. Merge one risk group at a time during a monitored maintenance window.
7. Observe beta/internal ring before stable promotion.
8. Close/recreate stale or conflicted update PRs; never force broad lockfile changes.

Security-critical updates can use the emergency policy and need not wait for monthly cadence, but they still require the narrowest safe update, tests, rollout and rollback.

## Universal CI/review gates

- `npm ci`
- `npm audit --audit-level=moderate` with human reachability triage
- `npm run secrets:smoke`
- `npm run licenses:generate` then committed diff and `npm run licenses:check`
- `npm run qa:smoke`
- `npm run qa:supabase`
- `npm run typecheck`
- `npm run build`
- `npm run performance:budget:ci`
- visual and E2E coverage contracts
- checksum/provenance smoke for packaging changes

The repository QA workflow runs core gates on Windows and Ubuntu. macOS-specific runtime/package checks remain required before a macOS release.

## Minor and major updates

Dependabot ignores all automatic minor/major updates. Handle them as dedicated engineering tasks with:

- compatibility/release-note/migration assessment;
- API/runtime/schema/config/deprecation impact;
- dependency/bundle/license/vulnerability review;
- representative staging and platform matrix;
- local data/client-server backward compatibility;
- rollout rings, kill switch and rollback limitations;
- update-specific checkpoint and release notes.

Never run `npm update`/`npm audit fix --force` broadly or replace the lockfile without reviewing the exact graph.

## Rollback

1. Pause merge/release rollout and identify the update group/commit.
2. Revert only package/lock/config changes to the last known-good lockfile; do not edit transitive versions manually.
3. Reinstall with `npm ci` and rerun targeted/universal gates.
4. Confirm server/schema/desktop compatibility before rolling back Electron/Supabase/LiveKit.
5. Publish a new artifact/hotfix; do not mutate signed artifacts.
6. Document user impact, upstream issue, temporary exception and revisit date.

Database/local-data migrations are not automatically reversible through dependency rollback.

## Exceptions

Temporary pin/skip requires package/version, reason/reachability, compensating control, owner, expiry/revisit, release impact and security approval for critical/high risk. Never suppress the whole audit or license gate to pass one package.

## Ownership

- Desktop/Electron: Desktop Engineering placeholder
- React/Vite/TypeScript/build: Frontend/Build placeholder
- Supabase/Auth/RLS/Storage/Realtime: Backend placeholder
- LiveKit/media: Voice placeholder
- vulnerability/license/supply chain: Security/Release placeholders

Assign real primary/backups before stable maintenance begins.
