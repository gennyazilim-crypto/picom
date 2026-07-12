# Picom V1 Production Data Source

## Contract

Picom V1 stable is production-backed and Windows-first. A stable or production renderer must explicitly set:

```text
VITE_APP_ENV=production
VITE_RELEASE_CHANNEL=stable
VITE_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://<approved-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<public-anon-or-publishable-key>
```

The anon/publishable key is a public renderer configuration value protected by RLS. Service-role keys, database passwords, JWT secrets, signing material, and provider secrets must never use a `VITE_` variable.

## Authority and startup behavior

1. `src/config/dataSourcePolicy.ts` resolves the requested mode in release context.
2. `src/config/appConfig.ts` stores that single decision and its safe configuration error.
3. `src/services/dataSourceService.ts` reports the same decision to every repository/service.
4. `src/services/productionRuntimeConfigService.ts` validates startup readiness.
5. `src/main.tsx` stops before mounting `App` when configuration is blocked.

Missing or invalid Supabase values show a recoverable production-configuration screen. Picom does not authenticate a mock user, render mock communities, display fake counts, or silently switch data sources.

## Development and deterministic tests

Mock mode remains supported only when explicitly selected in a non-stable, non-production environment:

```text
VITE_APP_ENV=development
VITE_RELEASE_CHANNEL=dev
VITE_DATA_SOURCE=mock
```

Mock fixture modules use `selectMockFixture`. Their public exports resolve to empty production values unless explicit mock mode is valid. Service/repository layers own mock-versus-Supabase behavior; components do not call Supabase directly and do not choose a data source.

## Included V1 domains

| Domain | Production path | Missing/unavailable behavior |
| --- | --- | --- |
| Auth/session | `authService` -> Supabase Auth | Safe auth/config error; no mock session |
| Feed | `feedQueryService` and realtime service | Empty/error state; no mock ranking fallback |
| Communities/channels | community/category/channel services | Truthful load error or empty membership state |
| Messages/attachments/read state | message, upload, attachment, read-state services | Recoverable operation error; no fake message |
| Profile | profile/profile-activity/media services | Privacy-safe empty projection or load error |
| Friends | friend request/presence services | Empty/error state; no fake relationship count |
| Direct Messages | DM conversation/message/realtime services | Participant-only empty/error state |
| Settings | settings service | Local device settings plus authenticated account sync |
| Community Admin | typed services/RPCs under RLS | Permission/configuration error |
| Help/Diagnostics | local help and redacted diagnostics | Remains available without exposing secrets |

Task 668 includes Voice and Screen Share through protected Supabase/LiveKit service boundaries. Radio, Podcasts, Events, Bookmarks, Meeting Workspace, bots, product webhooks, and other post-V1 surfaces remain gated by the Task 617 registry.

## Diagnostics

Diagnostics report the active data-source mode, whether Supabase is configured, and only the safe Supabase hostname. They do not export keys, tokens, authorization headers, connection strings, private messages, or credentials.

## Validation

```powershell
node scripts/data-source-final-cleanup-smoke.mjs
node scripts/v1-production-data-source-smoke.mjs
node scripts/validate-supabase-environment.mjs
```

Hosted data correctness, RLS, Realtime, and Edge Function evidence are separate release blockers and are not implied by this local configuration contract.
