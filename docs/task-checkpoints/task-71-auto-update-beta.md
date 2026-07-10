# Task 71 - Auto-Update Beta Channel Foundation

- Added complete beta-safe update state machine and release-channel typing.
- Added Settings > Advanced check, availability, download, ready, failure, retry, and clear simulations.
- Kept `autoUpdateEnabled` false with no real endpoint or package mutation.
- Added no signing certificates, updater credentials, or secrets.
- Documented the safe Electron main-process integration path.

Validation: simulated states plus `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
