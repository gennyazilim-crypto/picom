# Task 460 checkpoint: Desktop update failure recovery

## Status

Complete.

## Changed files

- `docs/update-failure-recovery.md`
- `src/services/updateService.ts`
- `src/components/SettingsModal.tsx`
- `scripts/update-failure-recovery-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-460-desktop-update-failure-recovery.md`

## Validation

- `npm run update:failure:smoke`
- `npm run react:hooks:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

No real updater endpoint was added. The Advanced settings section can show and simulate safe placeholder update failure states.
