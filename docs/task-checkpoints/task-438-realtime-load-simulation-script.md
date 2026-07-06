# Task 438 Checkpoint: Realtime Load Simulation Script

## Summary

Added a safe development-only realtime load simulation script for Picom.

## Scope

- Simulates connecting users.
- Simulates community/channel room joins.
- Simulates message sends.
- Simulates typing start/stop events.
- Simulates presence online/offline events.
- Simulates disconnect/reconnect cycles.
- Exercises duplicate event prevention.
- Keeps default mode in-memory and production-safe.

## Files changed

- `scripts/realtime-load-simulation.mjs`
- `scripts/realtime-load-simulation-smoke-test.mjs`
- `docs/realtime-load-simulation.md`
- `README.md`
- `package.json`
- `docs/task-checkpoints/task-438-realtime-load-simulation-script.md`

## Validation

- `npm run realtime:load:smoke`
- `npm run typecheck`
- `npm run build`

## Notes

- The script does not connect to Supabase by default.
- Remote execution is blocked unless `PICOM_REALTIME_LOAD_ALLOW_REMOTE=true`.
- No production load test path is enabled.

