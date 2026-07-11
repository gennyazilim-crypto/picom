# Task 534 checkpoint: Scheduled meetings, invitations, and join policy backend

## Delivered

- Durable schedule/event linkage, host/cohost assignment, reminder policy, and active-session safeguards.
- SHA-256-only, revocable, expiring, usage-limited meeting invitations with per-user redemption.
- Permission-aware schedule/create/list/revoke/validate/join-preview RPCs.
- JWT-verified `meeting-join` Edge gateway with strict request shape, origin policy, no-store responses, and no secret echo/logging.
- Member, authenticated invited guest, and authenticated public visitor join decisions with ban/timeout/block enforcement.
- Central per-user rate limits and immutable community audit events.
- Mock-mode service parity, generated database type contracts, structural smoke, and disposable-database SQL verification.

## Validation status

- `node scripts/meeting-schedules-invites-join-policy-smoke.mjs`: **PASS**.
- `npm run typecheck`: **PASS**.
- `npm run supabase:migrations:check`: **PASS** (170 ordered, BOM-free migrations).
- `npm run supabase:qa`: **PASS**.
- `npm run mock:smoke`: **PASS**.
- `npm run build`: **PASS**, with the pre-existing ineffective voice dynamic-import and large-chunk warnings.
- `npm run qa:smoke`: **FAILED OUTSIDE TASK SCOPE** because the concurrent user-owned `src/styles.css` contains a desktop-only smoke-regex match for a small `max-width` media query. Task 534 does not modify UI/styles, and that unrelated work was not altered or staged.
- Deno-native Edge typecheck: **BLOCKED** because the Deno CLI is unavailable; the repository structural Edge contract passed.
- Hosted migration apply, Edge deployment, and SQL actor test: **BLOCKED** until Supabase CLI and disposable hosted/local credentials are available. No hosted pass is claimed.

## Security invariants

- Raw invitation secrets exist only long enough to share from the caller and are never persisted.
- Direct authenticated table reads cannot expose invite hashes or redemption rows.
- Revoked, expired, exhausted, banned, timed-out, blocked, or wrong-user access fails closed.
- UI components do not call Supabase directly; scheduling and join APIs are behind `meetingSchedulingService`.
