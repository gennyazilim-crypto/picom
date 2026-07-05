# Admin Operations Panel Placeholder

Picom's Admin Operations panel is a development-only placeholder for future app-level operations tooling. It is not community settings and it is not visible in production builds.

## Current behavior

- Rendered only when `import.meta.env.DEV` is true.
- Entry point: Settings > Advanced.
- Shows safe placeholder sections for system status, users overview, communities overview, reports, abuse/rate-limit events, upload storage, realtime status, and recent server errors.
- Does not call backend admin routes.
- Does not expose secrets, tokens, raw authorization headers, passwords, signing keys, Supabase service-role keys, or LiveKit API secrets.

## Production requirement before enabling

- Add app-admin authorization.
- Enforce backend authorization for every admin route.
- Return only redacted operational summaries.
- Keep admin tooling hidden from normal users.
- Audit admin access and actions.

## Manual check

1. Run `npm run dev`.
2. Open Settings.
3. Open Advanced.
4. Confirm the Admin Operations placeholder is visible in development.
5. Run `npm run build`.
6. Confirm production code remains gated by `import.meta.env.DEV`.
