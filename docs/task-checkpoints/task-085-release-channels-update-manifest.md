# Task 085 Checkpoint: Release Channels and Update Manifest

## Outcome

Standardized Picom's typed release-channel metadata and added a deliberately non-functional update manifest example.

## Changes

- Added a single `dev` / `beta` / `stable` type and resolver in `src/config/releaseChannel.ts`.
- Reused the centralized channel and existing app version in `appConfig` and `updateService`.
- Preserved release-channel visibility in redacted diagnostics.
- Added channel policy and manifest field documentation.
- Added a placeholder manifest with reserved non-production URLs, a fake checksum, and zero rollout.

## Safety

- No production URL, signing credential, provider token, or secret was added.
- Auto-download and auto-install remain disabled.
- No authentication, permissions, messaging, Electron window, Supabase, or LiveKit behavior changed.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
