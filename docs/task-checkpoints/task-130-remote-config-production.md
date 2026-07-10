# Task 130 - Remote Config Production

## Result

Completed. Renderer remote config now enforces safe endpoint protocols, semantic versions, bounded strings/MIME/links, a 64 KiB response ceiling, and a schema-versioned 24-hour cache. The public Edge Function applies matching version/link/string safeguards and exposes the new typed flags safely.

## Changed files

- `src/services/remoteConfigService.ts`
- `supabase/functions/client-config/index.ts`
- `scripts/remote-config-smoke-test.mjs`
- `docs/config/remote-config-production.md`
- `docs/task-checkpoints/task-130-remote-config-production.md`

## Verification

- `npm run remote-config:smoke`
- `npm run feature-flags:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

No secret or authorization behavior was added. Live deployed Edge Function, CORS/TLS, and stale/offline staging scenarios remain production gates.
