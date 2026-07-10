# Task 195 Checkpoint: Profile Reputation and Verification Badges

- Added user, community, and role review-marker types with explicit scope notes.
- Added app-admin-only grant/revoke RPCs and subject validation.
- Added separate append-only verification audit records.
- Rendered active profile markers with a non-guarantee tooltip.
- Added restricted Admin Operations management UI.
- Explicitly excluded paid verification, automatic reputation scoring, and misleading identity/safety/quality claims.

Validation: `npm run verification:badges:smoke`, `npm run typecheck`, `npm run mock:smoke`, and `npm run build`.
