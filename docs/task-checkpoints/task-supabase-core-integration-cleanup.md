# Task Checkpoint: Supabase Core Integration Cleanup

## Status

Completed.

## What changed

- Added `src/lib/supabaseClient.ts` compatibility entrypoint.
- Added `profileService` for current profile fetch/update and profile-by-ID lookup.
- Added Supabase namespace wrapper files for auth, profile, community, channel, message, and upload services.
- Added active-channel Supabase Realtime subscription helper.
- Documented the core Supabase integration surface.
- Expanded the Supabase API regression smoke to verify profile, upload, realtime, env, direct UI DB-call, and renderer secret-safety checks.

## Safety notes

- Mock mode remains the default.
- UI components should continue using services only.
- `SUPABASE_SERVICE_ROLE_KEY` is documented as server-only and is not used by renderer code.
- Live Supabase verification still requires local/staging credentials and Supabase CLI.

## Commands to run

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run supabase:api-regression`
- `npm run build`
