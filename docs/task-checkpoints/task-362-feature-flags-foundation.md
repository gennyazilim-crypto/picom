# Task 362 Checkpoint: Feature Flags Foundation

## Status

Completed a typed feature flag service foundation with safe defaults, environment overrides, remote-config sanitization, and documentation.

## Changed files

- `src/services/featureFlagService.ts`
- `.env.example`
- `docs/feature-flags.md`
- `scripts/feature-flags-smoke-test.mjs`
- `docs/task-checkpoints/task-362-feature-flags-foundation.md`
- `package.json`

## Commands run

```bash
npm run feature-flags:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Open `src/services/featureFlagService.ts`.
2. Confirm `FEATURE_FLAG_KEYS` is typed and unknown keys are ignored.
3. Set a local renderer-safe override such as `VITE_FEATURE_FLAGS=enableDiscovery=false` in `.env.local` if needed.
4. Run `npm run feature-flags:smoke`.
5. Run `npm run typecheck && npm run qa:smoke && npm run build`.

## Notes

Feature flags hide or disable UI availability only. Supabase RLS, backend authorization, LiveKit token checks, and storage access controls remain mandatory security boundaries.
