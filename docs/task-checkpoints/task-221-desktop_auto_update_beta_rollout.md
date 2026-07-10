# Task 221 checkpoint: desktop auto-update beta rollout

## Result

- Kept production and beta auto-update disabled because signing, notarization, immutable feed, monitoring ownership, and explicit approval are not complete.
- Added a staged internal/1%/10%/50%/100% beta rollout contract with promotion and pause gates.
- Defined signed manifest, renderer/main-process security boundary, Windows/macOS constraints, Linux manual-distribution decision, failure recovery, and rollback requirements.
- Added a deterministic smoke test proving `updateService.autoUpdateEnabled` remains false and no updater dependency/endpoint is introduced.
- Restored the existing safe rollback-state simulation in Advanced settings; it changes local placeholder state only and cannot invoke an installer.

## Validation

- `npm run update:beta:rollout:smoke`
- `npm run update:failure:smoke`
- `npm run safe-rollout:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
