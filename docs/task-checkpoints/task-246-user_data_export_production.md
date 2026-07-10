# Task 246 checkpoint: user data export production

- Preserved authenticated, RLS-scoped export queries and service-role use only for request status transitions.
- Added runtime allowlisting for profile, membership, own message, own attachment metadata, follows, and saved-message sections.
- Added strict ID/timestamp/row-bound validation, unknown-field removal, expiry enforcement, and no-store response headers.
- Kept payloads memory-only; localStorage stores request metadata only and no passwords, tokens, auth headers, raw storage paths, or other users' private data.
- Large-account encrypted background archives remain an explicitly documented follow-up; bounded synchronous export is the current production path.

Validation: `npm run privacy:data-export:smoke`, `npm run supabase:smoke`, `npm run typecheck`, `npm run mock:smoke`, `npm run build`. Live Edge Function/RLS checks still require Supabase CLI or staging.
