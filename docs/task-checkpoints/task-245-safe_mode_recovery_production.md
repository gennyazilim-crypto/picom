# Task 245 checkpoint: safe mode recovery production

- Finalized repeated-startup-crash activation and stable-start counter reset.
- Added in-memory safe-mode fallback for local-data migration/storage failures before React mounts.
- Guarded migration backup/manifest writes so storage quota or policy failures cannot block basic startup.
- Added Restart in Safe Mode to the renderer error boundary and documented normal-restart loop prevention.
- Preserved auth sessions while exposing reset settings, clear non-essential cache, and redacted log export recovery actions.

Validation: `npm run safe-mode:production:test`, `npm run safe-mode:smoke`, `npm run crash:recovery:smoke`, `npm run local-data:migration:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`.
