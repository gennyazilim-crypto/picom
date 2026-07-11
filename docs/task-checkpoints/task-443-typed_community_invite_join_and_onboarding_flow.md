# Task 443 Checkpoint: Typed Community Invite Join and Onboarding Flow

## Result

- Added safe invite preview metadata with canonical community kind.
- Added type-specific capability, visitor, onboarding, and landing copy.
- Routed Text joins to Welcome/General, Radio joins to Live, and Podcast joins to Episodes.
- Added authoritative membership INSERT restrictions for active bans and owner/user blocks.
- Preserved private-community invite gating and existing deep-link parsing.

## Validation plan

- `npm run community:typed-join:smoke`
- `npm run invites:acceptance:production:test`
- `npm run community:public-join:production:test`
- `npm run community:access:smoke`
- `npm run supabase:rls:smoke`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Real pgTAP remains BLOCKED when the Supabase CLI/local database is unavailable. The structural contract must not be reported as live database evidence.
