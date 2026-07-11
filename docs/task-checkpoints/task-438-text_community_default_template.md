# Task 438 - Text Community Default Template

## Status

Implemented the Full MVP Text-community creation boundary for mock and Supabase data sources.

## Delivered

- The default Text template is `Information / welcome`, `Channels / general`, and `Voice / focus-room`.
- Text templates do not create Radio or Podcast publishing sections.
- The create modal supplies one stable UUID for every retry made during the same creation session.
- Mock creation caches successful results by that UUID and rejects conflicting reuse.
- Supabase creation uses `create_text_community_with_defaults` instead of separate client inserts.
- The RPC creates the community, Owner and Member roles, owner membership, categories, and channels in one PostgreSQL transaction.
- Advisory locking plus a unique owner/request index makes reconnect and double-submit retries idempotent.
- Internal template setup uses conflict-safe inserts and restores the creator's Owner role.
- Any child-template failure aborts the RPC, so the new community and all children roll back together.
- Existing Text starter-template choices are honored by the server-owned template definitions.

## Security and access boundary

- The public client cannot invoke the internal template helper.
- Only `authenticated` receives execute access to the creation RPC.
- The RPC derives the owner from `auth.uid()` and never accepts an owner ID from the renderer.
- Community RLS remains enabled; the security-definer function performs the narrowly scoped atomic bootstrap.

## Evidence

- `npm run community:text-template:smoke` covers mock/service/migration/type contracts.
- `supabase/tests/rls/text_community_default_template.sql` provides real pgTAP coverage for ownership, defaults, retry deduplication, authentication, and transaction rollback.
- Local Supabase execution is BLOCKED when the Supabase CLI/local database is unavailable; static smoke coverage is not represented as a real database pass.
- Interactive Electron creation remains a manual UI check and is not represented as automated evidence when no UI runner is active.

## Manual test path

1. Open Create Community and choose Text.
2. Keep the Custom starter template and finish creation.
3. Confirm the new community opens in Community view with welcome, general, and focus-room.
4. Confirm the current user has Owner access.
5. Confirm no Radio or Podcast publishing navigation appears.
6. Simulate a retry with the same request UUID in an isolated Supabase environment and confirm only one community exists.

## Remaining external validation

- Apply the migration to an isolated Supabase staging project and run the pgTAP file.
- Perform the create/retry/rollback flow in two Electron windows against staging before release certification.
