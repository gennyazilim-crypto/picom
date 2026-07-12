# Task 612 checkpoint: User Settings and Community Settings separation

## Completed

- Added canonical user/community settings taxonomies and a role-aware destination policy.
- Limited User Settings opening to the global sidebar Settings handler.
- Removed Settings from keyboard shortcuts, command palette, generic deep links, app menu, tray, profile actions, ServerRail, and CommunitySidebar/UserMiniCard.
- Made current-user profile Edit and Verification actions render only when an explicitly authorized callback exists; the global shell no longer supplies those callbacks.
- Preserved Community Header -> Community Menu as the sole role-aware community settings path.
- Documented compatibility aliases and isolated state ownership.

## Validation

- `node scripts/settings-separation-smoke.mjs`
- `node scripts/community-only-serverrail-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- visual/E2E contracts and renderer performance budget
