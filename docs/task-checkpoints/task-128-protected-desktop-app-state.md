# Task 128 checkpoint - Protected desktop app route/state

## Completed

- Added `useProtectedDesktopSession` hook.
- Moved auth session/loading/error logic out of `App`.
- Kept login/register screens and protected 4-column desktop app shell gated by the hook.
- Documented UX/security boundary and test steps.

## Changed files

- `src/hooks/useProtectedDesktopSession.ts`
- `src/App.tsx`
- `docs/protected-desktop-app-state.md`
- `docs/task-checkpoints/task-128-protected-desktop-app-state.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

This is a frontend state boundary only. Supabase RLS remains required for real data security.