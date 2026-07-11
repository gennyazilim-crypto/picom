# Task 446 Checkpoint: Radio Services Realtime and Data Source

## Result

Radio has a consolidated repository contract, atomic listener RPCs, deduplicated Supabase Realtime refresh, reconnect/cleanup handling, and service-wired panel actions in mock and Supabase modes.

## Implemented

- Added repository methods for list/detail/create/update/cancel/start/end/join/leave/save/react/host assignment.
- Added idempotent listener join/leave RPCs and Realtime publication membership.
- Added mock listener and host-assignment deduplication.
- Added a ref-counted Radio Realtime service with bounded event dedupe and retry cleanup.
- Added typed audio loading/error/realtime hook state.
- Reconciled the Radio shell/panel with realtime catalog sessions.
- Replaced local-only listen/save/start/end/cancel controls with real service calls.

## Required validation

- `npm run radio:service-realtime:smoke`
- `npm run radio:data-model:smoke`
- `npm run audio:service:smoke`
- `npm run audio:radio:smoke`
- `npm run supabase:smoke`
- `npm run typecheck`
- `npm run mock:smoke`
- `npm run build`
- `npm run qa:smoke`
- `npm run performance:budget:ci`

## Evidence boundary

- Local source, mock, type, build, QA, and performance contracts are required.
- Real two-client Supabase Realtime remains a hosted validation and must be marked `BLOCKED` when staging credentials/environment are unavailable.
- No fake hosted success or service-role renderer access is included.

## Safety

- Source-table RLS remains authoritative for every Realtime payload.
- Listener history remains private; normal viewers receive only aggregate counts.
- Duplicate active listeners are prevented atomically in Postgres and locally in mock mode.
- Components contain no direct Supabase calls.
