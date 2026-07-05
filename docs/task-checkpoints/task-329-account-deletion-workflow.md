# Task 329 - Account Deletion Workflow

## Status

Completed.

## Scope

- Added a safe account deletion placeholder service.
- Added Settings > Account Danger Zone with exact-text confirmation.
- Added documentation and a smoke test.

## Changed files

- `src/services/accountDeletionService.ts`
- `src/components/SettingsModal.tsx`
- `src/styles.css`
- `scripts/account-deletion-smoke-test.mjs`
- `package.json`
- `docs/account-deletion-workflow-placeholder.md`
- `docs/task-checkpoints/task-329-account-deletion-workflow.md`

## Verification

- `npm run auth:account-deletion:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Start Picom in Electron dev mode.
2. Open Settings > Account.
3. Locate Danger Zone.
4. Confirm the deletion request button is disabled until the exact phrase is typed.
5. Request and cancel the placeholder deletion state.

## Notes

- No destructive deletion is performed.
- Real deletion requires trusted backend/Supabase admin flow and ownership-transfer handling later.