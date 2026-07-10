# Community invite acceptance production

`accept_community_invite_v2` is the authoritative production join path. It normalizes and validates the code, locks the invite row, checks revoked/expired/exhausted state, blocks active community bans, returns existing membership idempotently, resolves the default Member role, creates membership, increments use count, and appends a redacted audit entry in one database transaction.

The renderer receives only stable statuses (`joined`, `already_member`) and maps stable backend codes to safe user-facing copy. Raw Postgres/Supabase messages are never shown. Invite codes are not written to audit logs.

Mock mode follows the same status contract and does not consume another use when the user is already a member. The prior v1 RPC remains available for compatibility, while new desktop builds use v2.

Hosted concurrency, ban, and RLS checks require applying the migration in a Supabase test project. No hosted result is claimed without that environment.
