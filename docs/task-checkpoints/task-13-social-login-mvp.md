# Task 13 - Social Login MVP

## Status

Implemented Google and Apple Supabase OAuth foundations for the Picom Electron desktop app.

## Delivered

- Shared social login buttons on login and registration screens.
- Supabase PKCE OAuth launch through the safe external-link service.
- Validated `picom://auth/callback` handling in Electron main, preload, and renderer.
- Session exchange remains owned by Supabase Auth.
- Safe profile fallback creation from bounded provider metadata.
- Provider availability flags and full setup documentation.
- Account-linking safety notes and explicit Steam/Epic MVP+ exclusions.

## Required provider configuration

- `VITE_SUPABASE_GOOGLE_OAUTH_ENABLED=true` after Google is configured in Supabase.
- `VITE_SUPABASE_APPLE_OAUTH_ENABLED=true` after Apple is configured in Supabase.
- Provider secrets remain in Supabase and are never exposed to the Electron renderer.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`

## Revalidation

Revalidated after the first-run onboarding and animated login background changes. Email/password remains visible and social provider controls retain their safe configured/disabled states.
