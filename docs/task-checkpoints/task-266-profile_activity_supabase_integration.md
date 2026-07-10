# Task 266 checkpoint: Profile activity Supabase integration

- Added a privacy-projected RPC using profiles, visible messages/reactions/attachments, follows and shared community memberships.
- Added `profileActivityService` and wired ProfileView data through it without component-level Supabase calls.
- Prevented Supabase loading/error states from displaying mock activity/media as real production data.
- Excluded private/deleted/quarantined content and documented reply/voice/signed-media privacy TODOs.
- Kept the existing mock profile path unchanged.

Validation: `npm run profile:activity:supabase:smoke`, `npm run profile:privacy:smoke`, `npm run mock:smoke`, `npm run typecheck` and `npm run build` were run. Hosted RLS execution remains pending because Supabase CLI/environment is unavailable.
