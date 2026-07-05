# Task 331 - Community Ownership Transfer

## Status

Completed.

## Scope

- Added an owner-only community ownership transfer placeholder service.
- Added an owner-only sidebar panel with target member selection and exact community-name confirmation.
- Added documentation and a smoke test.

## Changed files

- `src/services/communityOwnershipTransferService.ts`
- `src/components/CommunityOwnershipTransferPanel.tsx`
- `src/components/CommunitySidebar.tsx`
- `src/styles.css`
- `scripts/community-ownership-transfer-smoke-test.mjs`
- `package.json`
- `docs/community-ownership-transfer-placeholder.md`
- `docs/task-checkpoints/task-331-community-ownership-transfer.md`

## Verification

- `npm run community:ownership-transfer:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Open Picom in mock mode.
2. Use an owner/admin mock community where the current user is owner.
3. In the community sidebar, select a member and type the exact community name.
4. Click Prepare transfer and confirm only placeholder status changes.

## Notes

- Real ownership transfer must be enforced by trusted Supabase/backend logic later.
- No roles or memberships are changed by this placeholder.