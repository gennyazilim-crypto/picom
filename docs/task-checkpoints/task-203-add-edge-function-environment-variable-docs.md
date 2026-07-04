# Task 203 - Add Edge Function environment variable docs

## Scope

- Added Edge Function-specific environment variable documentation.
- Separated renderer-safe `VITE_` variables from server-only function secrets.
- Documented LiveKit secret handling and future server-only variable rules.

## Runtime impact

- Documentation-only task.
- No app code, Edge Function code, or real secrets were added.

## Verification

- Run `npm run supabase:smoke`.
- Review `docs/edge-function-environment-variables.md` before adding new function secrets.
