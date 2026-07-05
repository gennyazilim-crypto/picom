# Task 411: Entity store normalization

## Scope
- Added the smallest safe normalized-store foundation.
- Did not migrate runtime state or refactor the existing desktop UI.

## Completed
- Added `src/state/entityStore.ts` with a normalized snapshot model and typed selectors.
- Preserved existing nested `Community[]` app state.
- Documented why a full store migration is deferred.
- Added a smoke test that verifies the helper and docs exist.

## Verification
- Run `npm run entity-store:smoke`.
- Run `npm run typecheck`.

## Manual test steps
1. Open the app and confirm the 4-column desktop layout still renders.
2. Switch communities and channels.
3. Send a local/mock message.
4. Search members.
5. Open Mention Feed and Profile View.

## Notes
- This foundation reduces future duplicated state risk without destabilizing current MVP flows.
