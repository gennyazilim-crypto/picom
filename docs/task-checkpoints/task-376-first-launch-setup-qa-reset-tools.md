# Task 376 Checkpoint: First Launch Setup QA and Reset Tools

## Result

Added a development-only first-launch reset path and extended structural smoke
coverage without changing production setup behavior.

## Implemented

- Added Settings > Advanced reset control guarded by `import.meta.env.DEV`.
- Reset affects only the first-launch completion flag.
- Added a clear restart/preservation confirmation toast.
- Extended smoke coverage for the reset control and safe-default recovery path.
- Documented first-run, restart, reset, corruption, and platform QA steps.

## Safety boundary

No auth session, draft, cache, profile, or native permission is cleared or
requested by this tool. Native setup QA remains required on Windows, Linux, and
macOS before public release.
