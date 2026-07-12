# Task 617 Checkpoint: V1 Core Scope Freeze and Feature Gate

## Result

Picom V1 Core now has a typed, disabled-by-default release-scope registry. V1-visible navigation and metadata consume the registry, while excluded feature code/data remain intact.

## Read-only audit evidence

- Branch: `main`
- Baseline commit: `a5574a5`
- Current stable decision before this task: `NO-GO`
- Current blocker source: `docs/release-blockers.md`
- Latest inspected Picom QA failure: run `29184042109`
- First failing step: `Build renderer and Electron bundles`
- Exact root cause: `src/components/RegisterScreen.tsx` imported untracked `assets/brand/picom-logo.png`

## Applied controls

- Added `src/config/v1ReleaseScope.ts` with `IN_V1`, `CONDITIONAL`, `HIDDEN_FROM_V1`, and `POST_V1` classifications.
- Set stable platform metadata to Windows only.
- Filtered global navigation, community kinds/channels, Help, Settings, community administration, Mention Feed filters/audio, Profile audio, search categories, and badges.
- Added renderer and notification deep-link rejection for excluded features.
- Removed the hidden Bookmarks command entry.
- Kept Voice Rooms and Screen Share conditional and disabled pending Task 621.
- Replaced untracked renderer logo imports with tracked `picom-logo-concept.png`.
- Added an executable scope contract.

## Preserved work

The pre-existing dirty working tree contained user/Cursor changes across renderer, assets, package files, and release folders. Those changes were not discarded, staged wholesale, or reformatted. Radio, Podcast, Meeting, Voice, Screen Share, Events, bot, webhook, and other post-V1 implementation/data remain in the repository.

## Release truth

This checkpoint freezes scope; it does not approve release. Hosted Supabase, Realtime/Edge Functions, conditional media, Windows signing/install, legal/ownership, backup/restore, RC, and final Go/No-Go tasks remain open.
