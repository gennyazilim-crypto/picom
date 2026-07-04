# Avatarpack fallback checkpoint

## Completed

- Imported and optimized the desktop avatarpack into `public/avatarpack`.
- Added a typed avatar manifest.
- Added `avatarService` for one-time random fallback assignment.
- Added shared `MemberAvatar` component.
- Replaced duplicated initials-only avatar components in the MVP UI.

## Verification

- Run `npm run typecheck`.
- Run `npm run build`.
- Launch Picom and confirm members without `avatarUrl` show stable avatarpack images.
- Refresh/relaunch and confirm the same users keep the same fallback avatar.