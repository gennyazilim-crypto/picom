# Task 298 - Active voice rooms discovery

## Result

- Added an access-filtered active voice room discovery service.
- Voice channels are included only after community visibility and channel visibility checks.
- Private room names and occupancy are never returned to unauthorized visitors.
- Participant names are returned only when the viewer may see the member list.
- Members can open an allowed voice channel from FeedCompanionRail; visitors receive a join-community explanation.
- Mock mode uses deterministic local occupancy. Supabase mode does not invent occupancy and accepts future realtime channel occupancy data; the currently connected LiveKit room remains visible.

## Validation

- `npm run voice:discovery:test`
- `npm run mock:smoke`
- `npm run typecheck`
- `npm run build`

## Manual checks

1. In mock mode, open Mention Feed and inspect Active voice rooms below the connected voice card.
2. Confirm member-visible rooms open their community voice channel.
3. Test a public visitor community and confirm private voice channels never appear and join is disabled until membership exists.
4. In Supabase mode, confirm rooms are shown only when real occupancy/current LiveKit state is available.
