# Task 63 - Webhook Foundation

- Added hash-only webhook records with role-gated RLS.
- Added Community Admin Panel > Webhooks create/list/revoke flow.
- Raw 256-bit webhook tokens are returned only once and copied through `clipboardService`.
- Stored records and list DTOs never include the raw token.
- Added create/revoke audit events and WEBHOOK message badge support.
- Added a safe POST Edge Function boundary that validates credentials/body but refuses delivery until rate limiting, token lookup, and private-channel authorization are complete.
- No public webhook publishing or secret recovery is enabled.

Validation: `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
