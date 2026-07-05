# App Lock / Quick Lock

Picom supports a local quick-lock foundation for the desktop app shell.

## Current behavior

- Shortcut: `Ctrl + Shift + L`
- Command Palette command: `Lock app`
- Lock screen component: `src/components/AppLockScreen.tsx`
- Settings placeholder: Settings > Advanced > App lock
- Local settings service: `src/services/appLockService.ts`

The quick lock hides chat content behind a blocking desktop overlay while keeping the current session intact.

## Security boundaries

- No password is stored locally.
- No unlock secret is persisted.
- The placeholder unlock is local-only and should be replaced by Supabase re-auth before production security claims are made.
- Logout from the lock screen uses the existing auth logout flow.
- The lock overlay does not expose messages behind it because it uses a high z-index blocking modal.

## Future work

- Supabase re-auth before unlock.
- Native idle detection after a safe Electron idle API review.
- Optional lock after inactivity using the local preference already prepared by `appLockService`.
- Clear sensitive temporary composer/upload state if production security requires it.

## Manual verification

1. Run `npm run dev`.
2. Press `Ctrl + Shift + L`.
3. Confirm the app lock screen appears and chat content is obscured.
4. Type any placeholder text and press Enter or click `Unlock locally`.
5. Open Command Palette and run `Lock app`.
6. Open Settings > Advanced and toggle the inactivity lock placeholder.
7. Confirm `Log out` from the lock screen signs out through the normal auth flow.
