# Task 490 - Advanced Diagnostics Logs Cache and Data Settings

## Completed

- Completed build/runtime/data-source/Supabase/Realtime/LiveKit diagnostics presentation and redacted export behavior.
- Added diagnostics-only private-content field redaction on top of existing credential redaction.
- Added filtered log copy, retained export, and confirmation-protected log clearing.
- Replaced fake message-cache success copy with truthful non-persisted status and confirmation-protected bounded cache actions.
- Added bounded layout and local-settings reset actions with explicit preservation copy.
- Added Safe Mode restart, development/support first-launch reset confirmation, and local migration status.
- Added a safe remote-config support URL with repository issue-intake fallback.
- Updated local migration documentation to settings schema version 9.

## Validation

- `npm run settings:advanced-diagnostics:smoke`
- `npm run settings:diagnostics:smoke`
- `npm run support:diagnostics:final:test`
- `npm run logs:smoke`
- `npm run logs:redaction:regression:test`
- `npm run disk-cache:smoke`
- `npm run safe-mode:final:test`
- local-data migration smoke command from `package.json`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

External support availability and native file/clipboard dialogs remain runtime/platform checks. No hosted or native success is fabricated here.
