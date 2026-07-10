# Task 099 checkpoint: Account deletion production

## Delivered

- Transactional deletion request/cancel RPCs with exact username and ownership checks.
- JWT-protected Edge Function with global Supabase session revocation.
- Fourteen-day review/anonymization schedule without automatic hard deletion.
- Append-only, content-free account security events.
- Settings Account danger zone with explicit warning, confirmation, disabled duplicate action, cancellation, and sign-out handoff.
- Typed Supabase schema additions and production privacy documentation.

## Safety boundaries

- The renderer cannot hard-delete account data.
- Community ownership is enforced in PostgreSQL, not only in React.
- Auth credentials, tokens, passwords, raw IP addresses, and message content are excluded from security events.
- Final anonymization remains a reviewed trusted-worker operation.

## Validation

- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`

Live migration, RLS, and multi-session revocation checks require Supabase CLI or a staging project.
