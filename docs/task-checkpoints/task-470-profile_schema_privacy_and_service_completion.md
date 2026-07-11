# Task 470 Checkpoint: Profile Schema, Privacy, and Service Completion

Date: 2026-07-11

## Completed

- Made `UserProfile` the canonical profile domain and derived the editor summary from it.
- Added cover, language, tags, onboarding, verification, relationship, stats, and privacy projection support.
- Added privacy controls for communities/roles, friends, follows, online status, activity, media, and audio sections.
- Added owner-private `profile_details` storage and guarded profile-domain read/write RPCs.
- Kept activity/media authorization tied to per-message/channel checks.
- Aligned mock and Supabase service shapes and kept Supabase out of Profile components.

## Validation contract

- `npm run profile:domain:smoke`
- `npm run profile:privacy:smoke`
- `npm run profile:activity:supabase:smoke`
- `npm run audio:profile:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run supabase:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

Live hosted privacy/RLS validation remains blocked until protected Supabase staging credentials and CLI access are available.
