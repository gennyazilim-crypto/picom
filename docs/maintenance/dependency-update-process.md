# Picom dependency update and audit process

## Policy

Picom dependency changes are reviewed release changes, not routine automatic merges. The app combines Electron main/preload/native packaging, React/Vite renderer code, Supabase auth/database/storage/realtime, and LiveKit/WebRTC; a small version change can affect security, startup, packaging, permissions, or user data access.

This process does not authorize a broad upgrade. No package or lockfile was changed by Task 106.

## Current groups and risk

| Group | Packages | Primary risks | Update class |
|---|---|---|---|
| Desktop runtime | `electron`, `electron-builder` | Chromium/Node security, IPC/preload behavior, native window/tray/notification/screen capture, packaging/signing | High |
| Renderer/runtime | `react`, `react-dom` | Hook/render behavior, hydration/runtime errors, bundle | Medium-high |
| Build/type tooling | `vite`, `@vitejs/plugin-react`, `typescript`, `@types/*` | HMR/build output, transforms, CSP/assets, type regressions | Medium-high |
| Supabase | `@supabase/supabase-js` | Session/auth semantics, RLS-facing queries, realtime, Storage, Edge invocation | High |
| LiveKit | `livekit-client` | Token/room compatibility, media devices, reconnect, screen share, bundle size | High |
| Desktop dev helpers | `concurrently`, `wait-on` | Dev startup/process lifecycle only | Low-medium |
| Test/smoke tooling | repository `scripts/*.mjs` and future test libraries | False confidence, Node compatibility, CI time | Medium |

Treat direct and transitive major changes as planned work. Electron, Supabase, LiveKit, Vite, React, TypeScript, and electron-builder minor updates also require release-note review because their contracts can shift without Picom code changes.

## Ownership and cadence

- Security advisories: triage continuously; use `docs/dependency-vulnerability-policy.md` timelines.
- Patch maintenance: monthly small batch, sooner for reachable security fixes.
- Minor versions: scheduled, one risk group at a time.
- Major versions: dedicated design/migration task and release ring.
- Electron runtime: align with supported/security-maintained upstream line after compatibility testing; do not update merely to match newest.
- Before every beta/stable candidate: audit current lockfile and document accepted exceptions.

Each update needs an engineering owner, reviewer, risk class, affected surfaces, test plan, rollback commit/artifact, and release target.

## Preparation

1. Start from a clean, known-good commit and current `main`.
2. Record Node/npm versions used by CI/release.
3. Install the existing graph with `npm ci`; do not rewrite lockfile during baseline.
4. Run baseline quality, build, bundle, and affected manual flow.
5. Review upstream release notes/security advisories and migration guides.
6. Identify direct package, transitive changes, licenses, native binaries, postinstall scripts, minimum Node/OS requirements, and known issues.
7. Confirm the feature/runtime remains in Picom scope and does not add another icon/UI system or mobile surface.

## Audit commands

Safe inventory commands:

```powershell
npm ci
npm outdated
npm audit --audit-level=moderate
npm ls --all
npm run bundle:size:audit
```

`npm audit fix` and `npm audit fix --force` are **not** approved update procedures. They can rewrite unrelated transitive versions or introduce breaking majors. Apply and review the smallest explicit package change instead.

Alternative/secondary signals:

- GitHub dependency/security alerts and Advisory Database.
- Open-source OSV-Scanner placeholder against `package-lock.json` in CI.
- Electron, React, Vite, TypeScript, Supabase, LiveKit, and electron-builder upstream advisories/releases.
- License/third-party notice review.
- Secret scanner and artifact inspection for compromised package behavior.

Scanner output requires human reachability analysis. A build-only advisory is not automatically harmless; a runtime advisory is not automatically exploitable. Document package path, shipped surface, exploit prerequisites, fix version, mitigation, owner, and revisit date.

## Update execution

1. Update one risk group or one tightly related package set.
2. Prefer an explicit target version; avoid broad `latest` refreshes.
3. Use `npm install --save-exact <package>@<version>` where the project decides exact pinning, or preserve the existing range deliberately while reviewing the resolved lock version.
4. Review `package.json` and the entire `package-lock.json` diff before running application changes.
5. Reject unexpected package additions, registry/URL changes, integrity removals, git/file dependencies, native artifacts, lifecycle scripts, license changes, or large transitive churn.
6. Keep dependency and required compatibility code in the same scoped change; no unrelated refactor.
7. Regenerate/install only through the approved npm/Node versions.

## Lockfile policy

- `package-lock.json` is required and committed.
- CI, clean development validation, and release builds use `npm ci`.
- `npm install` is used only when intentionally changing dependency resolution.
- Never hand-edit integrity hashes or resolved URLs.
- Do not delete/recreate the lockfile to silence a conflict or audit finding.
- Merge conflicts are resolved by choosing reviewed `package.json` intent and regenerating with the approved npm version, then reviewing the resulting graph.
- One dependency update change must not contain unexplained lockfile churn from unrelated packages.
- Release provenance records commit, package version, Node/npm versions, and artifact checksum.

Current `latest` and caret ranges increase accidental-resolution risk. Migrating high-risk direct packages to deliberate versions should be a separate reviewed task, not mixed into an emergency fix.

## Required automated checks

Always:

```powershell
npm ci
npm run typecheck
npm run mock:smoke
npm run qa:smoke
npm run build
npm run bundle:size:audit
npm audit --audit-level=moderate
```

Add by group:

### Electron / electron-builder

```powershell
npm run electron:security:smoke
npm run desktop:ipc:security:smoke
npm run renderer:native:smoke
npm run packaging:smoke
```

Build/install platform artifacts in native CI/hosts. A Windows package built on Windows does not certify Linux/macOS.

### React / Vite / TypeScript

```powershell
npm run react:hooks:smoke
npm run csp:smoke
npm run desktop:smoke
npm run localization:qa:smoke
```

Inspect production asset paths, dynamic imports, initial theme, error boundary, and bundle regression.

### Supabase client

```powershell
npm run supabase:smoke
npm run qa:supabase
npm run supabase:api-regression
npm run supabase:rls:production-safe
```

Live RLS/auth/storage/realtime checks require isolated staging identities; static smoke is not enough.

### LiveKit client

```powershell
npm run livekit:smoke
```

Also run real two-client voice and screen-share QA against staging token Function/provider.

### Test tooling

Run the tests before and after updating the test runner/library against a deliberately failing fixture or known failure. Confirm CI exit codes, timeouts, cleanup, screenshot paths, and coverage/selection did not silently change.

## Manual Electron smoke after every runtime-impacting update

Test normal and maximized window modes on supported platforms:

1. Clean install/start and existing-user start.
2. Custom titlebar, no native File/Edit/View menu, drag/no-drag areas, minimize/maximize/restore/close.
3. Light/dark startup without white/black flash.
4. Login, registration, session restore, terms reacceptance, onboarding, logout.
5. Four-column community layout, Mention Feed, Profile, settings/modals/context menus.
6. Community/channel switching, message send/edit/delete/reaction/reply/realtime reconnect.
7. Private channel and visitor/member RLS boundaries using staging identities.
8. Image upload/preview/private access/quarantine states.
9. Voice join/leave, mute/deafen, device change, screen share start/stop, permission denial.
10. Tray/notifications/protocol/clipboard/file/window IPC surfaces affected by Electron.
11. Sleep/wake, offline/reconnect, second instance/deep link, safe mode/crash recovery.
12. Package install/uninstall and artifact checksum/provenance for Windows, Linux, and macOS release targets.

Record platform, OS version, package format, app version, commit, dependency versions, result, and redacted issue IDs.

## Review and promotion

The reviewer confirms:

- Package/lockfile diff matches intent.
- Advisory is fixed or exception is documented.
- Licenses/notices remain acceptable.
- No renderer Node/service secret exposure.
- RLS/backend permissions remain authoritative.
- Bundle/startup/package size regressions are understood.
- Required automated and manual evidence exists.
- Rollback version remains compatible with current database/backend/local settings.

Promote through internal, small beta, wider beta, then stable rings. Pause on crash, login, send, private access, upload, voice, installer, or artifact-integrity regression.

## Rollback

1. Pause rollout and preserve audit/build evidence.
2. Revert `package.json`, `package-lock.json`, and compatibility code together to the known-good commit.
3. Run `npm ci`; never reuse a partially updated `node_modules` as rollback evidence.
4. Re-run targeted and baseline gates.
5. Rebuild/re-sign/re-checksum artifacts; do not republish old version under a new checksum/version.
6. Check database/API/local-data forward/backward compatibility before desktop/backend rollback.
7. Record incident/postmortem if users were affected.

## Exception record

A temporary exception requires advisory/package/path, reachability analysis, affected platforms, compensating control, owner, expiry/revisit date, release impact, and security approval. Critical reachable Electron/renderer/Auth/private-data issues cannot be accepted merely because the build passes.
