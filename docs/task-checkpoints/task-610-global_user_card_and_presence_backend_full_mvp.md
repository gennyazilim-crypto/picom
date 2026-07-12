# Task 610 checkpoint: Global user card and presence backend Full MVP

## Completed

- Extracted a reusable global user card and accessible presence menu.
- Kept profile navigation on avatar/name, verification beside the name, and presence on the avatar dot.
- Added persistent Online, Idle, Do Not Disturb, and Invisible preferences.
- Added a derived presence store that prevents contradictory connection/status labels.
- Centralized own-presence publishing in a Supabase Realtime-aware global service.
- Reduced the friend presence service to friend snapshot subscription only.
- Added private expiring presence sessions, security-definer heartbeat/cleanup RPCs, multi-session aggregation, RLS, and pgTAP coverage.
- Preserved the overflow menu contract: Copy Username and Log Out only.

## Validation

- `node scripts/global-user-card-presence-smoke.mjs`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

## Hosted status

Cross-client Supabase Realtime validation is `BLOCKED` locally because no protected hosted staging credentials or two-client test identity are used by this task. The migration and structural RLS contract are ready for the protected hosted-validation workflow.
