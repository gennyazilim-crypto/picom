# Task 363 Checkpoint: Remote Config Foundation

## Status

Completed a typed renderer remote config service, public Supabase Edge Function placeholder, env documentation, and smoke verification.

## Changed files

- `src/config/appConfig.ts`
- `src/services/remoteConfigService.ts`
- `supabase/functions/client-config/index.ts`
- `.env.example`
- `scripts/env-safety-smoke-test.mjs`
- `docs/remote-config.md`
- `scripts/remote-config-smoke-test.mjs`
- `docs/task-checkpoints/task-363-remote-config-foundation.md`
- `package.json`

## Commands run

```bash
npm run remote-config:smoke
npm run typecheck
npm run qa:smoke
npm run build
```

## How to test manually

1. Keep `VITE_DATA_SOURCE=mock` and leave `VITE_REMOTE_CONFIG_URL` empty.
2. Confirm the app can continue using safe defaults without backend config.
3. In Supabase mode, deploy the `client-config` Edge Function later and optionally set `VITE_REMOTE_CONFIG_URL`.
4. Run `npm run remote-config:smoke`.
5. Run `npm run typecheck && npm run qa:smoke && npm run build`.

## Notes

Remote config is public configuration only. It must not include secrets, and it does not replace Supabase RLS, backend authorization, storage checks, or LiveKit token enforcement.
