# Task 282 checkpoint: community settings persistence

## Completed

- Added validated name, description, icon placeholder, visibility, and public-read controls.
- Replaced direct table update with an owner/admin-protected RPC.
- Forced private communities to disable public read.
- Added redacted audit logging and safe user-facing failures.
- Updated the current community UI immediately after authoritative success.
- Preserved desktop layout and existing community/admin navigation.

## Verification

- `npm run community:settings:persistence:test`
- `npm run community:access:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Remaining environment check

Apply the migration and test owner/admin success, moderator/member denial, invalid inputs, public-to-private transition, and concurrent updates against Supabase. Icon upload remains intentionally outside this task.
