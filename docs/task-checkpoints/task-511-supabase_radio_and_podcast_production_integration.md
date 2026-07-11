# Task 511 Checkpoint: Supabase Radio and Podcast Production Integration

## Delivered

- Confirmed the existing Radio and Podcast UI is service-layer only in both mock and Supabase modes.
- Locked Radio live/schedule/listener/host/save/reaction production paths behind a deterministic integration contract.
- Locked Podcast draft/publish/media/progress/save/reaction/comment production paths behind the same contract.
- Added the missing Radio table-level community-kind invariant for settings, programs, sessions, schedules, and announcements.
- Added an integrated pgTAP fixture for community-kind guards, RLS, private Storage, user state, and Realtime publication coverage.
- Extended Supabase API and RLS regressions so audio production paths cannot silently fall back to mock-only behavior.

## Validation gate

Before commit, run the task contract, Radio Full MVP QA, Podcast Full MVP QA, Supabase QA, typecheck, mock smoke, production build, and QA smoke. Hosted Supabase/Storage/Realtime execution must remain **BLOCKED**, not passed, when provider credentials, Supabase CLI, or two synthetic accounts are unavailable.

## Local results

- `node scripts/supabase-audio-production-integration-smoke.mjs` - PASS.
- `npm run radio:full-mvp:qa` - PASS.
- `npm run podcast:full-mvp:qa` - PASS.
- `npm run audio:service:smoke` and `npm run audio:mvp:qa` - PASS.
- `npm run supabase:qa` - PASS structurally; real pgTAP execution is **BLOCKED** because Supabase CLI is unavailable.
- `npm run typecheck` and `npm run mock:smoke` - PASS.
- `npm run build` and `npm run qa:smoke` - PASS.
- Performance budget was not rerun because this task changes no renderer bundle, CSS, or production import.

## Remaining external evidence

- Two-client Radio listener and reaction propagation.
- Two-client Podcast comment/reaction propagation.
- Real private audio/cover upload, signed playback, and expiry refresh.
- Hosted draft/private denial and role-change revocation.

These are environment evidence items, not renderer placeholders.
