# Task 474 Checkpoint: Profile Access RLS

## Delivered

- Explicit owner/block/shared-community/friend/visitor profile projection.
- Trusted-only activity, media, community, friend, and follow section visibility.
- Verification badge lookup aligned with visible user/community/role subjects.
- Confirmed per-message attachment filtering and Radio/Podcast community RLS boundaries.
- Added 26-case transaction-local role/user pgTAP matrix, including membership removal.
- Registered the matrix in structural and real Supabase RLS runners.

## Validation

- `node scripts/profile-access-privacy-smoke.mjs`
- `npm run supabase:rls:smoke`
- `npm run supabase:rls:production-safe`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run qa:supabase`

`npm run supabase:rls:test` is BLOCKED until Supabase CLI and an isolated test database are available. Structural pgTAP coverage passes without fabricating hosted evidence.
