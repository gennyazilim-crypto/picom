# Task 435 Checkpoint: Emergency Kill Switch Foundation

## Summary

Prepared a typed emergency kill switch foundation for Picom desktop release operations.

## Scope

- Added `emergencyKillSwitchService` with typed keys and safe defaults.
- Added local environment override parsing through `VITE_EMERGENCY_KILL_SWITCHES`.
- Added remote config `killSwitches` sanitization and application.
- Added public Supabase Edge Function placeholders for kill switch values.
- Documented security boundaries and operator workflow.
- Added a smoke test for kill switch coverage.

## Files changed

- `src/services/emergencyKillSwitchService.ts`
- `src/services/remoteConfigService.ts`
- `supabase/functions/client-config/index.ts`
- `docs/emergency-kill-switches.md`
- `docs/remote-config.md`
- `docs/feature-flags.md`
- `docs/release-checklist.md`
- `scripts/emergency-kill-switches-smoke-test.mjs`
- `package.json`
- `docs/task-checkpoints/task-435-emergency-kill-switch-foundation.md`

## Validation

- `npm run emergency:kill-switches:smoke`
- `npm run remote-config:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- Kill switches are not security enforcement.
- Backend/Supabase RLS and LiveKit token authorization remain mandatory.
- No UI redesign, mobile UI, production auto-update, bots, webhooks, or plugin runtime was added.
