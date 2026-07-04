# Avatar pack fallback avatars

Picom now uses the desktop `avatarpack` as the default fallback avatar source for users without a profile image.

## Source

- Local source folder: `C:\Users\ACER\Desktop\avatarpack`
- Imported app folder: `public/avatarpack`
- The original PNG files were optimized into 256x256 JPEG files before adding them to the app, keeping the repository small and the desktop UI fast.

## Behavior

- If a member has `avatarUrl`, Picom uses that profile image first.
- If a member does not have `avatarUrl`, `avatarService` assigns one avatar from the local pack.
- The assignment is random only the first time.
- The chosen avatar is persisted in localStorage under `picom-avatar-assignments-v1`.
- On later app launches, the same user keeps the same fallback avatar.
- If the user changes their profile picture later, `avatarUrl` overrides the fallback assignment.

## Files

- `src/data/avatarPack.ts` contains the static avatar URL manifest.
- `src/services/avatarService.ts` owns one-time assignment and persistence.
- `src/components/MemberAvatar.tsx` renders either the user image or initials fallback.

## Safety

- Avatar assignment failure must never crash the UI.
- No remote avatar service is required for MVP mock mode.
- No copyrighted external avatar URL is fetched at runtime.