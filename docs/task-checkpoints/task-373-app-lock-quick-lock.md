# Task 373 - App lock / quick lock

## Result
- Added a blocking desktop quick-lock screen that hides chat content without logging out.
- Added `Ctrl + Shift + L` and Command Palette `Lock app` entry points.
- Added Settings > Advanced app-lock placeholder preference for future inactivity locking.
- Kept unlock local-only and clearly marked as placeholder; no password is stored.
- Logout from the lock screen uses the existing auth sign-out flow.

## Changed files
- `src/App.tsx`
- `src/components/AppLockScreen.tsx`
- `src/components/SettingsModal.tsx`
- `src/services/appLockService.ts`
- `src/services/shortcutService.ts`
- `src/styles.css`
- `docs/app-lock.md`
- `scripts/app-lock-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-373-app-lock-quick-lock.md`

## Commands run
- `npm run app-lock:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual verification
1. Run `npm run dev`.
2. Press `Ctrl + Shift + L` and confirm the lock screen covers the desktop app.
3. Type text in the unlock placeholder and press Enter.
4. Open Command Palette, run `Lock app`, and confirm it opens again.
5. Open Settings > Advanced and toggle the inactivity lock placeholder.
6. Confirm the normal four-column layout remains unchanged after unlock.

## Remaining notes
- Real password/MFA re-auth is intentionally deferred to a future Supabase-backed security task.
- Automatic idle locking is not enabled yet; only the local preference is prepared.
