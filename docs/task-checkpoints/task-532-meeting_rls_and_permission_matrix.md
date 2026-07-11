# Task 532 - Meeting RLS and permission matrix

## Result

- Added eleven canonical meeting permissions for all community kinds.
- Added Owner/Admin/Moderator/Member/Viewer/Guest server role mapping.
- Added public discovery, join, waiting-room and sensitive-data authorization helpers.
- Added ban, timeout and block enforcement.
- Added SELECT/INSERT/UPDATE/DELETE policies where client mutation is allowed; immutable event/attendance writes remain server-only.
- Added participant hierarchy trigger and privileged stage-role RPC.
- Prevented self-escalation, cohost host assignment and equal/higher moderation.
- Added generated RPC types, TypeScript permission catalog entries, pgTAP contract and hosted Text/Radio/Podcast role matrix.

## Validation

- `node scripts/meeting-rls-permission-smoke.mjs`
- `npm run supabase:rls:smoke`
- `npm run supabase:migrations:check`
- `npm run supabase:qa`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run qa:smoke`
- `npm run build`

Real pgTAP and actor-by-actor hosted execution remain BLOCKED when Supabase CLI/protected staging identities are unavailable. Structural checks do not certify hosted RLS.

Expected commit: `security enforce meeting rls permissions`.
