# Task 067 checkpoint - Generated avatar and community icon fallbacks

## Completed

- Added `src/utils/generatedIdentity.ts`.
- Updated `MemberAvatar` to use generated identity helpers for initials/gradient fallback.
- Updated ServerRail and CommunitySidebar to use community icon fallback labels.
- Kept avatarpack assignment as the primary missing-avatar behavior.

## Verification

- Run `npm run typecheck`.
- Run `npm run build`.
- Manually inspect member avatars and community icons in dev mode.