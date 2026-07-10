# Full MVP Git and Worktree Safety Strategy

Date: 2026-07-11
Primary repository: `C:\Users\ACER\Desktop\picom`
Rollback tag: `full-mvp-baseline-no-go-20260711`
Rollback commit: `c7fd74a5f07c68d8d46be2dc300c833c295077c9`

## Baseline state

At Task 432 start:

- Local `main` and `origin/main` both pointed to `c7fd74a`.
- The only local branch was `main`.
- The only existing tag was `task-350-complete`.
- The only worktree was the primary Picom path.
- Required Picom QA run `29130789196` passed for the rollback commit.
- Stable release remained `NO-GO`.

The annotated tag `full-mvp-baseline-no-go-20260711` was created and pushed at `c7fd74a`. It is a development rollback point, not an RC, release, signed build, hosted certification, or Go decision.

## Protected user-owned work

The following paths existed before Task 432 and are not owned by the Full MVP completion pack:

| Path | State | Policy |
| --- | --- | --- |
| `THIRD_PARTY_NOTICES.md` | Tracked, modified | Never stage, overwrite, restore, format, or discard without an explicit owner task |
| `src/components/AppIcon.tsx` | Tracked, modified | Iconix/AppIcon owner work; never stage or modify in Tasks 431-520 |
| `public/icons/iconix.svg` | Untracked source asset | Do not ignore, delete, stage, or regenerate |
| `scripts/generate-iconix-sprite.ps1` | Untracked source tooling | Do not ignore, delete, stage, or execute |
| `release-task-301/` | Untracked generated package/evidence, about 374 MB | Do not stage or delete; inspect only under an explicit release-evidence task |
| `release-task-357-20260710/` | Untracked generated package/evidence, about 374 MB | Do not stage or delete; inspect only under an explicit release-evidence task |

The release folders are intentionally not added to `.gitignore` in this task because their evidence/ownership status must be decided explicitly. Ignoring them would hide potentially important release material.

## Confirmed disposable paths

The following local-only outputs were confirmed as extracted task copies or Electron runtime output and are now ignored without being deleted:

- `.tmp/`: extracted historical task text and metadata.
- `tmp/`: extracted historical task text plus runtime logs.
- `tmp-electron-dev.err`: local Electron dev stderr.
- `tmp-electron-dev.out`: local Electron dev stdout.

Ignoring these paths prevents accidental staging. It does not authorize recursive deletion or conceal credentials; task validation must continue to avoid writing secrets into any temporary output.

## Branch policy

Tasks 431-520 use a linear `main` history because the primary worktree already contains protected user changes and the established project workflow requires each task commit to be pushed independently.

A permanent second branch/worktree is not created because advancing `main` from another checked-out branch while the primary worktree is dirty could desynchronize its index and user-owned files. If collaboration later requires pull requests, create a new clean clone or obtain explicit approval for a long-lived feature branch rather than updating the checked-out `main` ref behind the primary worktree.

## Per-task staging contract

For every task:

1. Run `git status --short` before reading or editing.
2. Record the task-owned file allowlist before applying changes.
3. Never use `git add -A`, `git add .`, blanket formatting, stash, reset, checkout, clean, or destructive restore.
4. Stage only the explicit allowlist with `git add -- <paths>`.
5. Inspect `git diff --cached --name-only` before commit.
6. Abort the commit if any protected or unrelated path appears.
7. Use the exact task commit message.
8. Push only after relevant local gates pass.
9. Watch the required Picom QA run before starting the next task.

## Clean validation worktree contract

Dependency installation and deterministic tests run in an isolated detached worktree whenever the primary `node_modules` is missing, locked, or influenced by user processes.

1. Create a unique path under `%TEMP%`, for example `picom-task-433-validation-<guid>`.
2. Resolve the path and verify it remains under the OS temp root.
3. Add a detached worktree at the current committed baseline.
4. Overlay only the current task's allowlisted files from the primary worktree.
5. Run `npm ci` and the required task gates there.
6. Capture command exit codes; warnings on stderr are not treated as fabricated failures or passes.
7. Remove only that verified temporary worktree and run `git worktree prune`.
8. Never copy `.env`, credentials, release secrets, user-owned Iconix files, or unrelated dirty files into validation.

Temporary worktrees are validation environments only. Commits remain in the primary repository after explicit staging review.

## Rollback procedure

The baseline tag is read-only evidence. If a later task causes a regression:

- Do not run `git reset --hard` or overwrite the dirty primary worktree.
- Identify the task commit and use a normal revert only after confirming it will not touch user-owned files.
- Compare against `full-mvp-baseline-no-go-20260711` in a separate detached worktree.
- Re-run required QA before pushing a corrective commit.

The tag must never be moved to make later work appear verified.

## Credential and artifact safety

- Real `.env` files remain ignored.
- Secrets, tokens, keys, certificates, passwords, and production URLs are never copied into task docs or logs.
- Generated packages and release evidence are not committed from the primary worktree.
- External/native/provider checks remain `BLOCKED` when their controlled environment is unavailable.

