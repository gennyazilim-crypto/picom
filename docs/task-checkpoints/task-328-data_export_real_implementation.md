# Task 328 - Data export real implementation

Status: implemented; hosted deployment validation pending.

- Authenticated Edge Function exports only the current user's RLS-visible allowlisted data.
- Service-role access was removed from the export function.
- Payload is validated and retained only in app memory; request table stores content-free status metadata.
- User-scoped RPCs enforce ownership, rate window, status allowlist and 15-minute expiry.
- Settings refreshes backend status and prevents duplicate submissions while processing.
- Hosted migration/function/RLS tests remain pending without Supabase CLI/staging credentials.

Validation:
- `npm run privacy:data-export:real:test`
- `npm run privacy:data-export:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
