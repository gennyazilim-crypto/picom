# Task 267 checkpoint: Profile follow/unfollow persistence

- Verified and hardened `user_follows` with participant RLS, idempotent RPC mutation and removed direct client mutation grants.
- Added block/profile-visibility/self checks and kept the existing relationship rate-limit trigger.
- Updated the service and optimistic UI with duplicate-click suppression, rollback and authoritative reconciliation.
- Added follower-filtered realtime refresh so Mention Feed, stories and profiles share persisted state across windows.
- Kept mock follow/unfollow behavior working.

Validation: `npm run follow:persistence:smoke`, `npm run mentions:ranking:test`, `npm run stories:supabase:smoke`, `npm run mock:smoke`, `npm run typecheck` and `npm run build` were run. Hosted pgTAP/realtime evidence remains pending because Supabase CLI/environment is unavailable.
