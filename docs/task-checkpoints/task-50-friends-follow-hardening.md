# Task 50 - Friends and Follow System Hardening

Date: 2026-07-10
Status: Complete

## Result
- Added follow, friend-request, and normalized accepted-friend tables with participant/owner RLS.
- Added atomic accept/decline and remove-friend functions.
- Added one mock/Supabase relationship service contract.
- Mention Feed continues to use followed IDs; the Friends rail continues to use accepted friends only.
- ProfileView now reflects friend, incoming, outgoing, and none states and can send a local/Supabase-ready request.

## Validation
- `npm run typecheck`
- `npm run supabase:smoke`
- `npm run mock:smoke`
- `npm run build`

## Remaining live check
Run social relationship pgTAP and sender/recipient/outsider account tests against configured staging RLS.
