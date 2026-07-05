# Task 332 - Community Delete Safety

## Status

Completed.

## Scope

- Added owner-only community delete safety placeholder service.
- Added sidebar delete safety card with exact community-name confirmation.
- Added documentation and a smoke test.

## Changed files

- `src/services/communityDeleteSafetyService.ts`
- `src/components/CommunityDeleteSafetyPanel.tsx`
- `src/components/CommunitySidebar.tsx`
- `src/styles.css`
- `scripts/community-delete-safety-smoke-test.mjs`
- `package.json`
- `docs/community-delete-safety-placeholder.md`
- `docs/task-checkpoints/task-332-community-delete-safety.md`

## Verification

- `npm run community:delete-safety:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Open Picom in mock mode.
2. Use a mock community where current user is owner.
3. Type the exact community name in Delete safety.
4. Prepare the placeholder and confirm the community remains intact.

## Notes

- No destructive deletion occurs.
- Real deletion must be backend-enforced and should preserve audit history.