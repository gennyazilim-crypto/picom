# Task 129 checkpoint - Implement logout

## Completed

- Added sign-out button to `UserMiniCard`.
- Passed logout action through `CommunitySidebar`.
- Connected App to `useProtectedDesktopSession().signOut`.
- Added focused danger hover styling for the compact sign-out action.
- Documented logout flow and test steps.

## Changed files

- `src/components/UserMiniCard.tsx`
- `src/components/CommunitySidebar.tsx`
- `src/App.tsx`
- `src/styles.css`
- `docs/logout.md`
- `docs/task-checkpoints/task-129-logout.md`

## Verification

- `npm run typecheck`
- `npm run build`

## Notes

No secrets are logged. Existing desktop layout remains unchanged.