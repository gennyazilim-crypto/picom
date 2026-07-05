# Task 330 - Data Export Placeholder

## Status

Completed.

## Scope

- Added a safe local data export placeholder service.
- Added Settings > Account data export controls.
- Added documentation and a smoke test.

## Changed files

- `src/services/dataExportService.ts`
- `src/components/SettingsModal.tsx`
- `src/styles.css`
- `scripts/data-export-placeholder-smoke-test.mjs`
- `package.json`
- `docs/user-data-export-placeholder.md`
- `docs/task-checkpoints/task-330-data-export-placeholder.md`

## Verification

- `npm run privacy:data-export:smoke`
- `npm run typecheck`
- `npm run qa:smoke`
- `npm run build`

## Manual test

1. Start Picom in Electron dev mode.
2. Open Settings > Account.
3. Click Request data export placeholder.
4. Click Download export JSON placeholder.
5. Inspect the downloaded JSON and confirm it excludes credentials, tokens, hashes, and private server fields.

## Notes

- This is a local placeholder, not the production export system.
- Production export should run through a trusted backend job with user authorization checks.