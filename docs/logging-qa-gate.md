# Logging QA Gate

Picom keeps renderer diagnostics useful without exposing secrets. The `logs:smoke` gate checks the central logging service before the broader QA gate runs.

## Covered behavior

- `src/services/logging/loggingService.ts` remains the approved import facade.
- `src/services/loggingService.ts` exposes redacted `debug`, `info`, `warn`, and `error` logging helpers.
- Sensitive values such as passwords, tokens, cookies, authorization headers, service-role keys, LiveKit secrets, and signing keys are redacted.
- The in-memory log buffer is bounded to prevent long-running desktop sessions from growing indefinitely.
- Diagnostics export, clear, recent-log lookup, exception capture, and listener cleanup APIs remain available.

## Commands

```bash
npm run logs:smoke
npm run qa:smoke
```

## Notes

This gate does not upload logs or connect to an external provider. It is a local source-level smoke test designed to keep the MVP desktop app safe while diagnostics and support tooling evolve.
