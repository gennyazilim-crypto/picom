# Task 349 checkpoint: Safe Mode final test

## Completed

- Added a behavioral test that transpiles and executes the production settings and Safe Mode services in isolated memory storage.
- Verified corrupted settings backup/reset, forced Safe Mode reason and safe defaults.
- Verified settings reset, cache clear and redacted log export without clearing auth state.
- Verified two-crash activation, stable-start reset, query flag behavior and exactly one normal restart reload.
- Prevented crash-provider/sleep-wake startup, voice loading and remote block refresh while Safe Mode is active.
- Updated the banner copy and disabled-service list.

## Safety

- Safe Mode recovery never clears auth state or user drafts.
- Normal restart clears forced reason and crash count before reload, preventing an immediate infinite Safe Mode loop.
- Fatal capture may still write a local redacted recovery record, but the optional crash provider is not initialized during Safe Mode startup.
- No desktop layout, IPC, permission or backend behavior was redesigned.

## Validation

- `npm run safe-mode:final:test`
- `npm run safe-mode:smoke`
- `npm run safe-mode:production:test`
- `npm run crash:recovery:smoke`
- `npm run local-data:migration:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
